const mysql = require('mysql2/promise');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-south-1' });

let poolPromise = null;

// Fetches DB credentials from Secrets Manager (instead of .env) and builds
// the real mysql2 pool exactly ONCE - cached in poolPromise so we don't hit
// Secrets Manager or open a fresh pool on every single query.
async function initPool() {
  const secretResult = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN })
  );
  const creds = JSON.parse(secretResult.SecretString);

  // host/port/database name are NOT secrets (they're not useful to an
  // attacker without the password too) - only username/password move to
  // Secrets Manager. host/port/database stay in .env as before.
  return mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: creds.username,
    password: creds.password,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

function getPool() {
  if (!poolPromise) {
    poolPromise = initPool();
  }
  return poolPromise;
}

// Wrapper exposing the SAME method signatures every controller already
// calls (pool.query(...), pool.getConnection()) - so productController.js
// and orderController.js need ZERO changes, even though credential fetching
// underneath is now async and comes from Secrets Manager, not .env.
module.exports = {
  query: async (...args) => {
    const pool = await getPool();
    return pool.query(...args);
  },
  getConnection: async () => {
    const pool = await getPool();
    return pool.getConnection();
  },
};