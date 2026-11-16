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

  await ensureDummyLayanan(conn);

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

  // Tambah status 'suspended' (dinonaktifkan admin) pada enum kolom status
  await conn.query(
    "ALTER TABLE bengkel MODIFY COLUMN status ENUM('pending','active','rejected','suspended') NOT NULL DEFAULT 'pending'"
  );

  // Hapus konsep "unggulan"
  const [unggulanCol] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'layanan' AND COLUMN_NAME = 'unggulan'`,
    [DB_NAME]
  );
  if (unggulanCol.length) {
    await conn.query('ALTER TABLE layanan DROP COLUMN unggulan');
    console.log('[OK] Migrasi: kolom unggulan dihapus.');
  }

  // Normalisasi kategori jasa: hanya mengenal tersedia (1) / tidak (0)
  await conn.query(
    "UPDATE layanan SET stok = 1 WHERE kategori IN ('Jasa Bengkel', 'Kunci Serep') AND stok > 0"
  );

  // Isi gambar default per kategori untuk item tanpa gambar
  await conn.query(
    `UPDATE layanan SET image_url = CASE kategori
      WHEN 'Jasa Bengkel' THEN '/image/TeknisiPerbaikan.jpg'
      WHEN 'Bahan Bakar' THEN '/image/bensin.jpg'
      WHEN 'Kunci Serep' THEN '/image/kunci.jpg'
      WHEN 'Suku Cadang & Oli' THEN '/image/OliShell.jpg'
      ELSE image_url END
     WHERE image_url IS NULL OR image_url = ''`
  );
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

  console.log('[OK] Data dummy dimasukkan:');
  console.log('     - 4 akun (1 admin, 3 bengkel mitra)');
  console.log('     - 3 bengkel mitra aktif');
}

// ===== 20 KATALOG DUMMY (jasa, bensin, oli, kunci serep) =====
// Catatan: kategori jasa ('Jasa Bengkel' & 'Kunci Serep') memakai stok 1 = tersedia, 0 = tidak.
const LAYANAN_DUMMY = [
  // Bengkel Amanah Motor
  ['Bengkel Amanah Motor', 'Tambal Ban Tubeless Panggilan', 'Jasa Bengkel', 25000, 1,
    'Penambalan sistem cacing/tip-top di lokasi mogok lengkap dengan isi angin standar.', '/image/TeknisiPerbaikan.jpg'],
  ['Bengkel Amanah Motor', 'Ganti Oli Mesin Matic 0.8L + Jasa', 'Suku Cadang & Oli', 55000, 8,
    'Oli SAE 10W-30/10W-40 API SL lengkap dengan pemasangan langsung di lokasi.', '/image/OliShell.jpg'],
  ['Bengkel Amanah Motor', 'Perbaikan Lampu & Kelistrikan', 'Jasa Bengkel', 35000, 1,
    'Pengecekan sekring putus, soket kendor, atau penggantian bohlam utama kendaraan.', '/image/TeknisiPerbaikan.jpg'],
  ['Bengkel Amanah Motor', 'Air Radiator Coolant Premix (1L)', 'Suku Cadang & Oli', 22000, 0,
    'Cairan pendingin siap pakai untuk mengatasi indikator suhu mesin overheat.', '/image/OliYamalub.jpeg'],
  ['Bengkel Amanah Motor', 'Ganti Busi + Cek Persneling Matic', 'Jasa Bengkel', 40000, 1,
    'Penggantian busi standar dan pemeriksaan persneling matic di lokasi kendaraan.', '/image/TeknisiPerbaikan.jpg'],
  ['Bengkel Amanah Motor', 'Servis Ringan Motor Matic Panggilan', 'Jasa Bengkel', 85000, 1,
    'Paket ganti oli, cek baterai, dan tuning ringan tanpa perlu ke bengkel.', '/image/TeknisiPerbaikan.jpg'],
  ['Bengkel Amanah Motor', 'Kampas Rem Depan + Jasa Pasang', 'Suku Cadang & Oli', 65000, 5,
    'Kampas rem berkualitas dengan pemasangan langsung di lokasi Anda.', '/image/OliShell.jpg'],
  // Lapak BBM & Kunci Rapi
  ['Lapak BBM & Kunci Rapi', 'Bensin Pertalite Eceran Antar (2L)', 'Bahan Bakar', 24000, 10,
    'Paket darurat kehabisan bensin 2 liter dengan jerigen bersih siap antar cepat.', '/image/bensin.jpg'],
  ['Lapak BBM & Kunci Rapi', 'Bensin Pertamax Eceran Antar (2L)', 'Bahan Bakar', 29000, 6,
    'Bahan bakar RON 92 kemasan aman untuk motor atau mobil injeksi yang kehabisan BBM.', '/image/bensin.jpg'],
  ['Lapak BBM & Kunci Rapi', 'Duplikat Kunci Motor Darurat', 'Kunci Serep', 45000, 1,
    'Pembuatan anak kunci cadangan presisi di tempat untuk kunci patah atau hilang.', '/image/kunci.jpg'],
  ['Lapak BBM & Kunci Rapi', 'Jasa Buka Jok Motor Terkunci', 'Kunci Serep', 30000, 1,
    'Penanganan kunci tertinggal di dalam bagasi jok tanpa merusak rumah kunci.', '/image/kunci.jpg'],
  ['Lapak BBM & Kunci Rapi', 'Bensin Pertamax Turbo Antar (1L)', 'Bahan Bakar', 20000, 8,
    'RON 98 untuk kendaraan performa tinggi, kemasan 1 liter siap antar.', '/image/bensin.jpg'],
  ['Lapak BBM & Kunci Rapi', 'Solar Eceran Antar (2L)', 'Bahan Bakar', 18000, 4,
    'Solar DAR kemasan 2 liter untuk mobil diesel yang kehabisan BBM di jalan.', '/image/bensin.jpg'],
  ['Lapak BBM & Kunci Rapi', 'Duplikat Kunci Mobil + Remote', 'Kunci Serep', 250000, 1,
    'Duplikasi kunci mobil lengkap dengan program remote di tempat parkir Anda.', '/image/kunci.jpg'],
  ['Lapak BBM & Kunci Rapi', 'Ganti Baterai Kunci Remote Kendaraan', 'Kunci Serep', 35000, 1,
    'Penggantian baterai kunci remote motor/mobil langsung di lokasi, cepat & rapi.', '/image/kunci.jpg'],
  // Bengkel Sinar Jaya
  ['Bengkel Sinar Jaya', 'Servis Motor Darurat Tidak Nyala', 'Jasa Bengkel', 60000, 1,
    'Pemeriksaan aki, busi, dan sistem pengapian di lokasi mogok kendaraan.', '/image/TeknisiPerbaikan.jpg'],
  ['Bengkel Sinar Jaya', 'Isi Angin & Cek Tekanan Ban Darurat', 'Jasa Bengkel', 15000, 1,
    'Kompresor portable siap datang untuk isi angin ban kempes di jalan.', '/image/TeknisiPerbaikan.jpg'],
  ['Bengkel Sinar Jaya', 'Jumper Aki Motor & Mobil Darurat', 'Jasa Bengkel', 40000, 1,
    'Layakan jumper aki dengan kabel standar agar kendaraan bisa menyala kembali.', '/image/TeknisiPerbaikan.jpg'],
  ['Bengkel Sinar Jaya', 'Ganti Oli Mesin Mobil + Filter Oli', 'Suku Cadang & Oli', 180000, 4,
    'Paket ganti oli mobil beserta filter oli untuk kapasitas standar 4L.', '/image/OliShell.jpg'],
  ['Bengkel Sinar Jaya', 'Oli Gardan & Transmisi Motor Matic', 'Suku Cadang & Oli', 48000, 6,
    'Penggantian oli gardan motor matic dengan pemeriksaan kebocoran.', '/image/OliYamalub.jpeg'],
];

// Pastikan seluruh katalog dummy ada (aman dijalankan berulang)
async function ensureDummyLayanan(conn) {
  const [bengkelRows] = await conn.query('SELECT id, nama_bengkel FROM bengkel');
  const bengkelMap = Object.fromEntries(bengkelRows.map((b) => [b.nama_bengkel, b.id]));

  const [existing] = await conn.query(
    `SELECT nama FROM layanan WHERE nama IN (${LAYANAN_DUMMY.map(() => '?').join(',')})`,
    LAYANAN_DUMMY.map((l) => l[1])
  );
  const existingNames = new Set(existing.map((e) => e.nama));

  let added = 0;
  for (const [namaBengkel, nama, kategori, harga, stok, deskripsi, image] of LAYANAN_DUMMY) {
    if (existingNames.has(nama)) continue;
    const bengkelId = bengkelMap[namaBengkel];
    if (!bengkelId) continue;
    await conn.query(
      `INSERT INTO layanan (bengkel_id, nama, kategori, harga, stok, deskripsi, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bengkelId, nama, kategori, harga, stok, deskripsi, image]
    );
    added++;
  }
  if (added) console.log(`[OK] ${added} layanan dummy ditambahkan.`);
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
