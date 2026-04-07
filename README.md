# Invoice Generator

Full-stack invoice generator with **React** frontend, **Node.js** backend, and **Neon PostgreSQL** database. Includes Gmail SMTP email reminders.

---

## Project Structure

```
invoice-app/
├── backend/          # Node.js + Express API
│   └── src/
│       ├── db/           client.js, migrate.js
│       ├── docs/         api.yaml (Swagger)
│       ├── jobs/         sendReminders.js (cron)
│       ├── middleware/   auth.js (JWT)
│       ├── routes/       auth.js, invoices.js, settings.js
│       ├── services/     mailer.js (Gmail SMTP)
│       └── index.js
└── frontend/         # React + Vite
    └── src/
        ├── lib/          api.js, stores.js, utils.js
        ├── components/   DashboardLayout, InvoicePreview, InvoiceForm
        └── routes/       Login, Dashboard, CreateInvoice, EditInvoice,
                          History, ViewInvoice, Settings
```

---

## Quick Start

### 1. Neon Database Setup

1. Go to [neon.tech](https://neon.tech) and create a free project
2. Copy the **connection string** from the Neon console dashboard
3. Paste it into `backend/.env` as `DATABASE_URL`

### 2. Backend

```bash
cd backend
npm install

# Edit .env — set DATABASE_URL (from Neon) and SMTP credentials
cp .env .env.local   # optional

# Run migrations (creates tables)
node src/db/migrate.js

# Start dev server
npm run dev
# → API: http://localhost:5000
# → Swagger UI: http://localhost:5000/api-docs
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Environment Variables

### `backend/.env`

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `PORT` | API port (default: 5000) |
| `FRONTEND_URL` | Frontend origin for CORS (default: http://localhost:5173) |
| `SMTP_HOST` | Gmail SMTP host (`smtp.gmail.com`) |
| `SMTP_PORT` | 587 |
| `SMTP_SECURE` | false (uses STARTTLS) |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASS` | Gmail App Password (not your real password) |
| `SMTP_FROM` | Sender display name + email |

### `frontend/.env`

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API URL (default: http://localhost:5000/api) |

---

## Gmail App Password Setup

1. Enable 2-Factor Authentication on your Google account
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Create a new App Password (select "Mail" + "Other")
4. Copy the 16-character password into `SMTP_PASS` in `backend/.env`

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | ❌ | Register user |
| POST | `/api/auth/login` | ❌ | Login |
| GET | `/api/auth/me` | ✅ | Current user |
| GET | `/api/invoices` | ✅ | List invoices |
| POST | `/api/invoices` | ✅ | Create invoice |
| GET | `/api/invoices/:id` | ✅ | Get invoice |
| PUT | `/api/invoices/:id` | ✅ | Update invoice |
| PATCH | `/api/invoices/:id/status` | ✅ | Update status |
| POST | `/api/invoices/:id/duplicate` | ✅ | Duplicate invoice |
| DELETE | `/api/invoices/:id` | ✅ | Delete invoice |
| GET | `/api/settings` | ✅ | Get settings |
| PUT | `/api/settings` | ✅ | Save settings |

Full interactive docs at `http://localhost:5000/api-docs`

---

## Features

- 🔐 JWT authentication (register / login)
- 🧾 Create, edit, duplicate, delete invoices
- 📄 Live invoice preview (A5 landscape)
- 💾 Download PDF / Print
- 📊 Dashboard with revenue stats
- 🏢 Company settings with logo upload
- 💰 Multi-currency support
- 📧 Gmail SMTP email reminders (daily cron job)
- 🗄️ Neon PostgreSQL (serverless Postgres)
- 📖 Swagger API documentation
