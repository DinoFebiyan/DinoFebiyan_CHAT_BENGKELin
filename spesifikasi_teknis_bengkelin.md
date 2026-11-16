# Spesifikasi Teknis Aplikasi: BENGKELIN!

## 1. Tujuan (Objectives)

**BENGKELIN!** adalah aplikasi web ringan berbasis *client-side* untuk katalog layanan darurat kendaraan (motor & mobil) sekaligus dashboard operasional mini bagi mitra bengkel, penjual bensin eceran, dan ahli kunci serep. Proyek ini dirancang sebagai latihan terstruktur berbasis *vibe coding* dalam **1 hari (8 jam kerja)** tanpa kompleksitas *backend*, autentikasi palsu, maupun dependensi pihak ketiga yang tidak diperlukan, dengan fokus pada kecepatan akses saat kondisi darurat di jalan dan kemudahan pengelolaan stok/slot oleh mitra.

## 2. Pengguna (Target Users)

Aplikasi beroperasi dalam mode *Single-Device Dual-View* (dua tampilan utama dalam satu perangkat yang dapat dialihkan melalui navigasi atas):

1. **Pengendara (Halaman Katalog Publik):** Pengguna di jalan raya yang mengalami kendala kendaraan (ban bocor, kehabisan bensin, kunci tertinggal di jok, aki/lampu bermasalah) dan membutuhkan pencarian layanan darurat secara cepat, mengisi patokan lokasi mogok, serta langsung terhubung ke WhatsApp mitra.
2. **Mitra Bengkel / Lapak (Halaman Dashboard Mitra):** Pemilik bengkel panggilan, penjual BBM eceran, atau ahli kunci yang ingin mengatur nomor WhatsApp penerima pesanan, memperbarui ketersediaan stok/slot layanan, menambah atau mengedit item beserta foto lokal, dan menandai layanan unggulan.

## 3. Daftar Fitur MVP (Minimum Viable Product)

### A. Halaman Katalog Publik (Pengendara)
* **Hero Banner Informasi Layanan:** Penjelasan singkat fungsi BENGKELIN! beserta tombol navigasi cepat ke katalog dan dashboard.
* **Form Konteks Lokasi Darurat & SOS Cepat:**
  * Input `Nama Pemesan / Kendaraan` dan `Patokan Lokasi Darurat / Mogok` yang otomatis disisipkan ke dalam pesan WhatsApp.
  * Tombol **Panggil SOS Darurat** untuk menghubungi mitra secara langsung tanpa memilih item spesifik.
* **8 Layanan/Produk Contoh Bawaan (*Seed Data*):**
  1. Tambal Ban Tubeless Panggilan (`Jasa Bengkel` - Unggulan)
  2. Bensin Pertalite Eceran Antar (2L) (`Bahan Bakar` - Unggulan)
  3. Duplikat Kunci Motor Darurat (`Kunci Serep` - Unggulan)
  4. Ganti Oli Mesin Matic 0.8L + Jasa (`Suku Cadang & Oli` - Unggulan)
  5. Perbaikan Lampu & Kelistrikan (`Jasa Bengkel`)
  6. Bensin Pertamax Eceran Antar (2L) (`Bahan Bakar`)
  7. Jasa Buka Jok Motor Terkunci (`Kunci Serep`)
  8. Air Radiator Coolant Premix (1L) (`Suku Cadang & Oli`, contoh stok `0` / habis)
* **Pencarian, Filter & Pengurutan (*Sorting*):**
  * Pencarian *real-time* berdasarkan nama, deskripsi, atau kategori layanan.
  * Filter dropdown kategori (`Semua kategori`, `Jasa Bengkel`, `Bahan Bakar`, `Kunci Serep`, `Suku Cadang & Oli`).
  * Pengurutan (`Default (unggulan dulu)`, `Harga: Termurah`, `Harga: Termahal`, `Stok / Slot Terbanyak`).
* **Kartu Layanan & Pemesanan Cepat WhatsApp:**
  * Menampilkan foto unggahan mitra atau ilustrasi vektor SVG lokal (bebas hak cipta, ramah *offline*), label merah `Unggulan !`, kategori, deskripsi singkat, harga Rupiah (`Rp`), dan indikator ketersediaan stok/slot.
  * Tombol **Pesan via WhatsApp** yang membuka tautan `https://wa.me/...` dengan *template* pesan darurat terstruktur (otomatis nonaktif saat stok `0`).

### B. Halaman Dashboard Mitra (Pengelola)
* **Ringkasan Statistik Inventaris:**
  * Total Layanan / Produk.
  * Total Stok & Slot Siaga (akumulasi seluruh item).
  * Kategori Aktif.
  * Layanan Unggulan.
* **Pengaturan Nomor WhatsApp Mitra Aktif:**
  * Formulir untuk mengubah dan menyimpan nomor WhatsApp penerima pesanan (otomatis mengonversi awalan `08...` menjadi format internasional `628...`) yang tersimpan di `localStorage`.
* **Operasi CRUD & Manajemen Gambar Lokal:**
  * **Create & Update:** Formulir untuk menambah atau mengedit layanan dengan validasi input (`harga >= 0`, `stok` integer `>= 0`).
  * **Upload Gambar Lokal:** Fitur memilih gambar dari perangkat (`<input type="file" accept="image/*">`) yang otomatis dikompresi melalui HTML5 `<canvas>` menjadi *Data URL* (`image/jpeg`) agar ringan disimpan di `localStorage`, dilengkapi pratinjau dan tombol hapus gambar.
  * **Delete:** Penghapusan item dengan dialog konfirmasi.
* **Persistensi & Reset Demo:**
  * Semua data layanan dan nomor WhatsApp tersinkronisasi otomatis ke `localStorage` (`bengkelin_items_v3` dan `bengkelin_partner_wa_v3`).
  * Tombol **Reset Data Demo** untuk mengembalikan daftar layanan ke 8 data contoh awal.

## 4. Data Model

### A. Entitas Layanan / Produk (`bengkelin_items_v3`)
Disimpan sebagai *array of objects* dalam format JSON:

```json
{
  "id": "srv-001",
  "nama": "Tambal Ban Tubeless Panggilan",
  "kategori": "Jasa Bengkel",
  "harga": 25000,
  "stok": 4,
  "deskripsi": "Penambalan sistem cacing/tip-top di lokasi mogok lengkap dengan isi angin standar.",
  "imageUrl": "",
  "unggulan": true
}
```

**Aturan Validasi Skema:**
* `id`: `string` (unik, wajib diisi, contoh: `srv-001` atau `srv-1710000000`).
* `nama`: `string` (wajib diisi, tidak boleh kosong).
* `kategori`: `enum` (`"Jasa Bengkel" | "Bahan Bakar" | "Kunci Serep" | "Suku Cadang & Oli"`).
* `harga`: `number` (wajib diisi, angka $\ge 0$).
* `stok`: `integer` (wajib diisi, bilangan bulat $\ge 0$).
* `deskripsi`: `string` (wajib diisi).
* `imageUrl`: `string` (opsional; berisi *Data URL* Base64 hasil kompresi unggahan lokal atau string kosong `""` untuk menampilkan ilustrasi SVG kategori lokal).
* `unggulan`: `boolean` (`true` atau `false`).

### B. Konfigurasi Nomor WhatsApp Mitra (`bengkelin_partner_wa_v3`)
* Tipe data: `string` numerik dengan awalan kode negara `62` (contoh default: `"6281234567890"`).

## 5. Non-Functional Requirements (NFR)

1. **Desain Visual & Antarmuka:** Mengusung tema otomotif bersih dengan palet warna merah tegas (`#e11d2a`), putih (`#ffffff`), abu-abu kartu muda (`#f6f7f9`), dan hitam gelap (`#1f242d`) yang responsif pada layar ponsel maupun desktop.
2. **Performa & Kemandirian Aset:** Tanpa *library* CSS/JS eksternal, tanpa *library* peta pihak ketiga, dan menggunakan *inline SVG* lokal sebagai *fallback* gambar sehingga waktu muat sangat cepat dan bebas hak cipta.
3. **Keamanan & Privasi:**
   * Tanpa penyimpanan API Key atau kredensial rahasia.
   * Data contoh menggunakan nomor WhatsApp simulasi non-pribadi (`6281234567890`).
   * Pencegahan XSS (*Cross-Site Scripting*) dengan fungsi sanitasi HTML (`escapeHTML`) sebelum merender data ke DOM, serta penggunaan `rel="noopener noreferrer"` pada pembukaan tab baru WhatsApp.

## 6. Risiko & Mitigasi

| No | Risiko | Dampak | Mitigasi |
| :--- | :--- | :--- | :--- |
| 1 | **AI Scope Creep & Halusinasi Fitur:** AI menambahkan *library* eksternal atau fitur di luar MVP (misal login palsu, *payment gateway*, atau Export/Import yang tidak diminta). | Ukuran bundel membengkak, konflik dependensi, dan instruksi tidak konsisten. | Membatasi spesifikasi secara ketat pada fitur MVP inti dan melakukan peninjauan kode sebelum *deployment*. |
| 2 | **Batas Kapasitas `localStorage` (~5 MB):** Mitra mengunggah banyak foto beresolusi tinggi ke katalog. | Penyimpanan gagal (`QuotaExceededError`) dan data baru tidak tersimpan. | Mengompresi gambar unggahan secara otomatis melalui elemen `<canvas>` (lebar maks. 600px, kualitas JPEG 0.78) serta menangkap *error* penyimpanan dengan notifikasi toast. |
| 3 | **Kesalahan Sintaks atau Input Tidak Valid:** Input harga negatif, stok desimal, atau format nomor WA salah (`08...`). | Perhitungan harga/stok keliru atau tautan WhatsApp gagal terbuka. | Menerapkan sanitasi tipe angka (`Math.max(0, ...)`), konversi otomatis awalan `0` menjadi `62` pada nomor WA, dan validasi form sebelum menyimpan. |

## 7. Out-of-Scope (Di Luar Cakupan MVP)

Untuk menjaga kesederhanaan dan ketepatan waktu latihan 1 hari, fitur berikut **tidak** disertakan:
* Fitur Export JSON dan Import JSON.
* Sistem registrasi, login, atau manajemen akun multi-pengguna.
* Integrasi pembayaran daring (*payment gateway* / *checkout* keranjang).
* Integrasi peta GPS interaktif atau pelacakan lokasi *real-time*.
* Basis data *cloud* atau *backend* API.

## 8. Acceptance Criteria (Kriteria Penerimaan Manual)

Penguji dapat memverifikasi kelayakan aplikasi dengan daftar periksa manual berikut:

* [ ] **AC-01 (Tampilan & Inisialisasi Data):** Halaman awal menampilkan *navbar* merah BENGKELIN!, *hero banner*, dan tepat 8 kartu layanan darurat contoh dengan 1 item berstatus `Habis` (`stok: 0`).
* [ ] **AC-02 (Pencarian, Filter & Sorting):** Pencarian kata kunci `"ban"` menyaring katalog ke layanan terkait ban; filter kategori `"Bahan Bakar"` hanya menampilkan produk BBM; *sorting* `"Harga: Termurah"` mengurutkan kartu dari harga terendah.
* [ ] **AC-03 (Pemesanan & SOS WhatsApp):** Mengisi nama dan patokan lokasi lalu mengklik `"Pesan via WhatsApp"` atau `"Panggil SOS Darurat"` membuka tab baru ke `https://wa.me/...` dengan teks berisi nama pemesan, patokan lokasi, dan detail layanan.
* [ ] **AC-04 (Navigasi & Statistik Dashboard):** Mengklik tab `"Dashboard"` berpindah ke tampilan admin dan menampilkan 4 kartu statistik (Total Layanan, Total Stok & Slot, Kategori Aktif, Layanan Unggulan) yang akurat.
* [ ] **AC-05 (Pengaturan Nomor WA Mitra):** Mengubah nomor WA di Dashboard (misal `081299998888`) otomatis tersimpan sebagai `6281299998888`, bertahan saat halaman di-*refresh*, dan langsung digunakan oleh tombol WhatsApp di Katalog.
* [ ] **AC-06 (CRUD & Upload Gambar Lokal):** Menambah atau mengedit layanan beserta unggahan gambar dari perangkat langsung tampil di tabel Dashboard maupun kartu Katalog, dan tetap tersimpan setelah browser di-*refresh* (`F5`).
* [ ] **AC-07 (Status Stok Kosong & Reset Demo):** Mengubah stok item menjadi `0` menonaktifkan tombol pesan di Katalog; mengklik `"Reset Data Demo"` mengembalikan daftar layanan ke 8 data awal.

## 9. Implementation Plan per Iterasi (Target 1 Hari / 8 Jam)

* **Iterasi 1: Purwarupa Single-File (`index.html`) — Estimasi 2.5 Jam**
  * Membangun struktur HTML semantik, tema visual otomotif merah-putih, *hero banner*, katalog 8 layanan contoh, pencarian, filter kategori, *sorting*, dan generator tautan WhatsApp dalam satu file HTML mandiri.
* **Iterasi 2: Dashboard Mitra, Upload Gambar & Persistensi — Estimasi 2.5 Jam**
  * Mengimplementasikan navigasi tab Katalog/Dashboard, kartu statistik, pengaturan nomor WhatsApp mitra, CRUD layanan, kompresi gambar unggahan lokal via `<canvas>`, serta penyimpanan `localStorage`.
* **Iterasi 3: Pengujian Manual & Pemeriksaan Keamanan — Estimasi 1 Jam**
  * Memverifikasi seluruh *Acceptance Criteria* (`AC-01` s.d. `AC-07`), memastikan sanitasi XSS berjalan, dan menghapus kode/fitur di luar MVP.
* **Iterasi 4: Migrasi ke Struktur Modular Vite — Estimasi 2 Jam**
  * Memecah purwarupa tunggal menjadi proyek Vite (`npm create vite@latest bengkelin -- --template vanilla`) dengan struktur modular:
    * `src/data/seedData.js` (8 data awal & generator SVG lokal)
    * `src/services/storageService.js` (Manajemen `localStorage` item & nomor WA mitra)
    * `src/utils/helpers.js` (Format Rupiah, sanitasi HTML, kompresi gambar `<canvas>`, builder link WhatsApp)
    * `src/ui/catalogView.js` & `src/ui/dashboardView.js` (Komponen antarmuka Katalog & Dashboard)
    * `src/main.js` (Inisialisasi aplikasi & navigasi tampilan)