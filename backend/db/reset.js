// Drops every Prodrome table (including the first-draft ones) so the schema and sample data can be rebuilt.
// Destructive, so it refuses to run without --yes.
const db = require("../src/db");

const TABLES = ["symptom_logs", "working_sessions", "device_readings", "profiles", "sensor_readings", "devices", "users"];

async function reset() {
  if (!process.argv.includes("--yes")) {
    console.error("This deletes ALL Prodrome data. Re-run with --yes to confirm.");
    process.exit(1);
  }
  for (const table of TABLES) await db.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
  console.log("Dropped:", TABLES.join(", "));
  await db.end();
}

reset().catch(error => {
  console.error("Reset failed:", error.message);
  process.exit(1);
});
