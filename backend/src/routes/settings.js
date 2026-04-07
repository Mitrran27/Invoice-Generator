const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const auth = require('../middleware/auth');

router.use(auth);

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    let { rows } = await pool.query(
      'SELECT * FROM company_settings WHERE user_id = $1',
      [req.user.id]
    );
    if (rows.length === 0) {
      // Auto-create default settings
      const { rows: newRows } = await pool.query(
        `INSERT INTO company_settings (user_id, company_name, email)
         VALUES ($1, $2, $3) RETURNING *`,
        [req.user.id, req.user.name + "'s Company", req.user.email]
      );
      rows = newRows;
    }
    res.json({ settings: rows[0] });
  } catch (err) {
    console.error('Get settings error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  const {
    companyName, companyLogo, companyAddress, phone, email, website,
    twitter, linkedin, facebook,
    defaultCurrency, defaultTaxPercentage,
    bankName, accountName, accountNumber,
    reminderEnabled, reminderDaysBefore
  } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO company_settings (
        user_id, company_name, company_logo, company_address, phone, email, website,
        twitter, linkedin, facebook,
        default_currency, default_tax_percentage,
        bank_name, account_name, account_number,
        reminder_enabled, reminder_days_before
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (user_id) DO UPDATE SET
        company_name = EXCLUDED.company_name,
        company_logo = EXCLUDED.company_logo,
        company_address = EXCLUDED.company_address,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        website = EXCLUDED.website,
        twitter = EXCLUDED.twitter,
        linkedin = EXCLUDED.linkedin,
        facebook = EXCLUDED.facebook,
        default_currency = EXCLUDED.default_currency,
        default_tax_percentage = EXCLUDED.default_tax_percentage,
        bank_name = EXCLUDED.bank_name,
        account_name = EXCLUDED.account_name,
        account_number = EXCLUDED.account_number,
        reminder_enabled = EXCLUDED.reminder_enabled,
        reminder_days_before = EXCLUDED.reminder_days_before,
        updated_at = NOW()
      RETURNING *`,
      [
        req.user.id,
        companyName || '', companyLogo || '', companyAddress || '',
        phone || '', email || '', website || '',
        twitter || '', linkedin || '', facebook || '',
        defaultCurrency || 'USD', defaultTaxPercentage ?? 10,
        bankName || '', accountName || '', accountNumber || '',
        reminderEnabled ?? false, reminderDaysBefore ?? 3
      ]
    );
    res.json({ settings: rows[0] });
  } catch (err) {
    console.error('Update settings error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
