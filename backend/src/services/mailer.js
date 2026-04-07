const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// reminderType: '7day' | '3day' | '1day'
async function sendReminderEmail({ to, clientName, invoiceNumber, dueDate, amount, currency, companyName, reminderType }) {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);

  const formattedDue = new Date(dueDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const now = new Date();
  const sentDateTime = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const urgencyMap = {
    '7day': { label: '1 Week Notice', color: '#2563eb', days: '7 days' },
    '3day': { label: '3 Days Notice', color: '#d97706', days: '3 days' },
    '1day': { label: 'Final Reminder — Due Tomorrow!', color: '#dc2626', days: '1 day' },
  };
  const urgency = urgencyMap[reminderType] || urgencyMap['3day'];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
        .container { background: #fff; max-width: 580px; margin: 0 auto; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .header { background: #1a1a2e; color: #fff; padding: 28px 32px; }
        .urgency-badge { display: inline-block; background: ${urgency.color}; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 8px; }
        .header h1 { margin: 0; font-size: 22px; }
        .body { padding: 32px; color: #333; }
        .invoice-box { background: #f9f9f9; border: 1px solid #e0e0e0; border-left: 4px solid ${urgency.color}; border-radius: 6px; padding: 20px; margin: 20px 0; }
        .invoice-box p { margin: 6px 0; font-size: 14px; }
        .label { color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
        .value { font-weight: 600; color: #1a1a2e; font-size: 15px; }
        .amount { font-size: 26px; font-weight: bold; color: ${urgency.color}; margin-top: 4px; }
        .sent-info { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 12px 16px; margin-top: 16px; font-size: 12px; color: #0369a1; }
        .footer { text-align: center; font-size: 11px; color: #aaa; padding: 20px 32px; border-top: 1px solid #f0f0f0; }
        .btn { display: inline-block; background: ${urgency.color}; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="urgency-badge">${urgency.label}</div>
          <h1>Payment Reminder</h1>
          <p style="margin:4px 0 0;opacity:0.7;font-size:13px">from ${companyName}</p>
        </div>
        <div class="body">
          <p>Dear <strong>${clientName}</strong>,</p>
          <p>This is a reminder that your invoice is due in <strong>${urgency.days}</strong>. Please arrange payment at your earliest convenience.</p>

          <div class="invoice-box">
            <p><span class="label">Invoice Number</span></p>
            <p class="value">${invoiceNumber}</p>

            <p style="margin-top:14px"><span class="label">Due Date</span></p>
            <p class="value" style="color:#dc2626">${formattedDue}</p>

            <p style="margin-top:14px"><span class="label">Amount Due</span></p>
            <p class="amount">${formattedAmount}</p>
          </div>

          <div class="sent-info">
            📧 This reminder was sent on <strong>${sentDateTime}</strong>
          </div>

          <p style="margin-top:20px">If you have already made this payment, please disregard this message. Thank you for your business!</p>
          <p style="margin-top:24px;margin-bottom:4px">Best regards,</p>
          <p><strong>${companyName}</strong></p>
        </div>
        <div class="footer">This is an automated reminder sent by Invoice Generator.</div>
      </div>
    </body>
    </html>
  `;

  const subjectMap = {
    '7day': `Payment Reminder (1 week): Invoice ${invoiceNumber} due ${formattedDue}`,
    '3day': `Payment Reminder (3 days): Invoice ${invoiceNumber} due ${formattedDue}`,
    '1day': `FINAL REMINDER: Invoice ${invoiceNumber} due TOMORROW — ${formattedDue}`,
  };

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: subjectMap[reminderType] || subjectMap['3day'],
    html,
  });

  return sentDateTime;
}

async function sendInvoiceEmail({ to, clientName, invoiceNumber, dueDate, amount, currency, companyName, invoiceHtml }) {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);

  const formattedDue = new Date(dueDate).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8" />
    <style>
      body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
      .container { background: #fff; max-width: 580px; margin: 0 auto; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
      .header { background: #1a1a2e; color: #fff; padding: 28px 32px; }
      .body { padding: 32px; color: #333; }
      .invoice-box { background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 20px; margin: 20px 0; }
      .label { color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
      .amount { font-size: 26px; font-weight: bold; color: #1a1a2e; }
      .footer { text-align: center; font-size: 11px; color: #aaa; padding: 20px 32px; border-top: 1px solid #f0f0f0; }
    </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0">New Invoice from ${companyName}</h1>
        </div>
        <div class="body">
          <p>Dear <strong>${clientName}</strong>,</p>
          <p>Please find your invoice details below.</p>
          <div class="invoice-box">
            <p><span class="label">Invoice Number</span></p>
            <p style="font-weight:600;font-size:15px">${invoiceNumber}</p>
            <p style="margin-top:14px"><span class="label">Due Date</span></p>
            <p style="font-weight:600;color:#dc2626">${formattedDue}</p>
            <p style="margin-top:14px"><span class="label">Amount Due</span></p>
            <p class="amount">${formattedAmount}</p>
          </div>
          <p>Please arrange payment by the due date. Thank you for your business!</p>
          <p style="margin-top:24px">Best regards,<br/><strong>${companyName}</strong></p>
        </div>
        <div class="footer">Sent via Invoice Generator</div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Invoice ${invoiceNumber} from ${companyName} — Due ${formattedDue}`,
    html,
  });
}

async function sendWelcomeEmail({ to, name }) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'Welcome to Invoice Generator!',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px">
        <h2 style="color:#1a1a2e">Welcome, ${name}! 🎉</h2>
        <p>Your Invoice Generator account has been created successfully.</p>
        <p>You can now create professional invoices, manage clients, and track payments — all in one place.</p>
        <p style="margin-top:24px;color:#888;font-size:13px">Invoice Generator Team</p>
      </div>
    `,
  });
}

module.exports = { sendReminderEmail, sendInvoiceEmail, sendWelcomeEmail };
