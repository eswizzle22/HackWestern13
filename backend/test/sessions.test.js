const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../src/db");
const { ingestReading, sweepSessions } = require("../src/sessions");
const { SESSION_TIMEOUT_MS, BATCH_MS } = require("../src/config");

const T0 = new Date("2026-01-05T09:00:00Z");
const at = seconds => new Date(T0.getTime() + seconds * 1000);

// Runs fn inside a transaction that is always rolled back, so tests leave nothing behind.
async function withDevice(fn, { owned = true } = {}) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (owned) await client.query("INSERT INTO profiles (user_id, name, device_id) VALUES ('test-user-sessions', 'Test', 'TEST-DEV')");
    await fn(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

const reading = (seconds, light, air, deviceId = "TEST-DEV") => ({ deviceId, light, air, time: at(seconds) });
const sessions = async (client, deviceId = "TEST-DEV") => (await client.query("SELECT * FROM working_sessions WHERE device_id = $1 ORDER BY started_at", [deviceId])).rows;

after(() => db.end());

test("the first reading opens a session, back-dated by one batch", async () => {
  await withDevice(async client => {
    const result = await ingestReading(client, reading(0, 100, 200));
    assert.equal(result.opened, true);
    const [session] = await sessions(client);
    assert.equal(session.ended_at, null);
    assert.equal(session.started_at.getTime(), T0.getTime() - BATCH_MS);
    assert.equal(session.user_id, "test-user-sessions");
  });
});

test("readings inside the timeout continue the same session", async () => {
  await withDevice(async client => {
    const first = await ingestReading(client, reading(0, 100, 200));
    const second = await ingestReading(client, reading(30, 200, 300));
    const third = await ingestReading(client, reading(60, 300, 400));
    assert.equal(second.opened, false);
    assert.equal(third.sessionId, first.sessionId);
    assert.equal((await sessions(client)).length, 1);
  });
});

test("a silence longer than the timeout closes the session at its last reading and opens a new one", async () => {
  await withDevice(async client => {
    const first = await ingestReading(client, reading(0, 100, 200));
    await ingestReading(client, reading(30, 200, 300));
    await ingestReading(client, reading(60, 300, 400));
    const next = await ingestReading(client, reading(60 + SESSION_TIMEOUT_MS / 1000 + 1, 50, 50));
    assert.notEqual(next.sessionId, first.sessionId);
    assert.equal(next.opened, true);
    const [old, current] = await sessions(client);
    assert.equal(old.ended_at.getTime(), at(60).getTime());
    assert.equal(current.ended_at, null);
  });
});

test("a gap of exactly the timeout does not split the session", async () => {
  await withDevice(async client => {
    const first = await ingestReading(client, reading(0, 100, 200));
    const next = await ingestReading(client, reading(SESSION_TIMEOUT_MS / 1000, 100, 200));
    assert.equal(next.sessionId, first.sessionId);
  });
});

test("closing a session records its summary", async () => {
  await withDevice(async client => {
    await ingestReading(client, reading(0, 100, 200));
    await ingestReading(client, reading(30, 200, 300));
    await ingestReading(client, reading(60, 300, 400));
    await sweepSessions(client, at(60 + SESSION_TIMEOUT_MS / 1000 + 1));
    const [session] = await sessions(client);
    assert.equal(session.ended_at.getTime(), at(60).getTime());
    assert.equal(session.avg_light, 200);
    assert.equal(session.avg_air, 300);
    assert.equal(session.max_light, 300);
    assert.equal(session.max_air, 400);
    assert.equal(session.reading_count, 3);
  });
});

test("the sweep leaves a device that is still reporting alone", async () => {
  await withDevice(async client => {
    await ingestReading(client, reading(0, 100, 200));
    const closed = await sweepSessions(client, at(SESSION_TIMEOUT_MS / 1000 - 1));
    assert.deepEqual(closed, []);
    assert.equal((await sessions(client))[0].ended_at, null);
  });
});

test("a late, out-of-order reading is stored without changing sessions", async () => {
  await withDevice(async client => {
    await ingestReading(client, reading(0, 100, 200));
    await ingestReading(client, reading(60, 100, 200));
    const late = await ingestReading(client, reading(30, 120, 220));
    assert.equal(late.sessionId, null);
    assert.equal((await sessions(client)).length, 1);
    const { rows } = await client.query("SELECT count(*)::int AS n FROM device_readings WHERE device_id = 'TEST-DEV'");
    assert.equal(rows[0].n, 3);
  });
});

test("readings from a device nobody owns are stored but open no session", async () => {
  await withDevice(async client => {
    const result = await ingestReading(client, reading(0, 100, 200, "NOBODY"));
    assert.equal(result.stored, true);
    assert.equal(result.sessionId, null);
    assert.equal((await sessions(client, "NOBODY")).length, 0);
    const { rows } = await client.query("SELECT count(*)::int AS n FROM device_readings WHERE device_id = 'NOBODY'");
    assert.equal(rows[0].n, 1);
  }, { owned: false });
});
