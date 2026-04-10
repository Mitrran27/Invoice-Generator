const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function sendReminderEmail({ to, clientName, invoiceNumber, dueDate, amount, currency, companyName, reminderType }) {
  const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  const formattedDue = new Date(dueDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const now = new Date();
  const sentDateTime = now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  const urgencyMap = {
    '7day': { label: '1 Week Notice', color: '#2563eb', days: '7 days' },
    '3day': { label: '3 Days Notice', color: '#d97706', days: '3 days' },
    '1day': { label: 'Final Reminder — Due Tomorrow!', color: '#dc2626', days: '1 day' },
  };
  const urgency = urgencyMap[reminderType] || urgencyMap['3day'];
  const subjectMap = {
    '7day': `Payment Reminder (1 week): Invoice ${invoiceNumber} due ${formattedDue}`,
    '3day': `Payment Reminder (3 days): Invoice ${invoiceNumber} due ${formattedDue}`,
    '1day': `FINAL REMINDER: Invoice ${invoiceNumber} due TOMORROW — ${formattedDue}`,
  };
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>
    body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
    .c{background:#fff;max-width:580px;margin:0 auto;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
    .h{background:#1a1a2e;color:#fff;padding:28px 32px}
    .badge{display:inline-block;background:${urgency.color};color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:8px}
    .b{padding:32px;color:#333}
    .box{background:#f9f9f9;border:1px solid #e0e0e0;border-left:4px solid ${urgency.color};border-radius:6px;padding:20px;margin:20px 0}
    .lbl{color:#888;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
    .val{font-weight:600;color:#1a1a2e;font-size:15px}
    .amt{font-size:26px;font-weight:bold;color:${urgency.color};margin-top:4px}
    .sent{background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:12px 16px;margin-top:16px;font-size:12px;color:#0369a1}
    .ft{text-align:center;font-size:11px;color:#aaa;padding:20px 32px;border-top:1px solid #f0f0f0}
  </style></head><body>
  <div class="c">
    <div class="h"><div class="badge">${urgency.label}</div><h1 style="margin:0">Payment Reminder</h1><p style="margin:4px 0 0;opacity:.7;font-size:13px">from ${companyName}</p></div>
    <div class="b">
      <p>Dear <strong>${clientName}</strong>,</p>
      <p>This is a reminder that your invoice is due in <strong>${urgency.days}</strong>.</p>
      <div class="box">
        <p><span class="lbl">Invoice Number</span></p><p class="val">${invoiceNumber}</p>
        <p style="margin-top:14px"><span class="lbl">Due Date</span></p><p class="val" style="color:#dc2626">${formattedDue}</p>
        <p style="margin-top:14px"><span class="lbl">Amount Due</span></p><p class="amt">${formattedAmount}</p>
      </div>
      <div class="sent">📧 This reminder was sent on <strong>${sentDateTime}</strong></div>
      <p style="margin-top:20px">If you have already made this payment, please disregard this message. Thank you!</p>
      <p style="margin-top:24px">Best regards,<br/><strong>${companyName}</strong></p>
    </div>
    <div class="ft">Automated reminder by Invoice Generator</div>
  </div></body></html>`;
  await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject: subjectMap[reminderType] || subjectMap['3day'], html });
  return sentDateTime;
}

async function sendInvoiceEmail({ to, clientName, invoiceNumber, dueDate, amount, currency, companyName, pdfBuffer, uploadUrl }) {
  const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  const formattedDue = new Date(dueDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const uploadSection = uploadUrl ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:20px 0;text-align:center">
      <p style="margin:0 0 12px;font-size:13px;color:#166534;font-weight:600">✅ Made your payment? Let us know!</p>
      <a href="${uploadUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px">
        📎 Upload Payment Proof
      </a>
      <p style="margin:10px 0 0;font-size:11px;color:#6b7280">Upload your bank receipt, transfer screenshot, or payment confirmation</p>
    </div>` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>
    body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
    .c{background:#fff;max-width:580px;margin:0 auto;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
    .h{background:#1a1a2e;color:#fff;padding:28px 32px}
    .b{padding:32px;color:#333}
    .box{background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;padding:20px;margin:20px 0}
    .lbl{color:#888;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
    .amt{font-size:26px;font-weight:bold;color:#1a1a2e}
    .btn{display:inline-block;background:#1a1a2e;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;margin-top:8px}
    .ft{text-align:center;font-size:11px;color:#aaa;padding:20px 32px;border-top:1px solid #f0f0f0}
  </style></head><body>
  <div class="c">
    <div class="h"><h1 style="margin:0">Invoice from ${companyName}</h1></div>
    <div class="b">
      <p>Dear <strong>${clientName}</strong>,</p>
      <p>Please find your invoice attached and details below.</p>
      <div class="box">
        <p><span class="lbl">Invoice Number</span></p><p style="font-weight:600;font-size:15px">${invoiceNumber}</p>
        <p style="margin-top:14px"><span class="lbl">Due Date</span></p><p style="font-weight:600;color:#dc2626">${formattedDue}</p>
        <p style="margin-top:14px"><span class="lbl">Amount Due</span></p><p class="amt">${formattedAmount}</p>
      </div>
      ${uploadSection}
      <p>The invoice PDF is attached to this email for your records.</p>
      <p style="margin-top:24px">Best regards,<br/><strong>${companyName}</strong></p>
    </div>
    <div class="ft">Sent via Invoice Generator</div>
  </div></body></html>`;

  const mailOpts = {
    from: process.env.SMTP_FROM,
    to,
    subject: `Invoice ${invoiceNumber} from ${companyName} — Due ${formattedDue}`,
    html,
  };

  if (pdfBuffer) {
    mailOpts.attachments = [{
      filename: `Invoice-${invoiceNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }];
  }

  await transporter.sendMail(mailOpts);
}

async function sendPaymentReceivedEmail({ to, companyName, clientName, invoiceNumber, amountPaid, currency, receiptId, autoStatus, detectedAmount }) {
  const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amountPaid);
  const detectedNote = detectedAmount !== null && detectedAmount !== undefined
    ? `<p style="font-size:12px;color:#6b7280;margin-top:6px">🔍 Amount auto-detected from receipt image: <strong>${new Intl.NumberFormat('en-US',{style:'currency',currency:currency||'USD'}).format(detectedAmount)}</strong></p>`
    : '';
  const statusLabel = autoStatus === 'approved' ? '✅ Payment Verified' : autoStatus === 'mismatch' ? '⚠️ Amount Mismatch' : '🔍 Under Review';
  const statusColor = autoStatus === 'approved' ? '#16a34a' : autoStatus === 'mismatch' ? '#d97706' : '#2563eb';

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Payment Receipt Received — Invoice ${invoiceNumber}`,
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0">
    <div style="background:#fff;max-width:540px;margin:0 auto;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
      <div style="background:#1a1a2e;color:#fff;padding:28px 32px">
        <h1 style="margin:0;font-size:20px">Payment Receipt Received</h1>
        <p style="margin:4px 0 0;opacity:.7;font-size:13px">for Invoice ${invoiceNumber}</p>
      </div>
      <div style="padding:32px;color:#333">
        <p>A payment receipt has been submitted by <strong>${clientName}</strong>.</p>
        <div style="background:#f9f9f9;border:1px solid #e0e0e0;border-left:4px solid ${statusColor};border-radius:6px;padding:20px;margin:20px 0">
          <p style="margin:0 0 8px"><span style="color:#888;font-size:12px;text-transform:uppercase">Amount Paid</span></p>
          <p style="font-size:24px;font-weight:bold;color:${statusColor};margin:0">${formattedAmount}</p>
          ${detectedNote}
          <p style="margin:12px 0 4px"><span style="font-size:12px;font-weight:600;background:${statusColor};color:#fff;padding:3px 10px;border-radius:12px">${statusLabel}</span></p>
        </div>
        <p style="font-size:13px;color:#6b7280">Please log in to your Invoice Generator dashboard to review and approve or reject this receipt.</p>
      </div>
      <div style="text-align:center;font-size:11px;color:#aaa;padding:16px 32px;border-top:1px solid #f0f0f0">Invoice Generator — Payment Notification</div>
    </div></body></html>`,
  });
}

async function sendWelcomeEmail({ to, name }) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Welcome to Invoice Generator!',
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h2 style="color:#1a1a2e">Welcome, ${name}! 🎉</h2>
      <p>Your Invoice Generator account has been created successfully.</p>
      <p>You can now create professional invoices, manage clients, and track payments.</p>
      <p style="margin-top:24px;color:#888;font-size:13px">Invoice Generator Team</p>
    </div>`,
  });
}

module.exports = { sendReminderEmail, sendInvoiceEmail, sendPaymentReceivedEmail, sendWelcomeEmail };
