const { SESSION_TIMEOUT_MS, BATCH_MS } = require("./config");

// Every function takes a pg client so the caller owns the transaction (and tests can roll it back).

// Fills in the summary columns and closes the session at endedAt.
async function closeSession(client, session, endedAt) {
  await client.query(
    `UPDATE working_sessions s
        SET ended_at = $2, avg_light = r.avg_light, avg_air = r.avg_air,
            max_light = r.max_light, max_air = r.max_air, reading_count = r.n
       FROM (SELECT avg(light) AS avg_light, avg(air) AS avg_air, max(light) AS max_light, max(air) AS max_air, count(*)::int AS n
               FROM device_readings WHERE device_id = $3 AND time >= $4 AND time <= $2) r
      WHERE s.id = $1`,
    [session.id, endedAt, session.device_id, session.started_at]
  );
}

// Stores one reading, then opens, continues or rotates the device's working session.
async function ingestReading(client, { deviceId, light, air, time }) {
  // Serialize readings per device so two requests can't both open a session.
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [deviceId]);

  const { rows: [latest] } = await client.query("SELECT max(time) AS time FROM device_readings WHERE device_id = $1", [deviceId]);
  await client.query("INSERT INTO device_readings (time, device_id, light, air) VALUES ($1, $2, $3, $4)", [time, deviceId, light, air]);

  // A late or out-of-order reading is kept, but it never changes session state.
  if (latest.time && time <= latest.time) return { stored: true, sessionId: null, note: "out of order" };

  const { rows: [owner] } = await client.query("SELECT user_id FROM profiles WHERE device_id = $1 LIMIT 1", [deviceId]);
  if (!owner) return { stored: true, sessionId: null, note: "no profile owns this device" };

  const { rows: [open] } = await client.query(
    "SELECT id, device_id, started_at FROM working_sessions WHERE device_id = $1 AND ended_at IS NULL FOR UPDATE", [deviceId]
  );
  if (open) {
    const silentFor = latest.time ? time - latest.time : 0;
    if (silentFor <= SESSION_TIMEOUT_MS) return { stored: true, sessionId: open.id, opened: false };
    // The device went quiet for too long before this reading: the old session ended at its last reading.
    await closeSession(client, open, latest.time);
  }

  const { rows: [created] } = await client.query(
    "INSERT INTO working_sessions (user_id, device_id, started_at) VALUES ($1, $2, $3) RETURNING id",
    [owner.user_id, deviceId, new Date(time.getTime() - BATCH_MS)]
  );
  return { stored: true, sessionId: created.id, opened: true };
}

// Closes open sessions whose device has been silent too long. Returns the ids it closed.
async function sweepSessions(client, now = new Date()) {
  const { rows: candidates } = await client.query("SELECT DISTINCT device_id FROM working_sessions WHERE ended_at IS NULL");
  const closed = [];
  for (const { device_id: deviceId } of candidates) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [deviceId]);
    const { rows: [open] } = await client.query(
      "SELECT id, device_id, started_at FROM working_sessions WHERE device_id = $1 AND ended_at IS NULL FOR UPDATE", [deviceId]
    );
    if (!open) continue;
    const { rows: [latest] } = await client.query("SELECT max(time) AS time FROM device_readings WHERE device_id = $1", [deviceId]);
    const lastSeen = latest.time && latest.time > open.started_at ? latest.time : open.started_at;
    if (now - lastSeen > SESSION_TIMEOUT_MS) {
      await closeSession(client, open, lastSeen);
      closed.push(open.id);
    }
  }
  return closed;
}

module.exports = { ingestReading, sweepSessions, closeSession };
