# Book Hub — Ebook Store (Front End)

A Node.js/Express + EJS front end for an ebook store: browse books, filter by
category, search, add to cart, check out, and manage orders in My Account.

Users, orders, and sessions are stored in **Postgres**, so the app runs
identically whether it's deployed as a long-running server (Railway) or as
serverless functions (Vercel).

## Local setup

1. Get a Postgres database. Easiest options:
   - [Neon](https://neon.tech) or [Supabase](https://supabase.com) — free tier, instant connection string
   - A local Postgres install
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `SESSION_SECRET`.
3. Install and run:
   ```bash
   npm install
   npm start
   ```
   Tables are created automatically on first boot. Visit http://localhost:3000

For auto-reload during development: `npm run dev`

## Deploying to Railway

1. Push this project to a GitHub repo.
2. In Railway, **New Project → Deploy from GitHub repo**, pick this repo.
3. **Add a Postgres plugin** to the same project (New → Database → PostgreSQL).
   Railway automatically injects `DATABASE_URL` into your app's environment —
   you don't need to copy/paste it.
4. In your app service's **Variables** tab, add:
   - `SESSION_SECRET` — any long random string
   - `NODE_ENV` = `production`
5. Railway detects `npm start` automatically from `package.json`. Deploy.

Tables are created automatically the first time the app boots.

## Deploying to Vercel

1. Push this project to a GitHub repo (same repo as Railway is fine).
2. In Vercel, **Add New → Project**, import the repo. Vercel will detect
   `vercel.json` and deploy `server.js` as a serverless function.
3. Add a Postgres database — either **Vercel Postgres** (Storage tab in your
   project) or an external provider like Neon/Supabase.
4. In **Project Settings → Environment Variables**, add:
   - `DATABASE_URL` — from whichever Postgres you provisioned
   - `SESSION_SECRET` — any long random string
   - `NODE_ENV` = `production`
5. Redeploy.

Notes specific to Vercel:
- `server.js` exports the Express `app` and skips `app.listen()` when
  `process.env.VERCEL` is set (Vercel sets this automatically) — Vercel calls
  the app directly per request instead.
- Cold starts mean the very first request after a period of inactivity will
  be a bit slower while a fresh function instance boots and connects to
  Postgres.
- Sessions and accounts are stored in Postgres (not in-memory or on disk),
  so they work correctly across the many separate function invocations
  Vercel may use to handle your traffic.

## What's included

- **Home** (`/`) — hero, featured & bestseller books
- **Shop** (`/shop`) — full catalog, category filter, search
- **Book detail** (`/book/:id`) — description, price, add to cart, related titles
- **Cart** (`/cart`) — update quantities, remove items, subtotal
- **Login / Sign Up** (`/login`, `/signup`) — accounts with hashed passwords
- **Checkout** (`/checkout`) — billing form + payment, requires login
- **My Account** (`/my-account`) — order history
- **About**, **Our Service**, **Contact Us** — informational pages

## Payments

Checkout collects billing and card details but currently shows an honest
"payment gateway unavailable" message instead of faking a successful charge,
since no real payment processor is connected. To accept real payments, wire
up a processor (Stripe, Paystack, etc.) in the `POST /checkout` route in
`server.js` — the `db.createOrder()` function is already there and ready to
use once a real charge succeeds.

## Project structure

```
bookhub/
  server.js           Express app (works on Railway and as a Vercel function)
  lib/db.js            Postgres connection, table setup, user/order queries
  data/books.json       Static book catalog
  views/                EJS templates
  public/css, public/js  Styles and small client-side scripts
  vercel.json           Routes Vercel to server.js and /public
  .env.example           Template for local environment variables
```

## Adding your own books

Edit `data/books.json` — each entry needs `id`, `title`, `author`,
`category`, `format`, `price`, `oldPrice` (or `null`), `rating` (1–5),
`cover` (image URL), and `description`.
