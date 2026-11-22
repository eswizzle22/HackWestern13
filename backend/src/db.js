const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

// One shared pool: the server borrows a connection per query and returns it.
module.exports = new Pool({ connectionString: process.env.DATABASE_URL });
