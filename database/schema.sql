-- Skema Database BENGKELIN!
CREATE DATABASE IF NOT EXISTS bengkelin
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bengkelin;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'bengkel', 'pengguna') NOT NULL DEFAULT 'pengguna',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS bengkel (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL UNIQUE,
  nama_bengkel VARCHAR(150) NOT NULL,
  nomor_wa VARCHAR(20) NOT NULL DEFAULT '6281234567890',
  alamat VARCHAR(255) NOT NULL DEFAULT '',
  status ENUM('pending', 'active', 'rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS layanan (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bengkel_id INT UNSIGNED NOT NULL,
  nama VARCHAR(150) NOT NULL,
  kategori ENUM('Jasa Bengkel', 'Bahan Bakar', 'Kunci Serep', 'Suku Cadang & Oli') NOT NULL,
  harga INT UNSIGNED NOT NULL DEFAULT 0,
  stok INT NOT NULL DEFAULT 0,
  deskripsi TEXT NOT NULL,
  image_url LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bengkel_id) REFERENCES bengkel(id) ON DELETE CASCADE,
  INDEX idx_layanan_kategori (kategori),
  INDEX idx_layanan_bengkel (bengkel_id)
) ENGINE = InnoDB;
