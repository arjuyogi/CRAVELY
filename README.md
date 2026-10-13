# Cravely

Cravely is a small, responsive food-ordering demo for browsing a menu, managing a cart, applying a promo, and completing a simulated checkout.

## Features

- Mobile-first dark interface with orange accents and responsive menu cards.
- Signup and login using bcrypt password hashes and JWT cookies.
- Signup passwords must be at least 8 characters and include a letter and a number; after signup, the app signs you in and opens the menu.
- A 20-item SQLite menu with category, search, and sorting filters.
- Locally served Nepali momo and dal-bhat photos, with image credits in `public/images/ATTRIBUTION.txt`.
- User-specific carts, quantity controls, server-calculated totals, and `CRAVE10`.
- Simulated card or wallet checkout and user-owned order history.
- Card details are checked in the browser for the demo and are never sent to the server.

## Tech stack

- Node.js and Express
- SQLite using `better-sqlite3`
- Plain HTML, CSS, and browser JavaScript
- Helmet, express-rate-limit, express-validator, CORS, bcryptjs, and jsonwebtoken

## Setup and run

1. Install Node.js 20 or newer.
2. Install dependencies with `npm install` (in PowerShell, use `npm.cmd install` if script execution is restricted).
3. Copy `.env.example` to `.env` and replace `JWT_SECRET` with a long random secret.
4. Create or refresh the menu using `npm run seed`.
5. Start the app with `npm start`, then open `http://localhost:3000`.

For development with automatic restarts, run `npm run dev`. Set `APP_ORIGIN` in `.env` to the exact origin you use to open the app. SQLite creates `data/cravely.db` automatically on startup.

## Folder guide

- `server/app.js` configures Express, security headers, rate limits, and routes.
- `server/db.js`, `server/seed.js`, and `server/pricing.js` handle storage, menu setup, and shared totals.
- `server/routes/` contains the authentication, menu, cart, and order APIs.
- `server/middleware/` contains authentication and CSRF-header checks.
- `public/` contains the pages, shared styling, browser scripts, and optional local images.
- `.env.example` documents local environment settings; `.env` and `data/` are ignored by Git.

## Security features

- Passwords are hashed with bcryptjs using 12 rounds; authentication uses one-day, HTTP-only, same-site cookies.
- All SQL values are bound through prepared statements; menu filters are allow-listed.
- Express-validator checks and sanitizes API inputs; JSON request bodies are limited to 10 KB.
- Helmet sets a Content Security Policy for the app, Google Fonts, and Unsplash; CORS only permits the configured app origin.
- Login/signup attempts and general API traffic are rate-limited.
- State-changing requests require `X-Requested-With`; protected cart and order queries are scoped to the authenticated user's ID.
- Prices, delivery, tax, discounts, and checkout totals are calculated on the server.
- Card number, expiry, and CVV are not included in any network request; checkout is simulated.

This is an educational demo, not a production payment processor. Google sign-in and password reset are UI demos only; Google OAuth needs provider credentials and callback configuration before it can sign customers in.
