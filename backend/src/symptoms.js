const { OFFLINE_AFTER_MS, CHECKIN_MS, CHECKIN_GRACE_MS } = require("./config");
const { airBand, lightBand, DEFAULT_THRESHOLDS } = require("./bands");
const { thresholdsFor } = require("./thresholds");

const SYMPTOMS = ["headache", "eye_strain", "brain_fog", "fatigue", "irritated_eyes", "other"];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const roundOrNull = value => (value === null || value === undefined ? null : Math.round(Number(value) * 10) / 10);

function symptomJson(row, thresholds = DEFAULT_THRESHOLDS) {
  return {
    id: row.id,
    sessionId: row.session_id,
    symptom: row.symptom,
    severity: row.severity,
    note: row.note,
    loggedAt: row.logged_at,
    light: row.light,
    air: row.air,
    lightAvg30m: row.light_avg_30m,
    airAvg30m: row.air_avg_30m,
    readingsInWindow: row.readings_in_window,
    airBand: airBand(row.air_avg_30m, thresholds),
    lightBand: lightBand(row.light_avg_30m, thresholds),
  };
}

// Saves one symptom. The sensor columns are filled from the device's readings: the latest reading, and the
// average of the 30 minutes before the log. With no readings (device was off) they stay empty.
async function logSymptom(client, { userId, symptom, severity = null, note = null, time = new Date() }) {
  if (!SYMPTOMS.includes(symptom)) throw new HttpError(400, `symptom must be one of ${SYMPTOMS.join(", ")}`);
  if (severity !== null && !(Number.isInteger(severity) && severity >= 1 && severity <= 10)) throw new HttpError(400, "severity must be a whole number from 1 to 10");
  if (note !== null && (typeof note !== "string" || note.length > 500)) throw new HttpError(400, "note must be text of at most 500 characters");

  const { rows: [profile] } = await client.query("SELECT user_id, device_id, survey, settings FROM profiles WHERE user_id = $1", [userId]);
  if (!profile) throw new HttpError(404, "User not found");

  let snapshot = {};
  if (profile.device_id) {
    const { rows: [found] } = await client.query(
      `WITH s AS (SELECT id FROM working_sessions
                   WHERE device_id = $1 AND started_at <= $2
                     AND ((ended_at IS NOT NULL AND ended_at >= $2)
                          OR (ended_at IS NULL AND $2 < COALESCE(last_active_at, started_at) + $4 * interval '1 millisecond'))
                   ORDER BY started_at DESC LIMIT 1),
            w AS (SELECT avg(light) AS light_avg, avg(air) AS air_avg, count(*)::int AS n
                    FROM device_readings
                   WHERE device_id = $1 AND time > $2::timestamptz - interval '30 minutes' AND time <= $2),
            l AS (SELECT light, air FROM device_readings
                   WHERE device_id = $1 AND time <= $2 AND time > $2::timestamptz - $3 * interval '1 millisecond'
                   ORDER BY time DESC LIMIT 1)
       SELECT (SELECT id FROM s) AS session_id, w.light_avg, w.air_avg, w.n, l.light, l.air
         FROM w LEFT JOIN l ON true`,
      [profile.device_id, time, OFFLINE_AFTER_MS, CHECKIN_MS + CHECKIN_GRACE_MS]
    );
    snapshot = found;
  }

  const hasWindow = snapshot.n > 0;
  const { rows: [row] } = await client.query(
    `INSERT INTO symptom_logs (user_id, session_id, logged_at, symptom, severity, note, light, light_avg_30m, air, air_avg_30m, readings_in_window)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [userId, snapshot.session_id ?? null, time, symptom, severity, note, snapshot.light ?? null,
      hasWindow ? roundOrNull(snapshot.light_avg) : null, snapshot.air ?? null, hasWindow ? roundOrNull(snapshot.air_avg) : null, snapshot.n ?? 0]
  );
  // Logging a symptom shows the user is there, so it counts as answering the check-in.
  if (row.session_id) {
    await client.query(
      "UPDATE working_sessions SET last_active_at = GREATEST(COALESCE(last_active_at, started_at), $2) WHERE id = $1 AND ended_at IS NULL", [row.session_id, time]
    );
  }
  return symptomJson(row, await thresholdsFor(client, profile));
}

module.exports = { SYMPTOMS, HttpError, logSymptom, symptomJson };
