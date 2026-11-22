const { CHECKIN_MS, CHECKIN_GRACE_MS } = require("./config");
const { airBand, lightBand, DEFAULT_THRESHOLDS } = require("./bands");
const { HttpError } = require("./symptoms");

// Working sessions are started and stopped by the user. While one runs, it asks "still working?" every CHECKIN_MS.
// No answer within CHECKIN_GRACE_MS ends it automatically, recorded at the moment the question was first due.
// Every function takes a pg client so the caller owns the transaction (and tests can roll it back).

const lastActive = session => session.last_active_at || session.started_at;
const checkInDueAt = session => new Date(lastActive(session).getTime() + CHECKIN_MS);
const autoEndsAt = session => new Date(checkInDueAt(session).getTime() + CHECKIN_GRACE_MS);
const isExpired = (session, now) => now >= autoEndsAt(session);

const lockDevice = (client, deviceId) => client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [deviceId]);

// Fills in the summary columns and closes the session at endedAt.
async function closeSession(client, session, endedAt, reason) {
  await client.query(
    `UPDATE working_sessions s
        SET ended_at = $2, ended_reason = $5, avg_light = r.avg_light, avg_air = r.avg_air,
            max_light = r.max_light, max_air = r.max_air, reading_count = r.n
       FROM (SELECT avg(light) AS avg_light, avg(air) AS avg_air, max(light) AS max_light, max(air) AS max_air, count(*)::int AS n
               FROM device_readings WHERE device_id = $3 AND time >= $4 AND time <= $2) r
      WHERE s.id = $1`,
    [session.id, endedAt, session.device_id, session.started_at, reason]
  );
}

// The sensor script's readings are only stored. Sessions are not opened or closed by them.
async function ingestReading(client, { deviceId, light, air, time }) {
  await client.query("INSERT INTO device_readings (time, device_id, light, air) VALUES ($1, $2, $3, $4)", [time, deviceId, light, air]);
  return { stored: true };
}

async function deviceOf(client, userId) {
  const { rows: [profile] } = await client.query("SELECT device_id FROM profiles WHERE user_id = $1", [userId]);
  if (!profile) throw new HttpError(404, "User not found");
  return profile.device_id;
}

async function lockedOpenSession(client, deviceId) {
  await lockDevice(client, deviceId);
  const { rows: [open] } = await client.query("SELECT * FROM working_sessions WHERE device_id = $1 AND ended_at IS NULL FOR UPDATE", [deviceId]);
  return open;
}

async function startSession(client, userId, now = new Date()) {
  const deviceId = await deviceOf(client, userId);
  if (!deviceId) throw new HttpError(409, "Link a device before starting a session");
  const open = await lockedOpenSession(client, deviceId);
  if (open) {
    if (!isExpired(open, now)) throw new HttpError(409, "A session is already running");
    await closeSession(client, open, checkInDueAt(open), "inactivity"); // it ended unanswered; make room for a new one
  }
  const { rows: [created] } = await client.query(
    "INSERT INTO working_sessions (user_id, device_id, started_at, last_active_at) VALUES ($1, $2, $3, $3) RETURNING *", [userId, deviceId, now]
  );
  return created;
}

async function stopSession(client, userId, now = new Date()) {
  const deviceId = await deviceOf(client, userId);
  const open = deviceId && await lockedOpenSession(client, deviceId);
  if (!open) throw new HttpError(409, "No session is running");
  // Stopping after an unanswered check-in still saves the session, ended where the check-in was due.
  const expired = isExpired(open, now);
  await closeSession(client, open, expired ? checkInDueAt(open) : now, expired ? "inactivity" : "manual");
  return (await client.query("SELECT * FROM working_sessions WHERE id = $1", [open.id])).rows[0];
}

// "Still working": keeps the session going for another check-in period.
async function confirmActive(client, userId, now = new Date()) {
  const deviceId = await deviceOf(client, userId);
  const open = deviceId && await lockedOpenSession(client, deviceId);
  if (!open) throw new HttpError(409, "No session is running");
  if (isExpired(open, now)) {
    await closeSession(client, open, checkInDueAt(open), "inactivity");
    throw new HttpError(409, "Your session already ended automatically");
  }
  return (await client.query("UPDATE working_sessions SET last_active_at = $2 WHERE id = $1 RETURNING *", [open.id, now])).rows[0];
}

// Ends every running session whose check-in went unanswered. Returns the ids it ended.
async function sweepSessions(client, now = new Date()) {
  const { rows: running } = await client.query("SELECT DISTINCT device_id FROM working_sessions WHERE ended_at IS NULL");
  const ended = [];
  for (const { device_id: deviceId } of running) {
    const open = await lockedOpenSession(client, deviceId);
    if (open && isExpired(open, now)) {
      await closeSession(client, open, checkInDueAt(open), "inactivity");
      ended.push(open.id);
    }
  }
  return ended;
}

function sessionJson(row, symptoms = [], thresholds = DEFAULT_THRESHOLDS) {
  const open = row.ended_at === null;
  const end = row.ended_at || new Date();
  return {
    id: row.id, deviceId: row.device_id, startedAt: row.started_at, endedAt: row.ended_at, open, endedReason: row.ended_reason,
    lastActiveAt: row.last_active_at, checkInDueAt: open ? checkInDueAt(row) : null, autoEndsAt: open ? autoEndsAt(row) : null,
    durationSeconds: Math.round((end - row.started_at) / 1000),
    avgLight: row.avg_light, avgAir: row.avg_air, maxLight: row.max_light, maxAir: row.max_air, readingCount: row.reading_count,
    airBand: airBand(row.avg_air, thresholds), lightBand: lightBand(row.avg_light, thresholds), symptoms,
  };
}

module.exports = { ingestReading, startSession, stopSession, confirmActive, sweepSessions, closeSession, sessionJson, checkInDueAt, autoEndsAt, isExpired };
