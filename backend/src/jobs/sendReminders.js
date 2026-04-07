const cron = require('node-cron');
const pool = require('../db/client');
const { sendReminderEmail } = require('../services/mailer');

// Helper: check and send a specific reminder tier (7day, 3day, 1day)
async function processReminderTier(daysAhead, reminderType, emailSentColumn) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysAhead);
  const targetDateStr = targetDate.toISOString().split('T')[0];

  const { rows: invoices } = await pool.query(
    `SELECT
       i.id, i.invoice_number, i.client_name, i.client_email, i.due_date,
       i.tax_percentage, i.${emailSentColumn},
       cs.reminder_enabled, cs.default_currency, cs.company_name,
       COALESCE(SUM(ii.rate * ii.quantity), 0) * (1 + i.tax_percentage / 100) AS total_amount
     FROM invoices i
     JOIN users u ON i.user_id = u.id
     JOIN company_settings cs ON cs.user_id = i.user_id
     LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
     WHERE i.status IN ('unpaid', 'pending', 'partial', 'processing')
       AND cs.reminder_enabled = true
       AND i.${emailSentColumn} IS NULL
       AND i.client_email IS NOT NULL AND i.client_email != ''
       AND i.due_date::date = $1::date
     GROUP BY i.id, cs.reminder_enabled, cs.default_currency, cs.company_name`,
    [targetDateStr]
  );

  console.log(`📧 [${reminderType}] Found ${invoices.length} invoice(s) due in ${daysAhead} day(s)`);

  for (const inv of invoices) {
    try {
      const sentDateTime = await sendReminderEmail({
        to: inv.client_email,
        clientName: inv.client_name,
        invoiceNumber: inv.invoice_number,
        dueDate: inv.due_date,
        amount: parseFloat(inv.total_amount),
        currency: inv.default_currency,
        companyName: inv.company_name,
        reminderType,
      });

      // Record timestamp on the invoice
      await pool.query(
        `UPDATE invoices SET ${emailSentColumn} = NOW(), reminder_sent = true, updated_at = NOW() WHERE id = $1`,
        [inv.id]
      );

      // Log to reminder_logs
      await pool.query(
        `INSERT INTO reminder_logs (invoice_id, reminder_type, recipient_email, success) VALUES ($1, $2, $3, true)`,
        [inv.id, reminderType, inv.client_email]
      );

      console.log(`✅ [${reminderType}] Reminder sent for ${inv.invoice_number} → ${inv.client_email} at ${sentDateTime}`);
    } catch (emailErr) {
      console.error(`❌ [${reminderType}] Failed for ${inv.invoice_number}:`, emailErr.message);

      await pool.query(
        `INSERT INTO reminder_logs (invoice_id, reminder_type, recipient_email, success, error_message) VALUES ($1, $2, $3, false, $4)`,
        [inv.id, reminderType, inv.client_email, emailErr.message]
      );
    }
  }
}

// Runs every day at 8:00 AM
function startReminderJob() {
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Running invoice reminder job...');
    try {
      // Run all three reminder tiers in parallel
      await Promise.all([
        processReminderTier(7, '7day', 'email_sent_at_7day'),
        processReminderTier(3, '3day', 'email_sent_at_3day'),
        processReminderTier(1, '1day', 'email_sent_at_1day'),
      ]);
      console.log('✅ Reminder job completed');
    } catch (err) {
      console.error('❌ Reminder job error:', err.message);
    }
  });

  console.log('📅 Invoice reminder cron job scheduled (runs daily at 8:00 AM)');
  console.log('   → Sends at: 7 days before, 3 days before, and 1 day before due date');
}

module.exports = { startReminderJob };
