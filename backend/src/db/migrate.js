const pool = require('./client');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS company_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_name VARCHAR(255) DEFAULT 'Your Company',
        company_logo TEXT DEFAULT '',
        company_address TEXT DEFAULT '',
        phone VARCHAR(50) DEFAULT '',
        email VARCHAR(255) DEFAULT '',
        website VARCHAR(255) DEFAULT '',
        twitter VARCHAR(255) DEFAULT '',
        linkedin VARCHAR(255) DEFAULT '',
        facebook VARCHAR(255) DEFAULT '',
        default_currency VARCHAR(10) DEFAULT 'USD',
        default_tax_percentage NUMERIC(5,2) DEFAULT 10,
        bank_name VARCHAR(255) DEFAULT '',
        account_name VARCHAR(255) DEFAULT '',
        account_number VARCHAR(255) DEFAULT '',
        reminder_enabled BOOLEAN DEFAULT false,
        reminder_days_before INTEGER DEFAULT 3,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invoice_number VARCHAR(100) NOT NULL,
        client_name VARCHAR(255) NOT NULL,
        client_email VARCHAR(255) DEFAULT '',
        client_address TEXT DEFAULT '',
        issue_date DATE NOT NULL,
        due_date DATE NOT NULL,
        tax_percentage NUMERIC(5,2) DEFAULT 0,
        notes TEXT DEFAULT '',
        status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN (
          'paid','unpaid','pending','partial','failed',
          'cancelled','refunded','expired','processing','overdue'
        )),
        partial_percentage NUMERIC(5,2) DEFAULT 0,
        reminder_sent BOOLEAN DEFAULT false,
        email_sent_at_1day TIMESTAMPTZ DEFAULT NULL,
        email_sent_at_3day TIMESTAMPTZ DEFAULT NULL,
        email_sent_at_7day TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        rate NUMERIC(12,2) NOT NULL DEFAULT 0,
        quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reminder_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        reminder_type VARCHAR(10) NOT NULL,
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        recipient_email VARCHAR(255) NOT NULL,
        success BOOLEAN DEFAULT true,
        error_message TEXT DEFAULT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        upload_token VARCHAR(64) UNIQUE NOT NULL,
        client_name VARCHAR(255) DEFAULT '',
        client_email VARCHAR(255) DEFAULT '',
        amount_paid NUMERIC(12,2) DEFAULT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        payment_method VARCHAR(100) DEFAULT '',
        payment_date DATE DEFAULT NULL,
        notes TEXT DEFAULT '',
        file_url TEXT DEFAULT NULL,
        file_name VARCHAR(255) DEFAULT NULL,
        file_type VARCHAR(50) DEFAULT NULL,
        file_data TEXT DEFAULT NULL,
        status VARCHAR(20) DEFAULT 'pending_review' CHECK (status IN (
          'pending_review','approved','rejected','mismatch'
        )),
        auto_status VARCHAR(20) DEFAULT NULL,
        reviewer_notes TEXT DEFAULT '',
        reviewed_at TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
        receipt_id UUID REFERENCES payment_receipts(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      DO $migrate$ BEGIN
        BEGIN ALTER TABLE invoices ADD COLUMN partial_percentage NUMERIC(5,2) DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE invoices ADD COLUMN email_sent_at_1day TIMESTAMPTZ DEFAULT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE invoices ADD COLUMN email_sent_at_3day TIMESTAMPTZ DEFAULT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE invoices ADD COLUMN email_sent_at_7day TIMESTAMPTZ DEFAULT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status IN (
          'paid','unpaid','pending','partial','failed',
          'cancelled','refunded','expired','processing','overdue'
        )); EXCEPTION WHEN duplicate_object THEN NULL; END;
      END $migrate$;
    `);

    await client.query('COMMIT');
    console.log('✅ Database migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
