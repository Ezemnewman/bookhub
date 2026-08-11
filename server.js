require('dotenv').config();

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
const path = require('path');
const bcrypt = require('bcryptjs');

const books = require('./data/books.json');
const db = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway and Vercel both sit behind a proxy that terminates HTTPS.
// Without this, Express doesn't know the connection is actually secure,
// so it silently refuses to set secure cookies — which breaks sessions
// (and therefore the cart) in production.
app.set('trust proxy', 1);

if (!process.env.SESSION_SECRET) {
  console.warn('[server] SESSION_SECRET is not set — set it in your environment before deploying.');
}

// ---- View engine ----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// ---- Middleware ----
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Sessions are stored in Postgres (table auto-created below) instead of
// in-memory, since serverless platforms like Vercel don't keep memory
// between requests and Railway may run more than one instance.
app.use(session({
  store: new pgSession({ pool: db.pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'bookhub-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));
app.use(flash());

// On Vercel, a cold start could otherwise let the very first request try to
// read/write users or orders before db.init() has finished creating those
// tables. This makes every request wait for that one-time setup; once it
// resolves, later (warm) requests pass through instantly.
if (process.env.VERCEL) {
  const dbReady = db.init().catch(err => {
    console.error('Failed to initialize database:', err);
    throw err;
  });
  app.use((req, res, next) => {
    dbReady.then(() => next()).catch(next);
  });
}

// Make cart, user, and flash messages available in every view
app.use((req, res, next) => {
  if (!req.session.cart) req.session.cart = {}; // { bookId: qty }
  res.locals.cartCount = Object.values(req.session.cart).reduce((a, b) => a + b, 0);
  res.locals.currentUser = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.flash('error', 'Please log in to continue.');
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

// Wrap async route handlers so rejected promises reach Express's error handler
// instead of crashing the process (important on serverless).
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function getCartDetails(req) {
  const cart = req.session.cart || {};
  const items = Object.entries(cart).map(([id, qty]) => {
    const book = books.find(b => b.id === id);
    if (!book) return null;
    return { ...book, qty, subtotal: +(book.price * qty).toFixed(2) };
  }).filter(Boolean);
  const total = +items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2);
  return { items, total };
}

// ---- Routes ----

// Home
app.get('/', (req, res) => {
  const featured = books.slice(0, 4);
  const bestsellers = books.slice(4);
  res.render('index', { title: 'Book Hub — Buy & Download Ebooks', featured, bestsellers });
});

// Shop / catalog with category filter + search
app.get('/shop', (req, res) => {
  const { category, q } = req.query;
  let results = books;
  if (category && category !== 'All') {
    results = results.filter(b => b.category === category);
  }
  if (q) {
    const term = q.toLowerCase();
    results = results.filter(b =>
      b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term)
    );
  }
  const categories = ['All', ...new Set(books.map(b => b.category))];
  res.render('shop', {
    title: 'Shop Ebooks — Book Hub',
    books: results,
    categories,
    activeCategory: category || 'All',
    q: q || ''
  });
});

// Book detail
app.get('/book/:id', (req, res) => {
  const book = books.find(b => b.id === req.params.id);
  if (!book) return res.status(404).render('404', { title: 'Book not found' });
  const related = books.filter(b => b.category === book.category && b.id !== book.id).slice(0, 4);
  res.render('book', { title: `${book.title} — Book Hub`, book, related });
});

// About / Service / Contact
app.get('/about', (req, res) => res.render('about', { title: 'About Us — Book Hub' }));
app.get('/service', (req, res) => res.render('service', { title: 'Our Service — Book Hub' }));
app.get('/contact-us', (req, res) => res.render('contact', { title: 'Contact Us — Book Hub' }));
app.post('/contact-us', (req, res) => {
  req.flash('success', 'Thanks — your message has been sent. We\'ll reply within 1–2 business days.');
  res.redirect('/contact-us');
});

// ---- Cart ----
app.get('/cart', (req, res) => {
  const { items, total } = getCartDetails(req);
  res.render('cart', { title: 'Your Cart — Book Hub', items, total });
});

app.post('/cart/add/:id', (req, res) => {
  const book = books.find(b => b.id === req.params.id);
  if (!book) return res.redirect('/shop');
  const qty = parseInt(req.body.qty, 10) || 1;
  req.session.cart[book.id] = (req.session.cart[book.id] || 0) + qty;
  req.flash('success', `"${book.title}" added to your cart.`);
  res.redirect(req.get('referer') || '/shop');
});

app.post('/cart/update/:id', (req, res) => {
  const qty = parseInt(req.body.qty, 10);
  if (qty > 0) {
    req.session.cart[req.params.id] = qty;
  } else {
    delete req.session.cart[req.params.id];
  }
  res.redirect('/cart');
});

app.post('/cart/remove/:id', (req, res) => {
  delete req.session.cart[req.params.id];
  req.flash('success', 'Item removed from cart.');
  res.redirect('/cart');
});

// ---- Checkout (simulated payment — front end only) ----
app.get('/checkout', requireLogin, (req, res) => {
  const { items, total } = getCartDetails(req);
  if (items.length === 0) {
    req.flash('error', 'Your cart is empty.');
    return res.redirect('/cart');
  }
  res.render('checkout', { title: 'Checkout — Book Hub', items, total });
});

app.post('/checkout', requireLogin, (req, res) => {
  const { items, total } = getCartDetails(req);
  if (items.length === 0) return res.redirect('/cart');

  // No real payment gateway is connected yet, so we're honest about that here
  // rather than faking a successful order. The cart is left intact so the
  // customer can retry once payments are live.
  res.render('payment-unavailable', { title: 'Payment Unavailable — Book Hub' });
});

app.get('/order-success', requireLogin, asyncRoute(async (req, res) => {
  const myOrders = await db.getOrdersByUser(req.session.user.email);
  const order = myOrders.find(o => o.id === req.session.lastOrderId);
  if (!order) return res.redirect('/shop');
  res.render('order-success', { title: 'Order Confirmed — Book Hub', order });
}));

// ---- Auth / My Account (Postgres-backed users with hashed passwords) ----

// Where to send the user after a successful login/signup.
// Supports ?next=/checkout so "please log in to continue" flows return you to where you were.
function safeNext(req) {
  const next = req.body.next || req.query.next;
  return next && next.startsWith('/') ? next : '/my-account';
}

app.get('/my-account', asyncRoute(async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const myOrders = await db.getOrdersByUser(req.session.user.email);
  res.render('account', { title: 'My Account — Book Hub', myOrders });
}));

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/my-account');
  res.render('auth', { title: 'Log In — Book Hub', activeTab: 'login', next: req.query.next || '' });
});

app.get('/signup', (req, res) => {
  if (req.session.user) return res.redirect('/my-account');
  res.render('auth', { title: 'Sign Up — Book Hub', activeTab: 'signup', next: req.query.next || '' });
});

app.post('/register', asyncRoute(async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  const next = safeNext(req);
  const redirectSignup = () => res.redirect(`/signup${next !== '/my-account' ? '?next=' + encodeURIComponent(next) : ''}`);

  if (!name || !email || !password) {
    req.flash('error', 'All fields are required.');
    return redirectSignup();
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    req.flash('error', 'Passwords do not match.');
    return redirectSignup();
  }
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.findUserByEmail(normalizedEmail);
  if (existing) {
    req.flash('error', 'An account with that email already exists. Try logging in instead.');
    return res.redirect(`/login${next !== '/my-account' ? '?next=' + encodeURIComponent(next) : ''}`);
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = await db.createUser({ id: Date.now().toString(), name, email: normalizedEmail, passwordHash });
  req.session.user = user;
  req.flash('success', `Welcome to Book Hub, ${name}!`);
  res.redirect(next);
}));

app.post('/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body;
  const next = safeNext(req);
  const normalizedEmail = (email || '').trim().toLowerCase();
  const user = await db.findUserByEmail(normalizedEmail);
  const valid = user && bcrypt.compareSync(password || '', user.password_hash);
  if (!valid) {
    req.flash('error', 'Invalid email or password.');
    return res.redirect(`/login${next !== '/my-account' ? '?next=' + encodeURIComponent(next) : ''}`);
  }
  req.session.user = { id: user.id, name: user.name, email: user.email };
  req.flash('success', `Welcome back, ${user.name}!`);
  res.redirect(next);
}));

app.post('/logout', (req, res) => {
  req.session.user = null;
  req.flash('success', 'You have been logged out.');
  res.redirect('/');
});

// ---- 404 ----
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page not found — Book Hub' });
});

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong. Please try again.');
});

// Locally and on Railway, run a normal long-lived server.
// On Vercel, the platform imports `app` itself and calls it per-request, so
// app.listen() must be skipped there — Vercel sets VERCEL=1 automatically.
// (The Postgres init-on-cold-start gate for Vercel lives near the top of
// this file, before any routes are registered — see `dbReady` below.)
if (!process.env.VERCEL) {
  db.init()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Book Hub running at http://localhost:${PORT}`);
      });
    })
    .catch(err => {
      console.error('Failed to initialize database:', err);
      process.exit(1);
    });
}

module.exports = app;
