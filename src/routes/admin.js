const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireRole, normalizeWa, waValid, BENGKEL_STATUS } = require('../helpers');

const router = express.Router();

// Daftar bengkel + statistik — HANYA admin
router.get('/bengkel', requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT b.id, b.nama_bengkel, b.nomor_wa, b.alamat, b.status, b.created_at,
              u.nama AS nama_akun, u.email, COUNT(l.id) AS total_layanan,
              COALESCE(SUM(l.stok), 0) AS total_stok
       FROM bengkel b
       JOIN users u ON u.id = b.user_id
       LEFT JOIN layanan l ON l.bengkel_id = b.id
       GROUP BY b.id
       ORDER BY FIELD(b.status, 'pending', 'active', 'rejected'), b.id DESC`
    );
    res.json({ bengkel: rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat data bengkel.' });
  }
});

// Tambah bengkel — HANYA admin
router.post('/bengkel', requireRole('admin'), async (req, res) => {
  try {
    const { nama_akun, email, password, nama_bengkel, nomor_wa, alamat } = req.body || {};
    if (!nama_akun || !nama_akun.trim()) return res.status(400).json({ error: 'Nama akun wajib diisi.' });
    if (!nama_bengkel || !nama_bengkel.trim()) return res.status(400).json({ error: 'Nama bengkel wajib diisi.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) return res.status(400).json({ error: 'Email tidak valid.' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter.' });
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
      "INSERT INTO bengkel (user_id, nama_bengkel, nomor_wa, alamat, status) VALUES (?, ?, ?, ?, 'active')",
      [u.insertId, nama_bengkel.trim(), wa, String(alamat || '').trim()]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah bengkel.' });
  }
});

// Setujui / tolak / ajukan ulang status bengkel — HANYA admin
router.put('/bengkel/:id/status', requireRole('admin'), async (req, res) => {
  try {
    const status = req.body && req.body.status;
    if (!BENGKEL_STATUS.includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid.' });
    }
    const [r] = await db.query('UPDATE bengkel SET status = ? WHERE id = ?', [status, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Bengkel tidak ditemukan.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengubah status bengkel.' });
  }
});

// Hapus bengkel (beserta akun & katalognya) — HANYA admin
router.delete('/bengkel/:id', requireRole('admin'), async (req, res) => {
  try {
    const [b] = await db.query('SELECT user_id FROM bengkel WHERE id = ?', [req.params.id]);
    if (!b.length) return res.status(404).json({ error: 'Bengkel tidak ditemukan.' });
    await db.query('DELETE FROM users WHERE id = ? AND role = "bengkel"', [b[0].user_id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus bengkel.' });
  }
});

// Statistik global — HANYA admin
router.get('/stats', requireRole('admin'), async (req, res) => {
  try {
    const [[stats]] = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM bengkel WHERE status='active') AS total_bengkel,
        (SELECT COUNT(*) FROM bengkel WHERE status='pending') AS total_pending,
        (SELECT COUNT(*) FROM layanan) AS total_layanan,
        (SELECT COALESCE(SUM(stok),0) FROM layanan) AS total_stok`
    );
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat statistik.' });
  }
});

module.exports = router;
