require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');

const authRoutes = require('./src/routes/auth');
const itemRoutes = require('./src/routes/items');
const adminRoutes = require('./src/routes/admin');

const app = express();

app.use(express.json({ limit: '6mb' }));

// ============ SESI STATELESS (cookie bertanda tangan HMAC) ============
// Kompatibel serverless (Vercel): tidak menyimpan state di memori proses.
const SESSION_COOKIE = 'bengkelin_sess';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari (detik)

function sessionSign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

app.use((req, res, next) => {
  const secret = process.env.SESSION_SECRET || 'bengkelin-secret-2026';
  req.session = {};

  const rawCookie = (req.headers.cookie || '')
    .split(/;\s*/)
    .find((c) => c.startsWith(SESSION_COOKIE + '='));
  let original = '{}';

  if (rawCookie) {
    const token = decodeURIComponent(rawCookie.slice(SESSION_COOKIE.length + 1));
    const dot = token.lastIndexOf('.');
    if (dot > 0) {
      const payload = token.slice(0, dot);
      const sig = token.slice(dot + 1);
      const expected = sessionSign(payload, secret);
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        try {
          req.session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
          original = JSON.stringify(req.session);
        } catch {
          req.session = {};
        }
      }
    }
  }

  // Tulis cookie hanya jika isi sesi berubah (login/logout/update profil)
  const origEnd = res.end.bind(res);
  res.end = function patchedEnd(...args) {
    const current = JSON.stringify(req.session);
    if (current !== original) {
      if (Object.keys(req.session).length === 0) {
        res.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
      } else {
        const payload = Buffer.from(current).toString('base64url');
        const secure = process.env.VERCEL ? '; Secure' : '';
        res.append(
          'Set-Cookie',
          `${SESSION_COOKIE}=${payload}.${sessionSign(payload, secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`
        );
      }
    }
    return origEnd(...args);
  };

  next();
});

app.use('/api/auth', authRoutes);
app.use('/api', itemRoutes);
app.use('/api/admin', adminRoutes);

app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Hanya listen saat dijalankan langsung (bukan saat di-import oleh serverless Vercel)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`BENGKELIN! berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
