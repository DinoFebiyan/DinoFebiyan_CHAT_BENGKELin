# Catatan

## 1. Tujuan Latihan
- Memahami alur kerja pengembangan perangkat lunak berbasis *vibe coding* secara terstruktur menggunakan AI coding agent (OpenCode) dari tahap penyusunan spesifikasi (`SPEC.md`), pembuatan purwarupa, modularisasi, hingga *deployment*.
- Melatih penyusunan spesifikasi produk yang terarah dan ketat (*scope control*) agar instruksi ke AI tetap konsisten, fokus pada MVP, dan terukur.
- Menerapkan iterasi bertahap, pengujian fungsionalitas secara manual, serta pemeriksaan keamanan dasar (seperti sanitasi input agar bebas dari celah XSS) sebelum aplikasi dideploy.

## 2. Target Aplikasi BENGKELIN!
- Membangun aplikasi web layanan darurat kendaraan bernama **BENGKELIN!** yang mencakup dua tampilan utama pada satu perangkat:
  1. **Halaman Katalog Publik (Pengendara):** Menampilkan daftar layanan dan produk darurat kendaraan (Jasa Bengkel, Bahan Bakar eceran antar, Kunci Serep, serta Suku Cadang & Oli) lengkap dengan form patokan lokasi darurat, pencarian, filter kategori, pengurutan (*sorting*), status ketersediaan stok/slot mekanik, dan tombol pemesanan/panggilan cepat via WhatsApp (termasuk tombol SOS darurat).
  2. **Halaman Dashboard Mitra (Pengelola Bengkel/Lapak):** Menyediakan ringkasan statistik layanan dan slot aktif, pengaturan nomor WhatsApp mitra penerima pesanan, serta fitur manajemen katalog (CRUD: Tambah, Ubah, Hapus, unggah foto lokal, pengaturan stok/slot, status unggulan, dan Reset Data Demo) yang tersinkronisasi secara lokal menggunakan `localStorage`.

## 3. Risiko Penggunaan AI yang Ingin Diperiksa
- **Scope Creep & Halusinasi Fitur:** AI terkadang menambahkan *library* eksternal (seperti library peta, *framework* CSS/UI berat, atau *backend/autentikasi* palsu) maupun fitur tambahan di luar spesifikasi MVP yang telah ditetapkan.
- **Dampak Teknis & Keamanan:** Penambahan kode atau dependensi yang tidak diminta dapat memperbesar ukuran bundel aplikasi, memicu konflik versi, merusak konsistensi antarmuka, serta membuka celah keamanan (seperti eksekusi skrip berbahaya dari input formulir atau URL) dari kode yang tidak diperiksa.