const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { sendPaymentReceivedEmail } = require('../services/mailer');

// Store files as base64 in DB (no filesystem dependency)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|webp/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype.replace('application/', '').replace('image/', ''));
    cb(ok ? null : new Error('Only images and PDFs allowed'), ok);
  },
});

// ─── PUBLIC endpoints (no auth — accessed by client via email link) ──────────

// GET /api/receipts/upload/:token — get invoice info for upload page
router.get('/upload/:token', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pr.*, i.invoice_number, i.client_name, i.client_email,
              i.due_date, i.tax_percentage, i.status,
              COALESCE(SUM(ii.rate*ii.quantity),0) * (1 + i.tax_percentage/100) AS invoice_total,
              cs.company_name, cs.default_currency
       FROM payment_receipts pr
       JOIN invoices i ON pr.invoice_id = i.id
       JOIN users u ON i.user_id = u.id
       LEFT JOIN company_settings cs ON cs.user_id = u.id
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE pr.upload_token = $1
       GROUP BY pr.id, i.invoice_number, i.client_name, i.client_email,
                i.due_date, i.tax_percentage, i.status, cs.company_name, cs.default_currency`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invalid or expired link' });
    const r = rows[0];
    res.json({
      invoiceNumber: r.invoice_number,
      clientName: r.client_name,
      clientEmail: r.client_email,
      dueDate: r.due_date,
      invoiceTotal: parseFloat(r.invoice_total),
      currency: r.default_currency || 'USD',
      companyName: r.company_name || 'Your Company',
      invoiceStatus: r.status,
      existingReceipt: r.file_url ? {
        status: r.status,
        amountPaid: r.amount_paid,
        paymentDate: r.payment_date,
        createdAt: r.created_at,
      } : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/receipts/upload/:token — client submits payment proof
router.post('/upload/:token', upload.single('receipt'), async (req, res) => {
  try {
    const { amountPaid, paymentMethod, paymentDate, notes, clientName, clientEmail } = req.body;

    const { rows } = await pool.query(
      `SELECT pr.*, i.invoice_number, i.user_id, i.client_name,
              COALESCE(SUM(ii.rate*ii.quantity),0) * (1 + i.tax_percentage/100) AS invoice_total,
              cs.company_name, cs.default_currency, u.email AS owner_email
       FROM payment_receipts pr
       JOIN invoices i ON pr.invoice_id = i.id
       JOIN users u ON i.user_id = u.id
       LEFT JOIN company_settings cs ON cs.user_id = u.id
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE pr.upload_token = $1
       GROUP BY pr.id, i.invoice_number, i.user_id, i.client_name,
                i.tax_percentage, cs.company_name, cs.default_currency, u.email`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invalid or expired link' });
    const receipt = rows[0];

    const paidAmt = parseFloat(amountPaid) || 0;
    const invoiceAmt = parseFloat(receipt.invoice_total) || 0;
    const tolerance = invoiceAmt * 0.01; // 1% tolerance
    let autoStatus = 'pending_review';
    if (paidAmt >= invoiceAmt - tolerance) autoStatus = 'approved';
    else if (paidAmt > 0 && paidAmt < invoiceAmt) autoStatus = 'mismatch';

    // Save file as base64 if provided
    let fileUrl = null, fileName = null, fileType = null, fileData = null;
    if (req.file) {
      fileData = req.file.buffer.toString('base64');
      fileName = req.file.originalname;
      fileType = req.file.mimetype;
      fileUrl = `data:${fileType};base64,${fileData}`;
    }

    // Update receipt record
    await pool.query(
      `UPDATE payment_receipts SET
         client_name = COALESCE($1, client_name),
         client_email = COALESCE($2, client_email),
         amount_paid = $3,
         payment_method = $4,
         payment_date = $5,
         notes = $6,
         file_url = COALESCE($7, file_url),
         file_name = COALESCE($8, file_name),
         file_type = COALESCE($9, file_type),
         file_data = COALESCE($10, file_data),
         auto_status = $11,
         status = 'pending_review',
         updated_at = NOW()
       WHERE upload_token = $12`,
      [clientName||null, clientEmail||null, paidAmt, paymentMethod||'', paymentDate||null, notes||'',
       fileUrl, fileName, fileType, fileData, autoStatus, req.params.token]
    );

    // Auto-update invoice status if amount matches
    if (autoStatus === 'approved') {
      await pool.query(
        "UPDATE invoices SET status='paid', updated_at=NOW() WHERE id=$1",
        [receipt.invoice_id]
      );
    } else if (autoStatus === 'mismatch') {
      await pool.query(
        "UPDATE invoices SET status='partial', updated_at=NOW() WHERE id=$1",
        [receipt.invoice_id]
      );
    }

    // Create notification for invoice owner
    const notifTitle = autoStatus === 'approved'
      ? `Payment received for Invoice ${receipt.invoice_number}`
      : autoStatus === 'mismatch'
      ? `⚠️ Amount mismatch on Invoice ${receipt.invoice_number}`
      : `Payment receipt submitted for Invoice ${receipt.invoice_number}`;
    const notifMsg = autoStatus === 'approved'
      ? `${clientName || receipt.client_name} paid the full amount. Please review and confirm.`
      : autoStatus === 'mismatch'
      ? `${clientName || receipt.client_name} paid ${new Intl.NumberFormat('en-US',{style:'currency',currency:receipt.default_currency||'USD'}).format(paidAmt)} but invoice total is ${new Intl.NumberFormat('en-US',{style:'currency',currency:receipt.default_currency||'USD'}).format(invoiceAmt)}. Review required.`
      : `${clientName || receipt.client_name} submitted a payment receipt. Please verify.`;

    await pool.query(
      'INSERT INTO notifications (user_id,invoice_id,receipt_id,type,title,message) VALUES ($1,$2,$3,$4,$5,$6)',
      [receipt.user_id, receipt.invoice_id, receipt.id, 'payment_received', notifTitle, notifMsg]
    );

    // Email the owner
    if (receipt.owner_email) {
      sendPaymentReceivedEmail({
        to: receipt.owner_email,
        companyName: receipt.company_name || 'Your Company',
        clientName: clientName || receipt.client_name,
        invoiceNumber: receipt.invoice_number,
        amountPaid: paidAmt,
        currency: receipt.default_currency || 'USD',
        receiptId: receipt.id,
        autoStatus,
      }).catch(console.error);
    }

    res.json({ success: true, autoStatus, message: 'Receipt submitted successfully. The invoice owner will review your payment.' });
  } catch (err) {
    console.error('Upload receipt error:', err.message);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ─── PROTECTED endpoints (require auth — for dashboard) ──────────────────────

// GET /api/receipts — get all receipts for this user's invoices
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pr.*, i.invoice_number, i.client_name as inv_client_name,
              COALESCE(SUM(ii.rate*ii.quantity),0) * (1+i.tax_percentage/100) AS invoice_total,
              cs.default_currency
       FROM payment_receipts pr
       JOIN invoices i ON pr.invoice_id = i.id
       LEFT JOIN company_settings cs ON cs.user_id = i.user_id
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE i.user_id = $1
       GROUP BY pr.id, i.invoice_number, i.client_name, i.tax_percentage, cs.default_currency
       ORDER BY pr.created_at DESC`,
      [req.user.id]
    );
    res.json({ receipts: rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/receipts/invoice/:invoiceId — receipts for a specific invoice
router.get('/invoice/:invoiceId', auth, async (req, res) => {
  try {
    // Verify ownership
    const check = await pool.query('SELECT id FROM invoices WHERE id=$1 AND user_id=$2', [req.params.invoiceId, req.user.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const { rows } = await pool.query('SELECT * FROM payment_receipts WHERE invoice_id=$1 ORDER BY created_at DESC', [req.params.invoiceId]);
    res.json({ receipts: rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/receipts/:id — single receipt with file
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pr.*, i.invoice_number, i.user_id FROM payment_receipts pr JOIN invoices i ON pr.invoice_id=i.id WHERE pr.id=$1`,
      [req.params.id]
    );
    if (!rows.length || rows[0].user_id !== req.user.id) return res.status(404).json({ error: 'Not found' });
    res.json({ receipt: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/receipts/:id/review — approve or reject receipt
router.patch('/:id/review', auth, async (req, res) => {
  const { status, reviewerNotes } = req.body;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status must be approved or rejected' });

  try {
    const { rows: existing } = await pool.query(
      `SELECT pr.*, i.user_id, i.id AS invoice_id FROM payment_receipts pr JOIN invoices i ON pr.invoice_id=i.id WHERE pr.id=$1`,
      [req.params.id]
    );
    if (!existing.length || existing[0].user_id !== req.user.id) return res.status(404).json({ error: 'Not found' });

    const { rows } = await pool.query(
      'UPDATE payment_receipts SET status=$1,reviewer_notes=$2,reviewed_at=NOW(),updated_at=NOW() WHERE id=$3 RETURNING *',
      [status, reviewerNotes||'', req.params.id]
    );

    // Update invoice status based on review
    if (status === 'approved') {
      await pool.query("UPDATE invoices SET status='paid',updated_at=NOW() WHERE id=$1", [existing[0].invoice_id]);
    } else if (status === 'rejected') {
      await pool.query("UPDATE invoices SET status='unpaid',updated_at=NOW() WHERE id=$1", [existing[0].invoice_id]);
    }

    res.json({ receipt: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/receipts/invoice/:invoiceId/generate-link — generate upload link
router.post('/invoice/:invoiceId/generate-link', auth, async (req, res) => {
  try {
    const check = await pool.query('SELECT * FROM invoices WHERE id=$1 AND user_id=$2', [req.params.invoiceId, req.user.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const inv = check.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      'INSERT INTO payment_receipts (invoice_id,upload_token,client_name,client_email,currency) VALUES ($1,$2,$3,$4,$5)',
      [req.params.invoiceId, token, inv.client_name, inv.client_email, 'USD']
    );
    const url = `${process.env.FRONTEND_URL||'http://localhost:5173'}/pay/${token}`;
    res.json({ uploadUrl: url, token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
