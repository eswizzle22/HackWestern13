const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../src/db");
const { ingestReading, startSession, stopSession } = require("../src/sessions");
const { logSymptom, HttpError } = require("../src/symptoms");

const T0 = new Date("2026-01-05T09:00:00Z");
const at = minutes => new Date(T0.getTime() + minutes * 60000);

async function withUser(fn, { device = "TEST-DEV-SYMPTOMS" } = {}) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO profiles (user_id, name, device_id) VALUES ('test-user-symptoms', 'Test', $1)", [device]);
    await fn(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

// Starts a session, then one reading every 30 seconds for `minutes`: light rising 1 per reading and air constant 400.
async function stream(client, minutes) {
  await startSession(client, "test-user-symptoms", T0);
  for (let i = 0; i <= minutes * 2; i++) await ingestReading(client, { deviceId: "TEST-DEV-SYMPTOMS", light: 100 + i, air: 400, time: new Date(T0.getTime() + i * 30000) });
}

after(() => db.end());

test("a symptom stores the 30-minute averages and joins the open session", async () => {
  await withUser(async client => {
    await stream(client, 40);
    const log = await logSymptom(client, { userId: "test-user-symptoms", symptom: "headache", severity: 6, note: "behind the eyes", time: at(40) });
    // Readings in (10 min, 40 min] are indexes 21..80: light 121..180, so the mean is 150.5.
    assert.equal(log.readingsInWindow, 60);
    assert.equal(log.lightAvg30m, 150.5);
    assert.equal(log.airAvg30m, 400);
    assert.equal(log.light, 180);
    assert.equal(log.air, 400);
    assert.ok(log.sessionId);
    assert.equal(log.severity, 6);
    assert.equal(log.airBand, "good");
  });
});

test("with the device off there are no readings and no session", async () => {
  await withUser(async client => {
    const log = await logSymptom(client, { userId: "test-user-symptoms", symptom: "fatigue", time: at(0) });
    assert.equal(log.sessionId, null);
    assert.equal(log.readingsInWindow, 0);
    assert.equal(log.lightAvg30m, null);
    assert.equal(log.airAvg30m, null);
    assert.equal(log.light, null);
    assert.equal(log.severity, null);
  });
});

test("a user with no device can still log a symptom", async () => {
  await withUser(async client => {
    const log = await logSymptom(client, { userId: "test-user-symptoms", symptom: "other", severity: 3 });
    assert.equal(log.sessionId, null);
    assert.equal(log.airAvg30m, null);
  }, { device: null });
});

test("a symptom soon after the device went off keeps the averages but joins no session", async () => {
  await withUser(async client => {
    await stream(client, 20);
    await stopSession(client, "test-user-symptoms", at(20));
    const log = await logSymptom(client, { userId: "test-user-symptoms", symptom: "brain_fog", time: at(30) });
    assert.equal(log.sessionId, null);
    assert.ok(log.readingsInWindow > 0);
    assert.equal(log.light, null); // the newest reading is too old to call "current"
  });
});

test("severity can be 1 to 10 or skipped, nothing else", async () => {
  await withUser(async client => {
    for (const severity of [1, 10, null]) assert.ok(await logSymptom(client, { userId: "test-user-symptoms", symptom: "headache", severity }));
    for (const severity of [0, 11, 1.5, "5", -2]) {
      await assert.rejects(logSymptom(client, { userId: "test-user-symptoms", symptom: "headache", severity }), error => error instanceof HttpError && error.status === 400, `severity ${severity}`);
    }
  });
});

test("only the known symptoms are accepted (poor sleep is not one of them)", async () => {
  await withUser(async client => {
    for (const symptom of ["poor_sleep", "nausea", "", undefined]) {
      await assert.rejects(logSymptom(client, { userId: "test-user-symptoms", symptom }), error => error instanceof HttpError && error.status === 400, String(symptom));
    }
    for (const symptom of ["headache", "eye_strain", "brain_fog", "fatigue", "irritated_eyes", "other"]) assert.ok(await logSymptom(client, { userId: "test-user-symptoms", symptom }));
  });
});

test("notes are limited and unknown users are rejected", async () => {
  await withUser(async client => {
    await assert.rejects(logSymptom(client, { userId: "test-user-symptoms", symptom: "headache", note: "x".repeat(501) }), error => error.status === 400);
    await assert.rejects(logSymptom(client, { userId: "nobody", symptom: "headache" }), error => error.status === 404);
  });
});
