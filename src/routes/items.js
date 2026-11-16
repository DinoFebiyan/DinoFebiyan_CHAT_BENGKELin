const express = require('express');
const db = require('../db');
const { KATEGORI, isServiceKategori, requireRole } = require('../helpers');

const router = express.Router();

// Katalog publik (tanpa login) — hanya bengkel berstatus active
router.get('/items', async (req, res) => {
  try {
    const { q, kategori, sort } = req.query;
    let sql = `
      SELECT l.id, l.bengkel_id, l.nama, l.kategori, l.harga, l.stok, l.deskripsi,
             l.image_url, l.unggulan, b.nama_bengkel, b.nomor_wa, b.alamat
      FROM layanan l
      JOIN bengkel b ON b.id = l.bengkel_id
      WHERE b.status = 'active'`;
    const params = [];

    if (q) {
      sql += ' AND (l.nama LIKE ? OR l.deskripsi LIKE ? OR l.kategori LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (kategori && KATEGORI.includes(kategori)) {
      sql += ' AND l.kategori = ?';
      params.push(kategori);
    }
    sql += ' ORDER BY l.unggulan DESC, l.id DESC';

    const [rows] = await db.query(sql, params);

    let items = rows;
    if (sort === 'price-asc') items = rows.slice().sort((a, b) => a.harga - b.harga);
    else if (sort === 'price-desc') items = rows.slice().sort((a, b) => b.harga - a.harga);
    else if (sort === 'stock-desc') items = rows.slice().sort((a, b) => b.stok - a.stok);

    res.json({ items, kategori: KATEGORI });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat katalog.' });
  }
});

// Katalog milik bengkel yang sedang login (termasuk bengkel non-aktif)
router.get('/my-items', requireRole('bengkel'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT l.* FROM layanan l
       JOIN bengkel b ON b.id = l.bengkel_id
       WHERE b.user_id = ?
       ORDER BY l.unggulan DESC, l.id DESC`,
      [req.session.user.id]
    );
    res.json({ items: rows, kategori: KATEGORI });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat layanan.' });
  }
});

// Tambah layanan — HANYA bengkel
router.post('/items', requireRole('bengkel'), async (req, res) => {
  try {
    const { nama, kategori, harga, stok, deskripsi, image_url, unggulan } = req.body || {};
    const err = validateItem({ nama, kategori, harga, stok, deskripsi });
    if (err) return res.status(400).json({ error: err });

    const [b] = await db.query('SELECT id FROM bengkel WHERE user_id = ?', [req.session.user.id]);
    if (!b.length) return res.status(403).json({ error: 'Profil bengkel tidak ditemukan.' });

    const stokFinal = normalizeStok(kategori, stok);
    await db.query(
      `INSERT INTO layanan (bengkel_id, nama, kategori, harga, stok, deskripsi, image_url, unggulan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b[0].id,
        nama.trim(),
        kategori,
        Math.max(0, Math.floor(Number(harga) || 0)),
        stokFinal,
        deskripsi.trim(),
        image_url || null,
        unggulan ? 1 : 0,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah layanan.' });
  }
});

// Update layanan — HANYA pemilik bengkel
router.put('/items/:id', requireRole('bengkel'), async (req, res) => {
  try {
    const { nama, kategori, harga, stok, deskripsi, image_url, unggulan } = req.body || {};
    const err = validateItem({ nama, kategori, harga, stok, deskripsi });
    if (err) return res.status(400).json({ error: err });

    const [own] = await db.query(
      `SELECT l.id FROM layanan l JOIN bengkel b ON b.id = l.bengkel_id
       WHERE l.id = ? AND b.user_id = ?`,
      [req.params.id, req.session.user.id]
    );
    if (!own.length) return res.status(404).json({ error: 'Layanan tidak ditemukan.' });

    const stokFinal = normalizeStok(kategori, stok);
    await db.query(
      `UPDATE layanan SET nama=?, kategori=?, harga=?, stok=?, deskripsi=?, image_url=?, unggulan=?
       WHERE id = ?`,
      [
        nama.trim(),
        kategori,
        Math.max(0, Math.floor(Number(harga) || 0)),
        stokFinal,
        deskripsi.trim(),
        image_url || null,
        unggulan ? 1 : 0,
        req.params.id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memperbarui layanan.' });
  }
});

// Hapus layanan — HANYA pemilik bengkel
router.delete('/items/:id', requireRole('bengkel'), async (req, res) => {
  try {
    const [own] = await db.query(
      `SELECT l.id FROM layanan l JOIN bengkel b ON b.id = l.bengkel_id
       WHERE l.id = ? AND b.user_id = ?`,
      [req.params.id, req.session.user.id]
    );
    if (!own.length) return res.status(404).json({ error: 'Layanan tidak ditemukan.' });

    await db.query('DELETE FROM layanan WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus layanan.' });
  }
});

function validateItem({ nama, kategori, harga, stok, deskripsi }) {
  if (!nama || !nama.trim()) return 'Nama layanan wajib diisi.';
  if (!KATEGORI.includes(kategori)) return 'Kategori tidak valid.';
  const h = Number(harga);
  if (!Number.isFinite(h) || h < 0) return 'Harga harus angka >= 0.';
  const s = Number(stok);
  if (!Number.isFinite(s) || s < 0) return 'Ketersediaan/stok tidak valid.';
  if (isServiceKategori(kategori) && s > 1) return 'Layanan jasa hanya bisa Tersedia (1) atau Tidak (0).';
  if (!isServiceKategori(kategori) && !Number.isInteger(s)) return 'Stok harus bilangan bulat >= 0.';
  if (!deskripsi || !deskripsi.trim()) return 'Deskripsi wajib diisi.';
  return null;
}

// Kategori jasa hanya mengenal "tersedia (1)" atau "tidak (0)", bukan jumlah stok
function normalizeStok(kategori, stok) {
  const s = Number(stok) || 0;
  if (isServiceKategori(kategori)) return s > 0 ? 1 : 0;
  return Math.max(0, Math.floor(s));
}

module.exports = router;
