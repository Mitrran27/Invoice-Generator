require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const { startReminderJob } = require('./jobs/sendReminders');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '20mb' })); // Larger for PDF base64

const isDev = process.env.NODE_ENV !== 'production';

// General API rate limit — generous for development, tighter in production
const limiter = rateLimit({ windowMs: 15*60*1000, max: isDev ? 2000 : 200, message: { error: 'Too many requests, please try again later' },
  skip: (req) => isDev && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'),
});
app.use('/api', limiter);

// Auth rate limit — relaxed in dev so refreshing/testing doesn't lock you out
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: isDev ? 500 : 20, message: { error: 'Too many login attempts, please try again later' },
  skip: (req) => isDev && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'),
});

const swaggerDoc = YAML.load(path.join(__dirname, 'docs/api.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/receipts', require('./routes/receipts'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 API running on http://localhost:${PORT}`);
  console.log(`📖 Swagger docs at http://localhost:${PORT}/api-docs`);
  if (isDev) console.log(`🔧 Dev mode — rate limits relaxed for localhost`);
  startReminderJob();
});

module.exports = app;
