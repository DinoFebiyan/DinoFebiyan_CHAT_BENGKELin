// Koneksi Postgres (Neon / Vercel Postgres) dengan antarmuka ala mysql2:
//   const [rows] = await db.query(sql, params)
// Placeholder MySQL `?` dikonversi otomatis ke `$1, $2, ...`
//
// Pool dibuat lazily agar proses tidak crash saat modul dimuat tanpa
// environment variable (mis. di build/local tanpa DATABASE_URL).
const { Pool } = require('pg');

let pool = null;

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRESQL_URL ||
    ''
  );
}

function getPool() {
  if (pool) return pool;
  const cs = connectionString();
  if (!cs) {
    throw new Error(
      'Database belum dikonfigurasi: buat Neon Postgres di tab Storage Vercel lalu set env POSTGRES_URL (atau DATABASE_URL).'
    );
  }
  const needsSsl = /sslmode=require/.test(cs) || /neon\.tech/.test(cs);
  pool = new Pool({
    connectionString: cs,
    max: Number(process.env.DB_POOL || 5),
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  // Cegah crash proses saat koneksi idle terputus (serverless)
  pool.on('error', () => {});
  return pool;
}

function toPgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function query(sql, params = []) {
  const res = await getPool().query(toPgSql(sql), params);
  const rows = res.rows || [];
  // Kompatibilitas dengan kode bergaya mysql2:
  rows.insertId = rows.length && rows[0].id !== undefined ? rows[0].id : 0;
  rows.affectedRows = res.rowCount || 0;
  return [rows];
}

module.exports = { query, getPool };
