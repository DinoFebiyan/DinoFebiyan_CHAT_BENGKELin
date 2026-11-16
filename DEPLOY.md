# Panduan Deploy BENGKELIN! ke Vercel

Aplikasi memakai **Postgres (Neon)** yang bisa dibuat langsung dari dashboard
Vercel — tanpa akun layanan pihak ketiga tambahan.

## 1. Buat Database Postgres dari Vercel

1. Bukalah project Anda di https://vercel.com lalu masuk tab **Storage**.
2. Klik **Create Database** -> pilih **Neon Postgres** (tier free) -> beri nama
   (mis. `bengkelin-db`) -> pilih region terdekat (Singapore) -> **Create**.
3. Saat diminta, hubungkan database ke project BENGKELIN. Vercel otomatis
   menambahkan environment variable `POSTGRES_URL` ke project.
4. Buka tab database -> **Get Connection String** -> salin URL-nya (diakhiri
   `?sslmode=require`).

## 2. Isi Database dengan Schema + Data Dummy

Dari komputer lokal, tempel URL database ke `.env`:

```
DATABASE_URL=postgres://...?sslmode=require
```

Lalu jalankan:

```
npm install
node scripts/setup-db.js
```

Perintah ini membuat tabel `users`, `bengkel`, `layanan` beserta akun admin,
mitra dummy, dan 20 katalog contoh.

## 3. Deploy

Setelah database terhubung ke project (langkah 1), cukup **push ke GitHub** —
Vercel melakukan redeploy otomatis:

```
git add -A
git commit -m "migrasi postgres"
git push bengkelin main
```

Tambahkan juga di Project Settings -> Environment Variables (jika belum
terisi otomatis): `SESSION_SECRET` (string acak panjang, bebas).

## 4. Verifikasi

- Buka URL Vercel -> katalog tampil (21 item).
- Login admin `admin@bengkelin.id` / `admin123`.
- Coba login bengkel `budi@bengkelin.id` / `bengkel123` dan tambah layanan.

## Catatan Teknis

- Database memakai Postgres (Neon). Lapisan query diberi adaptor sehingga kode
  tetap memakai gaya `db.query(sql, params)` dengan placeholder `?`.
- Sesi login memakai **cookie bertanda tangan HMAC** (stateless) sehingga aman
  untuk arsitektur serverless Vercel.
- Endpoint API diarahkan ke fungsi serverless `api/index.js` melalui
  `vercel.json`; file statis (HTML/CSS/JS/gambar) dilayani langsung oleh CDN
  Vercel.
- `DB_POOL=5` menjaga jumlah koneksi tetap rendah karena setiap instance
  serverless membuat pool sendiri.
