const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const auth = require('../middleware/auth');
const { sendInvoiceEmail } = require('../services/mailer');

// All invoice routes require auth
router.use(auth);

const VALID_STATUSES = ['paid','unpaid','pending','partial','failed','cancelled','refunded','expired','processing','overdue'];

const withItems = `
  SELECT i.*,
    COALESCE(json_agg(
      json_build_object(
        'id', ii.id,
        'description', ii.description,
        'rate', ii.rate,
        'quantity', ii.quantity
      ) ORDER BY ii.created_at
    ) FILTER (WHERE ii.id IS NOT NULL), '[]') AS items
  FROM invoices i
  LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
`;

// GET /api/invoices
router.get('/', async (req, res) => {
  try {
    const { rows: invoices } = await pool.query(
      `${withItems} WHERE i.user_id = $1 GROUP BY i.id ORDER BY i.created_at DESC`,
      [req.user.id]
    );
    res.json({ invoices });
  } catch (err) {
    console.error('Get invoices error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${withItems} WHERE i.id = $1 AND i.user_id = $2 GROUP BY i.id`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ invoice: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/invoices/:id/reminder-logs
router.get('/:id/reminder-logs', async (req, res) => {
  try {
    // Verify ownership
    const check = await pool.query('SELECT id FROM invoices WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });

    const { rows } = await pool.query(
      `SELECT * FROM reminder_logs WHERE invoice_id = $1 ORDER BY sent_at DESC`,
      [req.params.id]
    );
    res.json({ logs: rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/invoices
router.post('/', async (req, res) => {
  const {
    invoiceNumber, clientName, clientEmail, clientAddress,
    issueDate, dueDate, items, taxPercentage, notes, status,
    partialPercentage, sendEmailNow
  } = req.body;

  if (!invoiceNumber || !clientName || !issueDate || !dueDate)
    return res.status(400).json({ error: 'invoiceNumber, clientName, issueDate, dueDate are required' });
  if (!items || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'At least one item is required' });

  const finalStatus = status && VALID_STATUSES.includes(status) ? status : 'unpaid';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO invoices
        (user_id, invoice_number, client_name, client_email, client_address, issue_date, due_date,
         tax_percentage, notes, status, partial_percentage)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.id, invoiceNumber, clientName, clientEmail || '', clientAddress || '',
       issueDate, dueDate, taxPercentage || 0, notes || '', finalStatus,
       partialPercentage || 0]
    );
    const invoice = rows[0];

    const insertedItems = [];
    for (const item of items) {
      const { rows: ir } = await client.query(
        `INSERT INTO invoice_items (invoice_id, description, rate, quantity) VALUES ($1,$2,$3,$4) RETURNING *`,
        [invoice.id, item.description, item.rate || 0, item.quantity || 1]
      );
      insertedItems.push(ir[0]);
    }

    await client.query('COMMIT');

    // Optionally send invoice email immediately
    if (sendEmailNow && clientEmail) {
      const subtotal = insertedItems.reduce((s, i) => s + Number(i.rate) * Number(i.quantity), 0);
      const total = subtotal * (1 + Number(taxPercentage || 0) / 100);
      const { rows: cs } = await pool.query('SELECT * FROM company_settings WHERE user_id = $1', [req.user.id]);
      const settings = cs[0] || {};
      sendInvoiceEmail({
        to: clientEmail,
        clientName,
        invoiceNumber,
        dueDate,
        amount: total,
        currency: settings.default_currency || 'USD',
        companyName: settings.company_name || 'Your Company',
      }).catch(console.error);
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

// PUT /api/invoices/:id
router.put('/:id', async (req, res) => {
  const {
    invoiceNumber, clientName, clientEmail, clientAddress,
    issueDate, dueDate, items, taxPercentage, notes, status, partialPercentage
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const check = await client.query('SELECT id FROM invoices WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const finalStatus = status && VALID_STATUSES.includes(status) ? status : undefined;

    const { rows } = await client.query(
      `UPDATE invoices SET
        invoice_number = COALESCE($1, invoice_number),
        client_name = COALESCE($2, client_name),
        client_email = COALESCE($3, client_email),
        client_address = COALESCE($4, client_address),
        issue_date = COALESCE($5, issue_date),
        due_date = COALESCE($6, due_date),
        tax_percentage = COALESCE($7, tax_percentage),
        notes = COALESCE($8, notes),
        status = COALESCE($9, status),
        partial_percentage = COALESCE($10, partial_percentage),
        updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [invoiceNumber, clientName, clientEmail, clientAddress, issueDate, dueDate,
       taxPercentage, notes, finalStatus, partialPercentage, req.params.id]
    );

    let finalItems = null;
    if (items && Array.isArray(items)) {
      await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
      finalItems = [];
      for (const item of items) {
        const { rows: ir } = await client.query(
          `INSERT INTO invoice_items (invoice_id, description, rate, quantity) VALUES ($1,$2,$3,$4) RETURNING *`,
          [req.params.id, item.description, item.rate || 0, item.quantity || 1]
        );
        finalItems.push(ir[0]);
      }
    }

    await client.query('COMMIT');
    res.json({ invoice: { ...rows[0], items: finalItems } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update invoice error:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// PATCH /api/invoices/:id/status
router.patch('/:id/status', async (req, res) => {
  const { status, partialPercentage } = req.body;
  if (!VALID_STATUSES.includes(status))
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });

  try {
    const { rows } = await pool.query(
      `UPDATE invoices SET
        status = $1,
        partial_percentage = COALESCE($2, partial_percentage),
        updated_at = NOW()
       WHERE id = $3 AND user_id = $4 RETURNING *`,
      [status, partialPercentage || null, req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ invoice: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/invoices/:id/duplicate
router.post('/:id/duplicate', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: origRows } = await client.query(
      `SELECT i.*, json_agg(json_build_object('description', ii.description, 'rate', ii.rate, 'quantity', ii.quantity)) AS items
       FROM invoices i LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE i.id = $1 AND i.user_id = $2
       GROUP BY i.id`,
      [req.params.id, req.user.id]
    );
    if (origRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const orig = origRows[0];
    const { rows: newRows } = await client.query(
      `INSERT INTO invoices
        (user_id, invoice_number, client_name, client_email, client_address, issue_date, due_date, tax_percentage, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unpaid') RETURNING *`,
      [req.user.id, `INV-${Date.now().toString().slice(-6)}`, orig.client_name,
       orig.client_email, orig.client_address, orig.issue_date, orig.due_date,
       orig.tax_percentage, orig.notes]
    );
    const newInvoice = newRows[0];

    const newItems = [];
    for (const item of (orig.items || [])) {
      const { rows: ir } = await client.query(
        `INSERT INTO invoice_items (invoice_id, description, rate, quantity) VALUES ($1,$2,$3,$4) RETURNING *`,
        [newInvoice.id, item.description, item.rate, item.quantity]
      );
      newItems.push(ir[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ invoice: { ...newInvoice, items: newItems } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM invoices WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
