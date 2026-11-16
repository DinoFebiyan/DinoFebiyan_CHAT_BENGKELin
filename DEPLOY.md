# Panduan Deploy BENGKELIN! ke Vercel

Aplikasi butuh database MySQL. Vercel tidak menyediakan MySQL, jadi gunakan
layanan MySQL cloud gratisan seperti **Aiven Free**, **TiDB Cloud**, atau
**Railway**. Di bawah ini langkah lengkapnya.

## 1. Siapkan Database MySQL Cloud

1. Buat akun di salah satu layanan di atas lalu buat database MySQL baru.
2. Catat kredensialnya: host, port, user, password, nama database.
3. Pastikan koneksi mengizinkan akses publik (biasanya default).

## 2. Isi Database dengan Schema + Data Dummy

Dari komputer lokal, jalankan setup mengarah ke database remote:

```
set DB_HOST=<host-remote>
set DB_PORT=<port>
set DB_USER=<user>
set DB_PASSWORD=<password>
set DB_NAME=<nama-db>
set DB_SSL=1
node scripts/setup-db.js
```

Perintah ini membuat tabel `users`, `bengkel`, `layanan` beserta akun admin,
mitra dummy, dan 20 katalog contoh.

## 3. Push ke GitHub

```
git add -A
git commit -m "versi 3-siap-deploy"
git push bengkelin main
```

(remote `bengkelin` mengarah ke https://github.com/DinoFebiyan/DinoFebiyan_CHAT_BENGKELin.git)

## 4. Import ke Vercel

1. Buka https://vercel.com/new lalu pilih repository
   `DinoFebiyan/DinoFebiyan_CHAT_BENGKELin`.
2. Framework Preset: **Other** (tidak perlu build command).
3. Tambahkan Environment Variables:

   | Nama            | Nilai                                  |
   |-----------------|----------------------------------------|
   | DB_HOST         | host database remote                   |
   | DB_PORT         | port (biasanya 3306)                   |
   | DB_USER         | user database                          |
   | DB_PASSWORD     | password database                      |
   | DB_NAME         | nama database                          |
   | DB_SSL          | 1                                      |
   | DB_POOL         | 5                                      |
   | SESSION_SECRET  | string acak panjang (bebas)            |

4. Klik **Deploy**. Setelah selesai, aplikasi aktif di URL Vercel Anda.

## 5. Verifikasi

- Buka URL Vercel -> katalog tampil (21 item).
- Login admin `admin@bengkelin.id` / `admin123`.
- Coba login bengkel `budi@bengkelin.id` / `bengkel123` dan tambah layanan.

## Catatan Teknis

- Sesi login memakai **cookie bertanda tangan HMAC** (stateless) sehingga aman
  untuk arsitektur serverless Vercel.
- Endpoint API diarahkan ke fungsi serverless `api/index.js` melalui
  `vercel.json`; file statis (HTML/CSS/JS/gambar) dilayani langsung oleh CDN
  Vercel.
- `DB_POOL=5` menjaga jumlah koneksi tetap rendah karena setiap instance
  serverless membuat pool sendiri.
