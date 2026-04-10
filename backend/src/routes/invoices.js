const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const auth = require('../middleware/auth');
const { sendInvoiceEmail } = require('../services/mailer');
const crypto = require('crypto');

router.use(auth);

const VALID_STATUSES = ['paid','unpaid','pending','partial','failed','cancelled','refunded','expired','processing','overdue'];

const withItems = `
  SELECT i.*,
    COALESCE(json_agg(
      json_build_object('id',ii.id,'description',ii.description,'rate',ii.rate,'quantity',ii.quantity)
      ORDER BY ii.created_at
    ) FILTER (WHERE ii.id IS NOT NULL), '[]') AS items
  FROM invoices i
  LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
`;

// GET /api/invoices
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`${withItems} WHERE i.user_id=$1 GROUP BY i.id ORDER BY i.created_at DESC`, [req.user.id]);
    res.json({ invoices: rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`${withItems} WHERE i.id=$1 AND i.user_id=$2 GROUP BY i.id`, [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ invoice: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/invoices/:id/reminder-logs
router.get('/:id/reminder-logs', async (req, res) => {
  try {
    const check = await pool.query('SELECT id FROM invoices WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const { rows } = await pool.query('SELECT * FROM reminder_logs WHERE invoice_id=$1 ORDER BY sent_at DESC', [req.params.id]);
    res.json({ logs: rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/invoices
router.post('/', async (req, res) => {
  const { invoiceNumber, clientName, clientEmail, clientAddress, issueDate, dueDate,
    items, taxPercentage, notes, status, partialPercentage, sendEmailNow, pdfBase64 } = req.body;

  if (!invoiceNumber || !clientName || !issueDate || !dueDate)
    return res.status(400).json({ error: 'invoiceNumber, clientName, issueDate, dueDate required' });
  if (!items || !Array.isArray(items) || !items.length)
    return res.status(400).json({ error: 'At least one item required' });

  const finalStatus = status && VALID_STATUSES.includes(status) ? status : 'unpaid';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO invoices (user_id,invoice_number,client_name,client_email,client_address,issue_date,due_date,tax_percentage,notes,status,partial_percentage)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.id, invoiceNumber, clientName, clientEmail||'', clientAddress||'', issueDate, dueDate, taxPercentage||0, notes||'', finalStatus, partialPercentage||0]
    );
    const invoice = rows[0];
    const insertedItems = [];
    for (const item of items) {
      const { rows: ir } = await client.query(
        'INSERT INTO invoice_items (invoice_id,description,rate,quantity) VALUES ($1,$2,$3,$4) RETURNING *',
        [invoice.id, item.description, item.rate||0, item.quantity||1]
      );
      insertedItems.push(ir[0]);
    }
    await client.query('COMMIT');

    if (sendEmailNow && clientEmail) {
      const subtotal = insertedItems.reduce((s, i) => s + Number(i.rate)*Number(i.quantity), 0);
      const total = subtotal * (1 + Number(taxPercentage||0)/100);
      const { rows: cs } = await pool.query('SELECT * FROM company_settings WHERE user_id=$1', [req.user.id]);
      const settings = cs[0] || {};

      // Create upload token for this invoice
      const uploadToken = crypto.randomBytes(32).toString('hex');
      await pool.query(
        `INSERT INTO payment_receipts (invoice_id, upload_token, client_name, client_email, currency)
         VALUES ($1,$2,$3,$4,$5)`,
        [invoice.id, uploadToken, clientName, clientEmail, settings.default_currency||'USD']
      );
      const uploadUrl = `${process.env.FRONTEND_URL||'http://localhost:5173'}/pay/${uploadToken}`;

      let pdfBuffer = null;
      if (pdfBase64) pdfBuffer = Buffer.from(pdfBase64, 'base64');

      // Send email synchronously (instant) then record sent time
      try {
        await sendInvoiceEmail({
          to: clientEmail, clientName, invoiceNumber, dueDate, amount: total,
          currency: settings.default_currency||'USD',
          companyName: settings.company_name||'Your Company',
          pdfBuffer, uploadUrl,
        });
        await pool.query('UPDATE invoices SET invoice_sent_at=NOW() WHERE id=$1', [invoice.id]);
      } catch (emailErr) {
        console.error('Send email on create failed:', emailErr.message);
      }
    }

    res.status(201).json({ invoice: { ...invoice, items: insertedItems } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create invoice error:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/invoices/:id/send-email — send invoice email with PDF to client
router.post('/:id/send-email', async (req, res) => {
  const { pdfBase64 } = req.body;
  try {
    const { rows } = await pool.query(`${withItems} WHERE i.id=$1 AND i.user_id=$2 GROUP BY i.id`, [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const inv = rows[0];
    if (!inv.client_email) return res.status(400).json({ error: 'No client email on this invoice' });

    const { rows: cs } = await pool.query('SELECT * FROM company_settings WHERE user_id=$1', [req.user.id]);
    const settings = cs[0] || {};

    // Upsert upload token
    let { rows: existing } = await pool.query('SELECT id, upload_token FROM payment_receipts WHERE invoice_id=$1 ORDER BY created_at DESC LIMIT 1', [inv.id]);
    let uploadToken;
    if (existing.length) {
      uploadToken = existing[0].upload_token;
    } else {
      uploadToken = crypto.randomBytes(32).toString('hex');
      await pool.query(
        'INSERT INTO payment_receipts (invoice_id,upload_token,client_name,client_email,currency) VALUES ($1,$2,$3,$4,$5)',
        [inv.id, uploadToken, inv.client_name, inv.client_email, settings.default_currency||'USD']
      );
    }
    const uploadUrl = `${process.env.FRONTEND_URL||'http://localhost:5173'}/pay/${uploadToken}`;

    const subtotal = (inv.items||[]).reduce((s, i) => s + Number(i.rate)*Number(i.quantity), 0);
    const total = subtotal * (1 + Number(inv.tax_percentage||0)/100);

    let pdfBuffer = null;
    if (pdfBase64) pdfBuffer = Buffer.from(pdfBase64, 'base64');

    await sendInvoiceEmail({
      to: inv.client_email, clientName: inv.client_name, invoiceNumber: inv.invoice_number,
      dueDate: inv.due_date, amount: total, currency: settings.default_currency||'USD',
      companyName: settings.company_name||'Your Company', pdfBuffer, uploadUrl,
    });

    // Record when invoice was sent
    await pool.query('UPDATE invoices SET invoice_sent_at=NOW(), updated_at=NOW() WHERE id=$1', [req.params.id]);

    res.json({ success: true, uploadUrl });
  } catch (err) {
    console.error('Send email error:', err.message);
    res.status(500).json({ error: 'Failed to send email: ' + err.message });
  }
});

// PUT /api/invoices/:id
router.put('/:id', async (req, res) => {
  const { invoiceNumber, clientName, clientEmail, clientAddress, issueDate, dueDate,
    items, taxPercentage, notes, status, partialPercentage } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT id FROM invoices WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!check.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Invoice not found' }); }
    const finalStatus = status && VALID_STATUSES.includes(status) ? status : undefined;
    const { rows } = await client.query(
      `UPDATE invoices SET invoice_number=COALESCE($1,invoice_number),client_name=COALESCE($2,client_name),
       client_email=COALESCE($3,client_email),client_address=COALESCE($4,client_address),
       issue_date=COALESCE($5,issue_date),due_date=COALESCE($6,due_date),
       tax_percentage=COALESCE($7,tax_percentage),notes=COALESCE($8,notes),
       status=COALESCE($9,status),partial_percentage=COALESCE($10,partial_percentage),updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [invoiceNumber,clientName,clientEmail,clientAddress,issueDate,dueDate,taxPercentage,notes,finalStatus,partialPercentage,req.params.id]
    );
    let finalItems = null;
    if (items && Array.isArray(items)) {
      await client.query('DELETE FROM invoice_items WHERE invoice_id=$1', [req.params.id]);
      finalItems = [];
      for (const item of items) {
        const { rows: ir } = await client.query('INSERT INTO invoice_items (invoice_id,description,rate,quantity) VALUES ($1,$2,$3,$4) RETURNING *', [req.params.id, item.description, item.rate||0, item.quantity||1]);
        finalItems.push(ir[0]);
      }
    }
    await client.query('COMMIT');
    res.json({ invoice: { ...rows[0], items: finalItems } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
});

// PATCH /api/invoices/:id/status
router.patch('/:id/status', async (req, res) => {
  const { status, partialPercentage } = req.body;
  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: `Invalid status` });
  try {
    const { rows } = await pool.query(
      'UPDATE invoices SET status=$1,partial_percentage=COALESCE($2,partial_percentage),updated_at=NOW() WHERE id=$3 AND user_id=$4 RETURNING *',
      [status, partialPercentage||null, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ invoice: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/invoices/:id/duplicate
router.post('/:id/duplicate', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: o } = await client.query(
      `SELECT i.*,json_agg(json_build_object('description',ii.description,'rate',ii.rate,'quantity',ii.quantity)) AS items
       FROM invoices i LEFT JOIN invoice_items ii ON ii.invoice_id=i.id WHERE i.id=$1 AND i.user_id=$2 GROUP BY i.id`,
      [req.params.id, req.user.id]
    );
    if (!o.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    const orig = o[0];
    const { rows: nr } = await client.query(
      `INSERT INTO invoices (user_id,invoice_number,client_name,client_email,client_address,issue_date,due_date,tax_percentage,notes,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unpaid') RETURNING *`,
      [req.user.id, `INV-${Date.now().toString().slice(-6)}`, orig.client_name, orig.client_email, orig.client_address, orig.issue_date, orig.due_date, orig.tax_percentage, orig.notes]
    );
    const ni = nr[0]; const newItems = [];
    for (const item of (orig.items||[])) {
      const { rows: ir } = await client.query('INSERT INTO invoice_items (invoice_id,description,rate,quantity) VALUES ($1,$2,$3,$4) RETURNING *', [ni.id, item.description, item.rate, item.quantity]);
      newItems.push(ir[0]);
    }
    await client.query('COMMIT');
    res.status(201).json({ invoice: { ...ni, items: newItems } });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: 'Server error' }); }
  finally { client.release(); }
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM invoices WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
