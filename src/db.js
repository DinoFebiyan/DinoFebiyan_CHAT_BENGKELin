// Koneksi Postgres (Neon / Vercel Postgres) dengan antarmuka ala mysql2:
//   const [rows] = await db.query(sql, params)
// Placeholder MySQL `?` dikonversi otomatis ke `$1, $2, ...`
const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRESQL_URL ||
  '';

if (!connectionString) {
  throw new Error('DATABASE_URL belum diisi. Gunakan URL Postgres (Neon) dari Vercel.');
}

const needsSsl = /sslmode=require/.test(connectionString) || /neon\.tech/.test(connectionString);

const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL || 5),
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

function toPgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function query(sql, params = []) {
  const res = await pool.query(toPgSql(sql), params);
  const rows = res.rows || [];
  // Kompatibilitas dengan kode bergaya mysql2:
  rows.insertId = rows.length && rows[0].id !== undefined ? rows[0].id : 0;
  rows.affectedRows = res.rowCount || 0;
  return [rows];
}

module.exports = { query, pool };
