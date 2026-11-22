const db = require("./db");
const app = require("./app");
const { SWEEP_MS } = require("./config");
const { sweepSessions } = require("./sessions");

const port = Number(process.env.PORT || 3000);

// A switched-off Arduino sends nothing, so something has to notice the silence and close its session.
async function runSweep() {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const closed = await sweepSessions(client);
    await client.query("COMMIT");
    if (closed.length) console.log(`Closed ${closed.length} session(s) after the device went quiet:`, closed.join(", "));
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
