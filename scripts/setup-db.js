require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_NAME = 'bengkelin';

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};

const SCHEMA_PATH = path.join(__dirname, '..', 'database', 'schema.sql');

async function main() {
  const conn = await mysql.createConnection(config);

  // Buat database & tabel dari schema.sql
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await conn.query(schema);
  console.log('[OK] Database & tabel siap.');

  await conn.changeUser({ database: DB_NAME });

  await migrate(conn);

  const [rows] = await conn.query('SELECT COUNT(*) AS total FROM users');
  if (rows[0].total === 0) {
    await seed(conn);
  } else {
    console.log('[SKIP] Data dummy sudah ada, seeding dilewati.');
  }

  await seedPendingBengkel(conn);

  console.log('[SELESAI]');
  await conn.end();
}

// Migrasi dari versi lama (is_active -> status, hapus akun pengguna)
async function migrate(conn) {
  const [statusCol] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bengkel' AND COLUMN_NAME = 'status'`,
    [DB_NAME]
  );
  if (!statusCol.length) {
    await conn.query(
      "ALTER TABLE bengkel ADD COLUMN status ENUM('pending','active','rejected') NOT NULL DEFAULT 'pending'"
    );
    await conn.query("UPDATE bengkel SET status = 'active'");
    console.log('[OK] Migrasi: kolom status bengkel ditambahkan (mitra lama => active).');
  }

  const [isActiveCol] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bengkel' AND COLUMN_NAME = 'is_active'`,
    [DB_NAME]
  );
  if (isActiveCol.length) {
    await conn.query('ALTER TABLE bengkel DROP COLUMN is_active');
    console.log('[OK] Migrasi: kolom is_active dihapus.');
  }

  await conn.query("DELETE FROM users WHERE role = 'pengguna'");
}

async function seed(conn) {
  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // ===== USERS DUMMY =====
  const users = [
    ['Admin BENGKELIN', 'admin@bengkelin.id', hash('admin123'), 'admin'],
    ['Budi Santoso (Bengkel Amanah Motor)', 'budi@bengkelin.id', hash('bengkel123'), 'bengkel'],
    ['Siti Rahma (Lapak BBM & Kunci Rapi)', 'siti@bengkelin.id', hash('bengkel123'), 'bengkel'],
    ['Agus Wijaya (Bengkel Sinar Jaya)', 'agus@bengkelin.id', hash('bengkel123'), 'bengkel'],
  ];
  for (const u of users) {
    await conn.query(
      'INSERT INTO users (nama, email, password_hash, role) VALUES (?, ?, ?, ?)',
      u
    );
  }

  // ===== BENGKEL DUMMY =====
  const [budi] = await conn.query("SELECT id FROM users WHERE email='budi@bengkelin.id'");
  const [siti] = await conn.query("SELECT id FROM users WHERE email='siti@bengkelin.id'");
  const [agus] = await conn.query("SELECT id FROM users WHERE email='agus@bengkelin.id'");

  const bengkelData = [
    [budi[0].id, 'Bengkel Amanah Motor', '6281234567890', 'Jl. Ahmad Yani No. 12, Jakarta Timur'],
    [siti[0].id, 'Lapak BBM & Kunci Rapi', '6281987654321', 'Jl. Sudirman depan SPBU 34, Bandung'],
    [agus[0].id, 'Bengkel Sinar Jaya', '6281112223334', 'Jl. Diponegoro No. 8, Surabaya'],
  ];
  const bengkelIds = [];
  for (const b of bengkelData) {
    const [res] = await conn.query(
      'INSERT INTO bengkel (user_id, nama_bengkel, nomor_wa, alamat) VALUES (?, ?, ?, ?)',
      b
    );
    bengkelIds.push(res.insertId);
  }

  // ===== LAYANAN DUMMY (8 item sesuai spesifikasi, tersebar di 3 bengkel) =====
  // Catatan: kategori jasa ('Jasa Bengkel' & 'Kunci Serep') memakai stok 1 = tersedia, 0 = tidak.
  const layanan = [
    // Bengkel Amanah Motor (id bengkel 1)
    [bengkelIds[0], 'Tambal Ban Tubeless Panggilan', 'Jasa Bengkel', 25000, 1,
      'Penambalan sistem cacing/tip-top di lokasi mogok lengkap dengan isi angin standar.', 1],
    [bengkelIds[0], 'Ganti Oli Mesin Matic 0.8L + Jasa', 'Suku Cadang & Oli', 55000, 8,
      'Oli SAE 10W-30/10W-40 API SL lengkap dengan pemasangan langsung di lokasi.', 1],
    [bengkelIds[0], 'Perbaikan Lampu & Kelistrikan', 'Jasa Bengkel', 35000, 1,
      'Pengecekan sekring putus, soket kendor, atau penggantian bohlam utama kendaraan.', 0],
    [bengkelIds[0], 'Air Radiator Coolant Premix (1L)', 'Suku Cadang & Oli', 22000, 0,
      'Cairan pendingin siap pakai untuk mengatasi indikator suhu mesin overheat.', 0],
    // Lapak BBM & Kunci Rapi (id bengkel 2)
    [bengkelIds[1], 'Bensin Pertalite Eceran Antar (2L)', 'Bahan Bakar', 24000, 10,
      'Paket darurat kehabisan bensin 2 liter dengan jerigen bersih siap antar cepat.', 1],
    [bengkelIds[1], 'Bensin Pertamax Eceran Antar (2L)', 'Bahan Bakar', 29000, 6,
      'Bahan bakar RON 92 kemasan aman untuk motor atau mobil injeksi yang kehabisan BBM.', 0],
    [bengkelIds[1], 'Duplikat Kunci Motor Darurat', 'Kunci Serep', 45000, 1,
      'Pembuatan anak kunci cadangan presisi di tempat untuk kunci patah atau hilang.', 1],
    [bengkelIds[1], 'Jasa Buka Jok Motor Terkunci', 'Kunci Serep', 30000, 1,
      'Penanganan kunci tertinggal di dalam bagasi jok tanpa merusak rumah kunci.', 0],
    // Bengkel Sinar Jaya (id bengkel 3)
    [bengkelIds[2], 'Servis Motor Darurat Tidak Nyala', 'Jasa Bengkel', 60000, 1,
      'Pemeriksaan aki, busi, dan sistem pengapian di lokasi mogok kendaraan.', 0],
    [bengkelIds[2], 'Isi Angin & Cek Tekanan Ban Darurat', 'Jasa Bengkel', 15000, 1,
      'Kompresor portable siap datang untuk isi angin ban kempes di jalan.', 0],
  ];
  for (const l of layanan) {
    await conn.query(
      `INSERT INTO layanan (bengkel_id, nama, kategori, harga, stok, deskripsi, unggulan)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      l
    );
  }

  console.log('[OK] Data dummy dimasukkan:');
  console.log('     - 4 akun (1 admin, 3 bengkel mitra)');
  console.log('     - 3 bengkel mitra aktif');
  console.log('     - 10 layanan/produk');
}

// Bengkel yang mendaftar mandiri & menunggu persetujuan admin (untuk demo alur approval)
async function seedPendingBengkel(conn) {
  const [exists] = await conn.query(
    "SELECT id FROM bengkel WHERE nama_bengkel = 'Bengkel Sejahtera Auto'"
  );
  if (exists.length) return;

  const [emailTaken] = await conn.query("SELECT id FROM users WHERE email = 'candra@bengkelin.id'");
  if (emailTaken.length) return;

  const hash = (pw) => bcrypt.hashSync(pw, 10);
  const [u] = await conn.query(
    "INSERT INTO users (nama, email, password_hash, role) VALUES (?, ?, ?, 'bengkel')",
    ['Candra Halim (Bengkel Sejahtera Auto)', 'candra@bengkelin.id', hash('bengkel123')]
  );
  await conn.query(
    "INSERT INTO bengkel (user_id, nama_bengkel, nomor_wa, alamat, status) VALUES (?, ?, ?, ?, 'pending')",
    [u.insertId, 'Bengkel Sejahtera Auto', '6285550102030', 'Jl. Gajah Mada No. 45, Semarang']
  );
  console.log('[OK] Dummy bengkel pending ditambahkan: candra@bengkelin.id / bengkel123');
}

main().catch((err) => {
  console.error('[GAGAL]', err.message);
  process.exit(1);
});
