-- Schema BENGKELIN! (Postgres / Neon untuk deploy Vercel)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'bengkel')),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nama TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bengkel (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nama_bengkel TEXT NOT NULL,
  alamat TEXT NOT NULL DEFAULT '',
  nomor_wa TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'rejected', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS layanan (
  id SERIAL PRIMARY KEY,
  bengkel_id INTEGER NOT NULL REFERENCES bengkel(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  kategori TEXT NOT NULL,
  harga INTEGER NOT NULL DEFAULT 0,
  stok INTEGER NOT NULL DEFAULT 0,
  deskripsi TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
