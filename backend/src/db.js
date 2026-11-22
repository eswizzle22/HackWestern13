const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

// One shared pool: the server borrows a connection per query and returns it.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Runs fn(client) in a transaction: commits when it finishes, rolls back if it throws.
pool.transaction = async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

module.exports = pool;
