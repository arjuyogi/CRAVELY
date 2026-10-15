require('dotenv').config();

const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

require('./db');

const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const restaurantsRouter = require('./routes/restaurants');
const ownerRequestsRouter = require('./routes/ownerRequests');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://accounts.google.com'],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://accounts.google.com'
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: [
        "'self'",
        'data:',
        'https://images.unsplash.com',
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com'
      ],
      connectSrc: [
        "'self'",
        'https://accounts.google.com',
        'https://accounts.google.com/gsi/'
      ],
      frameSrc: ["'self'", 'https://accounts.google.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null
    }
  }
}));

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use(cors({
  origin: process.env.APP_ORIGIN || `http://localhost:${port}`,
  credentials: true
}));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again shortly.'
  }
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/restaurants', restaurantsRouter);
app.use('/api/owner-requests', ownerRequestsRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((err, req, res, next) => {
  console.error('Request failed:', err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'Something went wrong. Please try again.'
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Cravely is running at http://localhost:${port}`);
  });
}

module.exports = app;