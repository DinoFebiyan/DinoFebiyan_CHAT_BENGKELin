require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../src/db');

const SCHEMA_PATH = path.join(__dirname, '..', 'database', 'schema.sql');

async function main() {
  // Buat tabel dari schema.sql (Postgres mendukung multi-statement tanpa parameter)
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await db.query(schema);
  console.log('[OK] Tabel Postgres siap.');

  const [rows] = await db.query('SELECT COUNT(*) AS total FROM users');
  if (Number(rows[0].total) === 0) {
    await seed();
  } else {
    console.log('[SKIP] Data dummy sudah ada, seeding dilewati.');
  }

  await seedPendingBengkel();

  await ensureDummyLayanan();

  // Idempotent: pastikan gambar default & stok jasa selalu benar
  await db.query(
    `UPDATE layanan SET image_url = CASE kategori
      WHEN 'Jasa Bengkel' THEN '/image/TeknisiPerbaikan.jpg'
      WHEN 'Bahan Bakar' THEN '/image/bensin.jpg'
      WHEN 'Kunci Serep' THEN '/image/kunci.jpg'
      WHEN 'Suku Cadang & Oli' THEN '/image/OliShell.jpg'
      ELSE image_url END
     WHERE image_url IS NULL OR image_url = ''`
  );
  await db.query(
    "UPDATE layanan SET stok = 1 WHERE kategori IN ('Jasa Bengkel', 'Kunci Serep') AND stok > 1"
  );

  console.log('[SELESAI]');
  await db.pool.end();
}

async function seed() {
  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // ===== USERS DUMMY =====
  const users = [
    ['Admin BENGKELIN', 'admin@bengkelin.id', hash('admin123'), 'admin'],
    ['Budi Santoso (Bengkel Amanah Motor)', 'budi@bengkelin.id', hash('bengkel123'), 'bengkel'],
    ['Siti Rahma (Lapak BBM & Kunci Rapi)', 'siti@bengkelin.id', hash('bengkel123'), 'bengkel'],
    ['Agus Wijaya (Bengkel Sinar Jaya)', 'agus@bengkelin.id', hash('bengkel123'), 'bengkel'],
  ];
  for (const u of users) {
    await db.query('INSERT INTO users (nama, email, password_hash, role) VALUES (?, ?, ?, ?)', u);
  }

  // ===== BENGKEL DUMMY =====
  const [budi] = await db.query("SELECT id FROM users WHERE email='budi@bengkelin.id'");
  const [siti] = await db.query("SELECT id FROM users WHERE email='siti@bengkelin.id'");
  const [agus] = await db.query("SELECT id FROM users WHERE email='agus@bengkelin.id'");

  const bengkelData = [
    [budi[0].id, 'Bengkel Amanah Motor', '6281234567890', 'Jl. Ahmad Yani No. 12, Jakarta Timur'],
    [siti[0].id, 'Lapak BBM & Kunci Rapi', '6281987654321', 'Jl. Sudirman depan SPBU 34, Bandung'],
    [agus[0].id, 'Bengkel Sinar Jaya', '6281112223334', 'Jl. Diponegoro No. 8, Surabaya'],
  ];
  for (const b of bengkelData) {
    await db.query(
      'INSERT INTO bengkel (user_id, nama_bengkel, nomor_wa, alamat) VALUES (?, ?, ?, ?)',
      b
    );
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
async function ensureDummyLayanan() {
  const [bengkelRows] = await db.query('SELECT id, nama_bengkel FROM bengkel');
  const bengkelMap = Object.fromEntries(bengkelRows.map((b) => [b.nama_bengkel, b.id]));

  const [existing] = await db.query(
    `SELECT nama FROM layanan WHERE nama IN (${LAYANAN_DUMMY.map(() => '?').join(',')})`,
    LAYANAN_DUMMY.map((l) => l[1])
  );
  const existingNames = new Set(existing.map((e) => e.nama));

  let added = 0;
  for (const [namaBengkel, nama, kategori, harga, stok, deskripsi, image] of LAYANAN_DUMMY) {
    if (existingNames.has(nama)) continue;
    const bengkelId = bengkelMap[namaBengkel];
    if (!bengkelId) continue;
    await db.query(
      `INSERT INTO layanan (bengkel_id, nama, kategori, harga, stok, deskripsi, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bengkelId, nama, kategori, harga, stok, deskripsi, image]
    );
    added++;
  }
  if (added) console.log(`[OK] ${added} layanan dummy ditambahkan.`);
}

// Bengkel yang mendaftar mandiri & menunggu persetujuan admin (untuk demo alur approval)
async function seedPendingBengkel() {
  const [exists] = await db.query(
    "SELECT id FROM bengkel WHERE nama_bengkel = 'Bengkel Sejahtera Auto'"
  );
  if (exists.length) return;

  const [emailTaken] = await db.query("SELECT id FROM users WHERE email = 'candra@bengkelin.id'");
  if (emailTaken.length) return;

  await db.query(
    "INSERT INTO users (nama, email, password_hash, role) VALUES (?, ?, ?, 'bengkel') RETURNING id",
    ['Candra Kusuma (Bengkel Sejahtera Auto)', 'candra@bengkelin.id', bcrypt.hashSync('bengkel123', 10)]
  );

  const [u] = await db.query("SELECT id FROM users WHERE email='candra@bengkelin.id'");

  await db.query(
    "INSERT INTO bengkel (user_id, nama_bengkel, nomor_wa, alamat, status) VALUES (?, ?, ?, ?, 'pending')",
    [u[0].id, 'Bengkel Sejahtera Auto', '6285550102030', 'Jl. Gajah Mada No. 45, Semarang']
  );

  console.log('[OK] Bengkel demo pending ditambahkan (candra@bengkelin.id / bengkel123).');
}

main().catch((err) => {
  console.error('[GAGAL]', err.message);
  process.exit(1);
});
