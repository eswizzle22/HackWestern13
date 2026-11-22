const db = require("./db");
const app = require("./app");
const { SWEEP_MS } = require("./config");
const { sweepSessions } = require("./sessions");

const port = Number(process.env.PORT || 3000);

// Ends running sessions whose hourly "still working?" check-in went unanswered, even if nobody has the page open.
async function runSweep() {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const closed = await sweepSessions(client);
    await client.query("COMMIT");
    if (closed.length) console.log(`Ended ${closed.length} session(s) after an unanswered check-in:`, closed.join(", "));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Session sweep failed:", error.message);
  } finally {
    client.release();
  }
}
runSweep();
setInterval(runSweep, SWEEP_MS);

app.listen(port, () => console.log(`Prodrome backend listening on http://localhost:${port}`));
