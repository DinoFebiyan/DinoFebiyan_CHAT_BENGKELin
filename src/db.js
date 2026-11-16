const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bengkelin',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL || 5),
  charset: 'utf8mb4_unicode_ci',
  // Aktifkan SSL untuk database remote (mis. Aiven, PlanetScale, TiDB, Railway):
  // set DB_SSL=1 di environment
  ...(process.env.DB_SSL === '1' ? { ssl: { rejectUnauthorized: true } } : {}),
});

module.exports = pool;
