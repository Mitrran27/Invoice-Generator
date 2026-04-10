const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { sendPaymentReceivedEmail } = require('../services/mailer');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = /image\/(jpeg|jpg|png|gif|webp)|application\/pdf/.test(file.mimetype);
    cb(extOk && mimeOk ? null : new Error('Only images and PDFs allowed'), extOk && mimeOk);
  },
});

// ── Receipt amount detection: PDF text extraction + image OCR (free, local) ──
//
// Strategy:
//   • PDF (digital bank receipts like Maybank, CIMB, RHB): extract embedded
//     text directly with pdfjs-dist — 100% accurate, no OCR needed.
//   • Images (screenshots, photos): preprocess with sharp then run Tesseract.
//
// Amount parsing handles the common receipt layout where the keyword "Amount"
// appears on one line and "RM 10.00" appears on the very next line.

const Tesseract = require('tesseract.js');
const sharp = require('sharp');

// ── PDF text extraction via pdfjs-dist (ESM, dynamic import) ──────────────────
async function extractTextFromPdf(buffer) {
  // Must use the legacy build in Node.js — the main build requires browser APIs
  // (DOMMatrix, Path2D, etc.) that don't exist in Node.
  // DOMMatrix itself is also missing in Node <19, so polyfill it globally before
  // loading pdfjs so the library's internal matrix math doesn't throw.
  //
  // if (typeof globalThis.DOMMatrix === 'undefined') {
  //   const { DOMMatrix } = await import('canvas');
  //   globalThis.DOMMatrix = DOMMatrix;
  // }
  if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = class DOMMatrix {
      constructor(init) { /* set a,b,c,d,e,f from array */ }
      multiply(other) { /* 2D matrix multiply */ }
    };
  }

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { getDocument } = pdfjsLib.default ?? pdfjsLib;

  const doc = await getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join('  ') + '\n';
  }
  return text;
}

// ── Core amount parser — works on both PDF-extracted and OCR text ─────────────
function parseAmountFromText(rawText) {
  // Split on double-spaces (pdfjs separator) and newlines
  const lines = rawText.split(/\n|  +/).map(l => l.trim()).filter(Boolean);

  // Keywords that label the total on a receipt (standalone line or inline)
  const totalKwLine = /^\s*(grand\s*total|total\s*amount|amount\s*due|amount\s*paid|net\s*total|total\s*payable|total\s*payment|total|amount|paid|due)\s*$/i;
  const totalKwInline = /\b(total|amount|paid|due)\b/i;

  // Amount pattern: requires currency symbol OR decimal point to avoid matching
  // bare integers like account numbers, reference IDs, phone numbers
  const amtPattern = /(?:rm|usd|myr|sgd|gbp|eur|\$|£|€|¥|฿)\s*([\d,]+\.?\d*)|(?<![.\d])([\d,]+\.\d{2})(?![.\d])/gi;

  const candidates = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Case 1: keyword + amount on the SAME line ("Total: RM 50.00", "Amount RM10.00")
    if (totalKwInline.test(line)) {
      for (const m of line.matchAll(amtPattern)) {
        const val = parseFloat((m[1] || m[2]).replace(/,/g, ''));
        if (!isNaN(val) && val > 0 && val < 1_000_000) {
          console.log(`  [same-line] "${line}" → ${val}`);
          candidates.push(val);
        }
      }
    }

    // Case 2: keyword ALONE on a line, amount on the NEXT line (Maybank/CIMB style)
    //   "Amount"
    //   "RM 10.00"
    if (totalKwLine.test(line) && i + 1 < lines.length) {
      const next = lines[i + 1];
      for (const m of next.matchAll(amtPattern)) {
        const val = parseFloat((m[1] || m[2]).replace(/,/g, ''));
        if (!isNaN(val) && val > 0 && val < 1_000_000) {
          console.log(`  [next-line] "${line}" / "${next}" → ${val}`);
          candidates.push(val);
        }
      }
    }
  }

  // Fallback: find any currency-prefixed amount anywhere in the text
  if (!candidates.length) {
    for (const m of rawText.matchAll(amtPattern)) {
      const val = parseFloat((m[1] || m[2]).replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && val < 1_000_000) candidates.push(val);
    }
    if (candidates.length) console.log(`  [fallback] currency amounts found:`, candidates);
  }

  if (!candidates.length) return null;

  // Pick the largest (grand total is usually the biggest number)
  // but exclude year-like values (1990–2099) — could appear in dates on receipts
  const filtered = candidates.filter(n => !(n >= 1990 && n <= 2099));
  return filtered.length ? parseFloat(Math.max(...filtered).toFixed(2)) : null;
}

// ── Main detector — called for every uploaded file ────────────────────────────
async function detectAmountFromFile(fileBuffer, fileMime) {
  try {
    let text = '';

    if (fileMime === 'application/pdf') {
      // ── Digital PDF (Maybank, CIMB, RHB, DuitNow, etc.) ──────────────────
      // Text is already embedded — no OCR required. Fast and 100% accurate.
      console.log('📄 PDF detected — extracting embedded text with pdfjs-dist');
      text = await extractTextFromPdf(fileBuffer);

    } else if (fileMime.startsWith('image/')) {
      // ── Image (screenshot, phone photo, scanned slip) ─────────────────────
      // Preprocess: greyscale + normalise contrast + sharpen for better OCR
      console.log('🖼️  Image detected — running Tesseract OCR');
      const processed = await sharp(fileBuffer)
        .greyscale()
        .normalise()
        .sharpen()
        .png()
        .toBuffer();
      const { data } = await Tesseract.recognize(processed, 'eng', { logger: () => {} });
      text = data.text;

    } else {
      console.log('⚠️  Unsupported file type for OCR:', fileMime);
      return null;
    }

    if (!text || !text.trim()) {
      console.log('⚠️  No text extracted from file');
      return null;
    }

    console.log(`📝 Extracted text (first 300 chars): "${text.slice(0, 300).replace(/\n/g, ' | ')}"`);

    const amount = parseAmountFromText(text);
    console.log(`💰 OCR detected amount: ${amount}`);
    return amount;

  } catch (err) {
    console.error('❌ Amount detection error:', err.message);
    return null;
  }
}

// ── PUBLIC ────────────────────────────────────────────────────────────────────

// GET /api/receipts/upload/:token
router.get('/upload/:token', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pr.*, i.invoice_number, i.client_name, i.client_email,
              i.due_date, i.tax_percentage, i.status,
              COALESCE(SUM(ii.rate*ii.quantity),0) * (1 + i.tax_percentage/100) AS invoice_total,
              cs.company_name, cs.default_currency, cs.company_logo,
              cs.company_address, cs.phone, cs.website,
              cs.twitter, cs.linkedin, cs.facebook
       FROM payment_receipts pr
       JOIN invoices i ON pr.invoice_id = i.id
       JOIN users u ON i.user_id = u.id
       LEFT JOIN company_settings cs ON cs.user_id = u.id
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE pr.upload_token = $1
       GROUP BY pr.id, i.invoice_number, i.client_name, i.client_email,
                i.due_date, i.tax_percentage, i.status, cs.company_name, cs.default_currency,
                cs.company_logo, cs.company_address, cs.phone, cs.website,
                cs.twitter, cs.linkedin, cs.facebook`,
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
      companyLogo: r.company_logo || '',
      companyAddress: r.company_address || '',
      phone: r.phone || '',
      website: r.website || '',
      twitter: r.twitter || '',
      linkedin: r.linkedin || '',
      facebook: r.facebook || '',
      invoiceStatus: r.status,
      existingReceipt: r.amount_paid ? {
        status: r.status, amountPaid: r.amount_paid,
        paymentDate: r.payment_date, createdAt: r.created_at,
      } : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/receipts/upload/:token — client submits proof
router.post('/upload/:token', upload.single('receipt'), async (req, res) => {
  try {
    const { paymentMethod, paymentDate, notes, clientName, clientEmail } = req.body;

    const { rows } = await pool.query(
      `SELECT pr.*, i.invoice_number, i.user_id, i.client_name, i.id AS inv_id,
              COALESCE(SUM(ii.rate*ii.quantity),0) * (1 + i.tax_percentage/100) AS invoice_total,
              cs.company_name, cs.default_currency, u.email AS owner_email
       FROM payment_receipts pr
       JOIN invoices i ON pr.invoice_id = i.id
       JOIN users u ON i.user_id = u.id
       LEFT JOIN company_settings cs ON cs.user_id = u.id
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE pr.upload_token = $1
       GROUP BY pr.id, i.invoice_number, i.user_id, i.client_name, i.id,
                i.tax_percentage, cs.company_name, cs.default_currency, u.email`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invalid or expired link' });
    const receipt = rows[0];

    // ── OCR: detect amount from uploaded file ─────────────────────────────
    let detectedAmount = null;
    let fileUrl = null, fileName = null, fileType = null, fileData = null;

    if (req.file) {
      fileData = req.file.buffer.toString('base64');
      fileName = req.file.originalname;
      fileType = req.file.mimetype;
      fileUrl = `data:${fileType};base64,${fileData}`;

      // Try to detect amount from image
      detectedAmount = await detectAmountFromFile(req.file.buffer, req.file.mimetype);
      console.log(`💰 OCR detected amount: ${detectedAmount}`);
    }

    // Use detected amount if available; fall back to manually entered amount
    const manualAmount = parseFloat(req.body.amountPaid) || 0;
    const paidAmt = detectedAmount !== null ? detectedAmount : manualAmount;
    const invoiceAmt = parseFloat(receipt.invoice_total) || 0;
    const tolerance = invoiceAmt * 0.02; // 2% tolerance

    let autoStatus = 'pending_review';
    if (paidAmt > 0 && paidAmt >= invoiceAmt - tolerance) autoStatus = 'approved';
    else if (paidAmt > 0 && paidAmt < invoiceAmt) autoStatus = 'mismatch';

    // Update receipt record
    await pool.query(
      `UPDATE payment_receipts SET
         client_name = COALESCE($1, client_name),
         client_email = COALESCE($2, client_email),
         amount_paid = $3,
         detected_amount = $4,
         payment_method = $5,
         payment_date = $6,
         notes = $7,
         file_url = COALESCE($8, file_url),
         file_name = COALESCE($9, file_name),
         file_type = COALESCE($10, file_type),
         file_data = COALESCE($11, file_data),
         auto_status = $12,
         status = 'pending_review',
         updated_at = NOW()
       WHERE upload_token = $13`,
      [clientName||null, clientEmail||null, paidAmt, detectedAmount, paymentMethod||'',
       paymentDate||null, notes||'', fileUrl, fileName, fileType, fileData, autoStatus, req.params.token]
    );

    // Set invoice status to pending_payment (NOT paid — owner must approve)
    // Also store amount_paid on invoice for balance calculation
    await pool.query(
      `UPDATE invoices SET status='pending_payment', amount_paid=$1, updated_at=NOW() WHERE id=$2`,
      [paidAmt, receipt.invoice_id]
    );

    // Create notification
    const notifTitle = autoStatus === 'approved'
      ? `✅ Payment received — Invoice ${receipt.invoice_number} (amount matches)`
      : autoStatus === 'mismatch'
      ? `⚠️ Payment received — Invoice ${receipt.invoice_number} (amount mismatch)`
      : `💳 Payment receipt submitted — Invoice ${receipt.invoice_number}`;
    const detectedNote = detectedAmount !== null ? ` (auto-detected from receipt image)` : '';
    const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: receipt.default_currency || 'USD' }).format(n);
    const notifMsg = autoStatus === 'approved'
      ? `${clientName || receipt.client_name} paid ${fmt(paidAmt)}${detectedNote}. Please review and confirm.`
      : autoStatus === 'mismatch'
      ? `${clientName || receipt.client_name} paid ${fmt(paidAmt)}${detectedNote} but invoice is ${fmt(invoiceAmt)}. Review required.`
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
        autoStatus,
        detectedAmount,
      }).catch(console.error);
    }

    res.json({
      success: true,
      autoStatus,
      detectedAmount,
      amountUsed: paidAmt,
      message: 'Receipt submitted. The invoice owner will review your payment.',
    });
  } catch (err) {
    console.error('Upload receipt error:', err.message);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── PROTECTED ─────────────────────────────────────────────────────────────────

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
       WHERE i.user_id = $1 AND pr.amount_paid IS NOT NULL
       GROUP BY pr.id, i.invoice_number, i.client_name, i.tax_percentage, cs.default_currency
       ORDER BY pr.created_at DESC`,
      [req.user.id]
    );
    res.json({ receipts: rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/invoice/:invoiceId', auth, async (req, res) => {
  try {
    const check = await pool.query('SELECT id FROM invoices WHERE id=$1 AND user_id=$2', [req.params.invoiceId, req.user.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const { rows } = await pool.query('SELECT * FROM payment_receipts WHERE invoice_id=$1 ORDER BY created_at DESC', [req.params.invoiceId]);
    res.json({ receipts: rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

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

// PATCH /api/receipts/:id/review — approve or reject; THIS is where paid/partial is set
router.patch('/:id/review', auth, async (req, res) => {
  const { status, reviewerNotes } = req.body;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status must be approved or rejected' });

  try {
    const { rows: existing } = await pool.query(
      `SELECT pr.*, i.user_id, i.id AS invoice_id,
              COALESCE(SUM(ii.rate*ii.quantity),0) * (1+i.tax_percentage/100) AS invoice_total
       FROM payment_receipts pr
       JOIN invoices i ON pr.invoice_id = i.id
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE pr.id = $1
       GROUP BY pr.id, i.user_id, i.id, i.tax_percentage`,
      [req.params.id]
    );
    if (!existing.length || existing[0].user_id !== req.user.id) return res.status(404).json({ error: 'Not found' });

    const rec = existing[0];
    const { rows } = await pool.query(
      'UPDATE payment_receipts SET status=$1,reviewer_notes=$2,reviewed_at=NOW(),updated_at=NOW() WHERE id=$3 RETURNING *',
      [status, reviewerNotes || '', req.params.id]
    );

    // Update invoice status based on review decision
    if (status === 'approved') {
      const paidAmt = parseFloat(rec.amount_paid) || 0;
      const invoiceAmt = parseFloat(rec.invoice_total) || 0;
      const tolerance = invoiceAmt * 0.02;

      if (paidAmt >= invoiceAmt - tolerance) {
        // Full payment
        await pool.query(
          "UPDATE invoices SET status='paid', amount_paid=$1, updated_at=NOW() WHERE id=$2",
          [paidAmt, rec.invoice_id]
        );
      } else {
        // Partial payment — store balance
        const pct = invoiceAmt > 0 ? Math.round((paidAmt / invoiceAmt) * 100) : 0;
        await pool.query(
          "UPDATE invoices SET status='partial', amount_paid=$1, partial_percentage=$2, updated_at=NOW() WHERE id=$3",
          [paidAmt, pct, rec.invoice_id]
        );
      }
    } else if (status === 'rejected') {
      await pool.query(
        "UPDATE invoices SET status='unpaid', amount_paid=0, updated_at=NOW() WHERE id=$1",
        [rec.invoice_id]
      );
    }

    res.json({ receipt: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

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
    const url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pay/${token}`;
    res.json({ uploadUrl: url, token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
