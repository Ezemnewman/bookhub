const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn(
    '[db] DATABASE_URL is not set. Set it to a Postgres connection string ' +
    '(Railway: add a Postgres plugin; Vercel: add Vercel Postgres or a Neon/Supabase DB).'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Most managed Postgres providers (Railway, Neon, Vercel Postgres, Supabase)
  // require SSL. Disable only for a fully local, non-SSL Postgres instance.
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
});

// Creates the tables if they don't exist yet. Safe to call on every boot.
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id         TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      items      JSONB NOT NULL,
      total      NUMERIC(10,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

// ---- Users ----

async function findUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

async function createUser({ id, name, email, passwordHash }) {
  await pool.query(
    'INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)',
    [id, name, email, passwordHash]
  );
  return { id, name, email };
}

// ---- Orders ----

async function createOrder({ id, userEmail, items, total }) {
  await pool.query(
    'INSERT INTO orders (id, user_email, items, total) VALUES ($1, $2, $3, $4)',
    [id, userEmail, JSON.stringify(items), total]
  );
}

async function getOrdersByUser(userEmail) {
  const { rows } = await pool.query(
    'SELECT * FROM orders WHERE user_email = $1 ORDER BY created_at DESC',
    [userEmail]
  );
  return rows.map(r => ({
    id: r.id,
    userEmail: r.user_email,
    items: r.items,
    total: Number(r.total),
    date: r.created_at.toLocaleString()
  }));
}

module.exports = {
  pool,
  init,
  findUserByEmail,
  createUser,
  createOrder,
  getOrdersByUser
};
