const fs = require("node:fs");
const path = require("node:path");
const db = require("../src/db");

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await db.query(sql);
  const { rows } = await db.query("SELECT hypertable_name FROM timescaledb_information.hypertables");
  console.log("Schema applied. Hypertables:", rows.map(row => row.hypertable_name).join(", ") || "none");
  await db.end();
}

migrate().catch(error => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
