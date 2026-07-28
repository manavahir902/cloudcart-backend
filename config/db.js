const mysql = require('mysql2/promise');

// Why a POOL instead of a single connection:
// A single connection can only handle one query at a time - if two requests
// hit the API simultaneously, one has to wait. A pool keeps multiple ready
// connections open and hands them out as needed, which is essential once
// you have real concurrent traffic (and you WILL, once the ASG is serving
// requests across 2+ instances, each handling multiple users at once).
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,   // max simultaneous connections per instance - safe default for t2/t3.micro
  queueLimit: 0,
});

module.exports = pool;
