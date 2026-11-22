const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.DEFAULT_DEVICE_ID = ""; // tests must never claim the real device
const db = require("../src/db");
const app = require("../src/app");

const USER = "test-api-user";
let server;
let base;
const call = async (method, path, body) => {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json().catch(() => null) };
};
const cleanup = () => db.query("DELETE FROM profiles WHERE user_id = $1", [USER]);

before(async () => {
  await cleanup();
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});
after(async () => {
  await cleanup();
  server.close();
  await db.end();
});

test("an unknown user is a 404 on every route", async () => {
  for (const path of ["", "/device", "/readings", "/sessions", "/symptoms", "/insights"]) {
    assert.equal((await call("GET", `/api/users/${USER}${path}`)).status, 404, path || "profile");
  }
});

test("profile lifecycle: create, read, update part of it, replace", async () => {
  const survey = { about: { name: { first: "Test", last: "User" }, profile: { age: 30 } } };
  const created = await call("POST", `/api/users/${USER}`, { surveyStatus: "partial", survey, settings: { theme: "dark" } });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, "Test User");
  assert.equal(created.body.deviceId, null);

  const read = await call("GET", `/api/users/${USER}`);
  assert.deepEqual(read.body.survey, survey);
  assert.equal(read.body.surveyStatus, "partial");
  assert.equal(read.body.settings.theme, "dark");

  const updated = await call("PUT", `/api/users/${USER}`, { settings: { theme: "light", units: { height: "ft" } } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.settings.theme, "light");
  assert.deepEqual(updated.body.survey, survey); // untouched because it was not sent
  assert.equal(updated.body.name, "Test User");

  const again = await call("POST", `/api/users/${USER}`, { surveyStatus: "completed", survey, settings: {} });
  assert.equal(again.status, 201); // creating twice replaces instead of failing
  assert.equal((await call("GET", `/api/users/${USER}`)).body.surveyStatus, "completed");
});

test("bad profile bodies are rejected", async () => {
  for (const body of [{ surveyStatus: "done" }, { survey: [] }, { settings: "dark" }, [1, 2]]) {
    assert.equal((await call("POST", `/api/users/${USER}`, body)).status, 400, JSON.stringify(body));
  }
  const response = await fetch(`${base}/api/users/${USER}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json" });
  assert.equal(response.status, 400);
});

test("a user with no device reports it, with empty chart data and empty history", async () => {
  const device = (await call("GET", `/api/users/${USER}/device`)).body;
  assert.equal(device.deviceId, null);
  assert.equal(device.online, false);
  assert.equal(device.latest, null);
  assert.deepEqual((await call("GET", `/api/users/${USER}/readings`)).body.points, []);
  assert.deepEqual((await call("GET", `/api/users/${USER}/sessions`)).body.sessions, []);
  assert.equal((await call("GET", `/api/users/${USER}/readings?range=1y`)).status, 400);
});

test("logging a symptom works with the device off, and it shows up in the log", async () => {
  const logged = await call("POST", `/api/users/${USER}/symptoms`, { symptom: "headache", severity: 7, note: "afternoon" });
  assert.equal(logged.status, 201);
  assert.equal(logged.body.sessionId, null);
  assert.equal(logged.body.airAvg30m, null);

  const list = (await call("GET", `/api/users/${USER}/symptoms`)).body.symptoms;
  assert.equal(list.length, 1);
  assert.equal(list[0].symptom, "headache");
  assert.equal(list[0].severity, 7);

  assert.equal((await call("POST", `/api/users/${USER}/symptoms`, { symptom: "poor_sleep" })).status, 400);
  assert.equal((await call("POST", `/api/users/${USER}/symptoms`, { symptom: "headache", severity: 11 })).status, 400);
  assert.equal((await call("GET", `/api/users/${USER}/symptoms?symptom=bogus`)).status, 400);
  assert.equal((await call("GET", `/api/users/${USER}/symptoms?before=yesterday-ish`)).status, 400);
});

test("a symptom's context chart is empty without readings, and 404 for someone else's log", async () => {
  const id = (await call("GET", `/api/users/${USER}/symptoms`)).body.symptoms[0].id;
  const context = (await call("GET", `/api/users/${USER}/symptoms/${id}/context`)).body;
  assert.deepEqual(context.points, []);
  assert.equal((await call("GET", `/api/users/demo-user/symptoms/${id}/context`)).status, 404);
  assert.equal((await call("GET", `/api/users/${USER}/symptoms/abc/context`)).status, 404);
});

test("insights say there is not enough data yet", async () => {
  const insights = (await call("GET", `/api/users/${USER}/insights`)).body;
  assert.equal(insights.totalLogs, 1);
  assert.equal(insights.stage, "baseline");
  assert.deepEqual(insights.patterns, []);
});

test("sessions belong to their user", async () => {
  const demo = (await call("GET", "/api/users/demo-user/sessions?limit=3")).body;
  assert.equal(demo.sessions.length, 3);
  assert.ok(demo.sessions[0].startedAt > demo.sessions[1].startedAt, "newest first");
  assert.ok(demo.nextBefore);
  const next = (await call("GET", `/api/users/demo-user/sessions?limit=3&before=${encodeURIComponent(demo.nextBefore)}`)).body;
  assert.ok(next.sessions[0].startedAt < demo.sessions[2].startedAt, "paging continues after the last row");

  const id = demo.sessions[0].id;
  const detail = await call("GET", `/api/users/demo-user/sessions/${id}`);
  assert.equal(detail.status, 200);
  assert.ok(detail.body.points.length > 10 && detail.body.points.length <= 260);
  assert.equal((await call("GET", `/api/users/${USER}/sessions/${id}`)).status, 404, "another user's session");
  assert.equal((await call("GET", `/api/users/demo-user/sessions/not-a-number`)).status, 404);
});

test("the demo user's data is complete", async () => {
  const device = (await call("GET", "/api/users/demo-user/device")).body;
  assert.equal(device.deviceId, "CA-DEMO");
  assert.equal(device.online, false);
  assert.ok(device.latest.air >= 0 && device.latest.light <= 625);
  assert.ok(device.score >= 0 && device.score <= 100);

  const sessions = (await call("GET", "/api/users/demo-user/sessions?limit=50")).body.sessions;
  assert.ok(sessions.length >= 10);
  for (const session of sessions) {
    assert.equal(session.open, false);
    assert.ok(session.avgAir >= 0 && session.avgAir <= 1023 && session.maxAir >= session.avgAir);
    assert.ok(session.durationSeconds > 600);
  }
  const insights = (await call("GET", "/api/users/demo-user/insights")).body;
  assert.ok(insights.patterns.length >= 1 && insights.patterns.length <= 3);
  assert.ok(insights.patterns.every(pattern => pattern.hits <= pattern.total && pattern.rate >= 50));

  for (const range of ["15m", "6h", "24h", "7d"]) {
    const series = (await call("GET", `/api/users/demo-user/readings?range=${range}`)).body;
    assert.ok(series.points.length > 3, range);
  }
});
