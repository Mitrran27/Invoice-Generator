const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const auth = require('../middleware/auth');

router.use(auth);

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT n.*, i.invoice_number, pr.amount_paid, pr.auto_status, pr.file_url, pr.file_type
       FROM notifications n
       LEFT JOIN invoices i ON n.invoice_id = i.id
       LEFT JOIN payment_receipts pr ON n.receipt_id = pr.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    const unreadCount = rows.filter(r => !r.is_read).length;
    res.json({ notifications: rows, unreadCount });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read=true WHERE user_id=$1', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
