const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireRole, normalizeWa, waValid } = require('../helpers');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pendaftaran mandiri MITRA BENGKEL — menunggu persetujuan admin
router.post('/register', async (req, res) => {
  try {
    const { nama_akun, email, password, nama_bengkel, nomor_wa, alamat } = req.body || {};
    if (!nama_akun || !nama_akun.trim()) return res.status(400).json({ error: 'Nama pemilik akun wajib diisi.' });
    if (!nama_bengkel || !nama_bengkel.trim()) return res.status(400).json({ error: 'Nama bengkel wajib diisi.' });
    if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'Email tidak valid.' });
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter.' });
    }
    const wa = normalizeWa(nomor_wa);
    if (!waValid(wa)) return res.status(400).json({ error: 'Nomor WhatsApp tidak valid (contoh: 6281234567890).' });

    const [exists] = await db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (exists.length) return res.status(409).json({ error: 'Email sudah terdaftar.' });

    const hash = await bcrypt.hash(password, 10);
    const [u] = await db.query(
      "INSERT INTO users (nama, email, password_hash, role) VALUES (?, ?, ?, 'bengkel')",
      [nama_akun.trim(), email.toLowerCase(), hash]
    );
    await db.query(
      "INSERT INTO bengkel (user_id, nama_bengkel, nomor_wa, alamat, status) VALUES (?, ?, ?, ?, 'pending')",
      [u.insertId, nama_bengkel.trim(), wa, String(alamat || '').trim()]
    );
    res.json({ ok: true, message: 'Pendaftaran berhasil! Silakan tunggu persetujuan admin.' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mendaftar.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!EMAIL_RE.test(email || '') || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    }
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!rows.length) return res.status(401).json({ error: 'Email atau password salah.' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Email atau password salah.' });

    req.session.user = { id: user.id, nama: user.nama, email: user.email, role: user.role };

    let bengkelId = null;
    if (user.role === 'bengkel') {
      const [b] = await db.query('SELECT id, nomor_wa, status FROM bengkel WHERE user_id = ?', [user.id]);
      if (b.length) {
        bengkelId = b[0].id;
        req.session.bengkelId = bengkelId;
        return res.json({
          user: { id: user.id, nama: user.nama, email: user.email, role: user.role, bengkelId, status: b[0].status, nomorWa: b[0].nomor_wa },
        });
      }
    }

    res.json({ user: { id: user.id, nama: user.nama, email: user.email, role: user.role, bengkelId } });
  } catch (err) {
    res.status(500).json({ error: 'Gagal login.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ user: null });
  const u = req.session.user;
  let bengkelId = null;
  if (u.role === 'bengkel') {
    const [b] = await db.query('SELECT id, nomor_wa, nama_bengkel, alamat, status FROM bengkel WHERE user_id = ?', [u.id]);
    if (b.length) {
      bengkelId = b[0].id;
      return res.json({
        user: {
          ...u,
          bengkelId,
          namaBengkel: b[0].nama_bengkel,
          nomorWa: b[0].nomor_wa,
          alamat: b[0].alamat,
          status: b[0].status,
        },
      });
    }
  }
  res.json({ user: { ...u, bengkelId } });
});

// Bengkel update seluruh informasi bengkel (nama, alamat, WA, email, password)
router.put('/bengkel-profile', requireRole('bengkel'), async (req, res) => {
  try {
    const { nama_bengkel, nomor_wa, alamat, email, password } = req.body || {};

    const wa = normalizeWa(nomor_wa);
    if (!nama_bengkel || !nama_bengkel.trim()) {
      return res.status(400).json({ error: 'Nama bengkel wajib diisi.' });
    }
    if (!waValid(wa)) return res.status(400).json({ error: 'Nomor WhatsApp tidak valid (contoh: 6281234567890).' });

    const userId = req.session.user.id;

    // Ganti email (opsional) — wajib valid & unik
    if (email !== undefined) {
      if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'Email tidak valid.' });
      const newEmail = email.toLowerCase();
      const [dup] = await db.query('SELECT id FROM users WHERE email = ? AND id <> ?', [newEmail, userId]);
      if (dup.length) return res.status(409).json({ error: 'Email sudah dipakai akun lain.' });
      await db.query('UPDATE users SET email = ? WHERE id = ?', [newEmail, userId]);
    }

    // Ganti password (opsional) — kosong berarti tidak diubah
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
      }
      const hash = await bcrypt.hash(password, 10);
      await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
    }

    await db.query(
      'UPDATE bengkel SET nama_bengkel = ?, nomor_wa = ?, alamat = ? WHERE user_id = ?',
      [nama_bengkel.trim(), wa, String(alamat || '').trim(), userId]
    );

    if (email !== undefined) req.session.user.email = email.toLowerCase();

    res.json({ ok: true, nomor_wa: wa, email: req.session.user.email, password_changed: Boolean(password) });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan informasi bengkel.' });
  }
});

module.exports = router;
