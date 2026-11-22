const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../src/db");
const { ingestReading, startSession, stopSession, confirmActive, sweepSessions, checkInDueAt } = require("../src/sessions");
const { logSymptom } = require("../src/symptoms");
const { CHECKIN_MS, CHECKIN_GRACE_MS } = require("../src/config");

const USER = "test-user-sessions";
const DEVICE = "TEST-DEV-SESSIONS";
const T0 = new Date("2026-01-05T09:00:00Z");
const at = minutes => new Date(T0.getTime() + minutes * 60000);
const CHECKIN = CHECKIN_MS / 60000; // minutes
const GRACE = CHECKIN_GRACE_MS / 60000;

// Runs fn inside a transaction that is always rolled back, so tests leave nothing behind.
async function withUser(fn, { device = DEVICE } = {}) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO profiles (user_id, name, device_id) VALUES ($1, 'Test', $2)", [USER, device]);
    await fn(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

const reading = (minutes, light, air) => ({ deviceId: DEVICE, light, air, time: at(minutes) });
const sessions = async client => (await client.query("SELECT * FROM working_sessions WHERE device_id = $1 ORDER BY started_at", [DEVICE])).rows;
const rejects = (promise, status) => assert.rejects(promise, error => error.status === status, `expected HTTP ${status}`);

after(() => db.end());

test("sensor readings are stored and never open or close a session", async () => {
  await withUser(async client => {
    assert.deepEqual(await ingestReading(client, reading(0, 100, 200)), { stored: true });
    assert.equal((await sessions(client)).length, 0);
    await startSession(client, USER, at(1));
    await ingestReading(client, reading(500, 100, 200)); // hours later; the session is untouched by readings
    const [session] = await sessions(client);
    assert.equal(session.ended_at, null);
  });
});

test("Start opens a session at that moment, and only one can run", async () => {
  await withUser(async client => {
    const session = await startSession(client, USER, at(0));
    assert.equal(session.started_at.getTime(), at(0).getTime());
    assert.equal(session.last_active_at.getTime(), at(0).getTime());
    assert.equal(session.ended_at, null);
    await rejects(startSession(client, USER, at(5)), 409);
  });
});

test("Start needs a linked device and a known user", async () => {
  await withUser(async client => {
    await rejects(startSession(client, USER, at(0)), 409);
    await rejects(startSession(client, "nobody", at(0)), 404);
  }, { device: null });
});

test("Stop closes the session with a summary of the readings inside it", async () => {
  await withUser(async client => {
    await ingestReading(client, reading(-10, 625, 1000)); // before the session: must not count
    await startSession(client, USER, at(0));
    await ingestReading(client, reading(1, 100, 200));
    await ingestReading(client, reading(2, 200, 300));
    await ingestReading(client, reading(3, 300, 400));
    await ingestReading(client, reading(30, 600, 900)); // after Stop: must not count
    const stopped = await stopSession(client, USER, at(10));
    assert.equal(stopped.ended_at.getTime(), at(10).getTime());
    assert.equal(stopped.ended_reason, "manual");
    assert.equal(stopped.avg_light, 200);
    assert.equal(stopped.avg_air, 300);
    assert.equal(stopped.max_light, 300);
    assert.equal(stopped.max_air, 400);
    assert.equal(stopped.reading_count, 3);
    assert.ok(await startSession(client, USER, at(11)), "a new session can start after Stop");
  });
});

test("Stop with nothing running is an error", async () => {
  await withUser(async client => {
    await rejects(stopSession(client, USER, at(0)), 409);
    await rejects(confirmActive(client, USER, at(0)), 409);
  });
});

test("Still working moves the next check-in later", async () => {
  await withUser(async client => {
    const session = await startSession(client, USER, at(0));
    assert.equal(checkInDueAt(session).getTime(), at(CHECKIN).getTime());
    const confirmed = await confirmActive(client, USER, at(CHECKIN - 10));
    assert.equal(confirmed.last_active_at.getTime(), at(CHECKIN - 10).getTime());
    assert.equal(checkInDueAt(confirmed).getTime(), at(CHECKIN - 10 + CHECKIN).getTime());
  });
});

test("an unanswered check-in ends the session where the check-in was due", async () => {
  await withUser(async client => {
    await startSession(client, USER, at(0));
    await ingestReading(client, reading(10, 100, 200));
    await ingestReading(client, reading(CHECKIN + 2, 500, 800)); // after the check-in was due: must not count
    assert.deepEqual(await sweepSessions(client, at(CHECKIN + GRACE - 0.5)), [], "still inside the grace period");
    assert.equal((await sessions(client))[0].ended_at, null);
    const ended = await sweepSessions(client, at(CHECKIN + GRACE));
    assert.equal(ended.length, 1);
    const [session] = await sessions(client);
    assert.equal(session.ended_at.getTime(), at(CHECKIN).getTime());
    assert.equal(session.ended_reason, "inactivity");
    assert.equal(session.reading_count, 1);
    assert.equal(session.max_air, 200);
  });
});

test("answering in time keeps the session alive for another period", async () => {
  await withUser(async client => {
    await startSession(client, USER, at(0));
    await confirmActive(client, USER, at(CHECKIN + 2)); // answered inside the grace period
    assert.deepEqual(await sweepSessions(client, at(CHECKIN + GRACE + 1)), []);
    assert.deepEqual(await sweepSessions(client, at(CHECKIN + 2 + CHECKIN + GRACE - 1)), []);
    assert.equal((await sweepSessions(client, at(CHECKIN + 2 + CHECKIN + GRACE))).length, 1);
    assert.equal((await sessions(client))[0].ended_at.getTime(), at(CHECKIN + 2 + CHECKIN).getTime());
  });
});

test("answering after the deadline is too late, and the session ends as inactive", async () => {
  await withUser(async client => {
    await startSession(client, USER, at(0));
    await rejects(confirmActive(client, USER, at(CHECKIN + GRACE + 1)), 409);
    const [session] = await sessions(client);
    assert.equal(session.ended_reason, "inactivity");
    assert.equal(session.ended_at.getTime(), at(CHECKIN).getTime());
  });
});

test("pressing Stop after the deadline still saves the session, ended where the check-in was due", async () => {
  await withUser(async client => {
    await startSession(client, USER, at(0));
    const stopped = await stopSession(client, USER, at(CHECKIN + GRACE + 20));
    assert.equal(stopped.ended_reason, "inactivity");
    assert.equal(stopped.ended_at.getTime(), at(CHECKIN).getTime());
  });
});

test("a new session can start after the old one expired unanswered", async () => {
  await withUser(async client => {
    await startSession(client, USER, at(0));
    const next = await startSession(client, USER, at(CHECKIN + GRACE + 5));
    assert.equal(next.ended_at, null);
    const all = await sessions(client);
    assert.equal(all.length, 2);
    assert.equal(all[0].ended_reason, "inactivity");
  });
});

test("logging a symptom counts as answering the check-in", async () => {
  await withUser(async client => {
    const session = await startSession(client, USER, at(0));
    const log = await logSymptom(client, { userId: USER, symptom: "headache", severity: 4, time: at(CHECKIN - 5) });
    assert.equal(String(log.sessionId), String(session.id));
    assert.deepEqual(await sweepSessions(client, at(CHECKIN + GRACE)), [], "the symptom moved the deadline");
    const [running] = await sessions(client);
    assert.equal(running.last_active_at.getTime(), at(CHECKIN - 5).getTime());
  });
});

test("a symptom logged after an unanswered check-in does not revive the session", async () => {
  await withUser(async client => {
    await startSession(client, USER, at(0));
    const log = await logSymptom(client, { userId: USER, symptom: "fatigue", time: at(CHECKIN + GRACE + 1) });
    assert.equal(log.sessionId, null);
    assert.equal((await sweepSessions(client, at(CHECKIN + GRACE + 1))).length, 1);
  });
});
