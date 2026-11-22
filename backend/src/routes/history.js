const express = require("express");
const db = require("../db");
const { SYMPTOMS, HttpError, logSymptom, symptomJson } = require("../symptoms");
const { requireProfile, isObject } = require("./users");
const { sessionJson } = require("../sessions");
const { thresholdsFor } = require("../thresholds");

const router = express.Router();

const MIN_LOGS_FOR_PATTERNS = 5;
const LONG_SESSION_MINUTES = 150;
const SYMPTOM_LABELS = { headache: "headaches", eye_strain: "eye strain", brain_fog: "brain fog", fatigue: "fatigue", irritated_eyes: "irritated eyes", other: "other symptoms" };

const limitFrom = (value, fallback, max) => Math.min(max, Math.max(1, Number.parseInt(value, 10) || fallback));
const parseBefore = value => {
  if (value === undefined) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "before must be a valid date");
  return date;
};

// Recent sessions, newest first, each with a compact list of the symptoms logged during it.
router.get("/api/users/:userId/sessions", requireProfile, async (request, response) => {
  const limit = limitFrom(request.query.limit, 20, 50);
  const before = parseBefore(request.query.before);
  const thresholds = await thresholdsFor(db, request.profile);
  const { rows } = await db.query(
    `SELECT s.*, COALESCE(json_agg(json_build_object('id', l.id, 'symptom', l.symptom, 'severity', l.severity, 'loggedAt', l.logged_at)
                                   ORDER BY l.logged_at) FILTER (WHERE l.id IS NOT NULL), '[]') AS symptoms
       FROM working_sessions s LEFT JOIN symptom_logs l ON l.session_id = s.id
      WHERE s.user_id = $1 AND ($2::timestamptz IS NULL OR s.started_at < $2)
      GROUP BY s.id ORDER BY s.started_at DESC LIMIT $3`,
    [request.params.userId, before, limit]
  );
  response.json({ sessions: rows.map(row => sessionJson(row, row.symptoms, thresholds)), nextBefore: rows.length === limit ? rows[rows.length - 1].started_at : null });
});

// One session with its readings (thinned to about 240 points) and every symptom logged in it.
router.get("/api/users/:userId/sessions/:sessionId", requireProfile, async (request, response) => {
  if (!/^\d+$/.test(request.params.sessionId)) return response.status(404).json({ error: "Session not found" });
  const { rows: [session] } = await db.query("SELECT * FROM working_sessions WHERE id = $1 AND user_id = $2", [request.params.sessionId, request.params.userId]);
  if (!session) return response.status(404).json({ error: "Session not found" });

  const end = session.ended_at || new Date();
  const bucketSeconds = Math.max(30, Math.ceil((end - session.started_at) / 1000 / 240 / 30) * 30);
  const { rows: points } = await db.query(
    `SELECT time_bucket($4 * interval '1 second', time) AS time, avg(light) AS light, avg(air) AS air
       FROM device_readings WHERE device_id = $1 AND time >= $2 AND time <= $3 GROUP BY 1 ORDER BY 1`,
    [session.device_id, session.started_at, end, bucketSeconds]
  );
  const thresholds = await thresholdsFor(db, request.profile);
  const { rows: logs } = await db.query("SELECT * FROM symptom_logs WHERE session_id = $1 ORDER BY logged_at", [session.id]);
  response.json({
    ...sessionJson(session, logs.map(log => symptomJson(log, thresholds)), thresholds),
    bucketSeconds,
    points: points.map(row => ({ time: row.time, light: Math.round(row.light * 10) / 10, air: Math.round(row.air * 10) / 10 })),
  });
});

router.post("/api/users/:userId/symptoms", requireProfile, async (request, response) => {
  if (!isObject(request.body)) return response.status(400).json({ error: "Body must be a JSON object" });
  const { symptom, severity = null, note = null } = request.body;
  const client = await db.connect();
  try {
    response.status(201).json(await logSymptom(client, { userId: request.params.userId, symptom, severity, note }));
  } finally {
    client.release();
  }
});

router.get("/api/users/:userId/symptoms", requireProfile, async (request, response) => {
  const limit = limitFrom(request.query.limit, 30, 100);
  const before = parseBefore(request.query.before);
  const symptom = request.query.symptom;
  if (symptom !== undefined && !SYMPTOMS.includes(symptom)) return response.status(400).json({ error: "Unknown symptom" });
  const { rows } = await db.query(
    `SELECT * FROM symptom_logs WHERE user_id = $1 AND ($2::timestamptz IS NULL OR logged_at < $2) AND ($3::text IS NULL OR symptom = $3)
      ORDER BY logged_at DESC LIMIT $4`,
    [request.params.userId, before, symptom ?? null, limit]
  );
  const thresholds = await thresholdsFor(db, request.profile);
  response.json({ symptoms: rows.map(row => symptomJson(row, thresholds)), nextBefore: rows.length === limit ? rows[rows.length - 1].logged_at : null });
});

// The two hours before a symptom, for the "Before your symptom" chart. The 30-minute window is marked.
router.get("/api/users/:userId/symptoms/:logId/context", requireProfile, async (request, response) => {
  if (!/^\d+$/.test(request.params.logId)) return response.status(404).json({ error: "Symptom not found" });
  const { rows: [log] } = await db.query(
    `SELECT l.*, COALESCE(s.device_id, p.device_id) AS device_id
       FROM symptom_logs l JOIN profiles p ON p.user_id = l.user_id LEFT JOIN working_sessions s ON s.id = l.session_id
      WHERE l.id = $1 AND l.user_id = $2`,
    [request.params.logId, request.params.userId]
  );
  if (!log) return response.status(404).json({ error: "Symptom not found" });

  const from = new Date(log.logged_at.getTime() - 2 * 3600 * 1000);
  const windowFrom = new Date(log.logged_at.getTime() - 30 * 60 * 1000);
  const { rows: points } = log.device_id ? await db.query(
    `SELECT time_bucket(interval '120 seconds', time) AS time, avg(light) AS light, avg(air) AS air
       FROM device_readings WHERE device_id = $1 AND time > $2 AND time <= $3 GROUP BY 1 ORDER BY 1`,
    [log.device_id, from, log.logged_at]
  ) : { rows: [] };
  response.json({
    symptom: symptomJson(log, await thresholdsFor(db, request.profile)), from, to: log.logged_at, windowFrom, bucketSeconds: 120,
    points: points.map(row => ({ time: row.time, light: Math.round(row.light * 10) / 10, air: Math.round(row.air * 10) / 10 })),
  });
});

const TRIGGERS = {
  air: { title: "Stale air", test: (log, t) => log.air_avg_30m >= t.airCaution },
  harsh_light: { title: "Bright light", test: (log, t) => log.light_avg_30m > t.lightHarsh },
  dim_light: { title: "Dim light", test: (log, t) => log.light_avg_30m < t.lightDim },
  long_session: { title: "Long stretches without a break", test: log => log.minutes_into_session >= LONG_SESSION_MINUTES },
};

// Patterns across sessions: how often a symptom followed a trigger, compared with how often that trigger is simply
// present. The wording is plain templates, so the numbers come from data and not from a language model.
router.get("/api/users/:userId/insights", requireProfile, async (request, response) => {
  const userId = request.params.userId;
  const thresholds = await thresholdsFor(db, request.profile);
  const { rows: logs } = await db.query(
    `SELECT l.symptom, l.light_avg_30m, l.air_avg_30m, l.readings_in_window,
            EXTRACT(EPOCH FROM (l.logged_at - s.started_at)) / 60 AS minutes_into_session
       FROM symptom_logs l LEFT JOIN working_sessions s ON s.id = l.session_id WHERE l.user_id = $1`,
    [userId]
  );
  const { rows: [base] } = await db.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE r.air >= $2)::int AS air, count(*) FILTER (WHERE r.light > $3)::int AS harsh_light,
            count(*) FILTER (WHERE r.light < $4)::int AS dim_light,
            count(*) FILTER (WHERE r.time >= s.started_at + $5 * interval '1 minute')::int AS long_session
       FROM device_readings r JOIN working_sessions s ON s.device_id = r.device_id AND r.time BETWEEN s.started_at AND COALESCE(s.ended_at, now())
      WHERE s.user_id = $1`,
    [userId, thresholds.airCaution, thresholds.lightHarsh, thresholds.lightDim, LONG_SESSION_MINUTES]
  );
  const { rows: [counts] } = await db.query(
    "SELECT count(*)::int AS sessions, count(DISTINCT started_at::date)::int AS days FROM working_sessions WHERE user_id = $1", [userId]
  );

  const rated = logs.filter(log => log.symptom !== "other" && log.readings_in_window > 0);
  const patterns = [];
  if (logs.length >= MIN_LOGS_FOR_PATTERNS) {
    for (const symptom of [...new Set(rated.map(log => log.symptom))]) {
      const ofSymptom = rated.filter(log => log.symptom === symptom);
      for (const [trigger, { title, test }] of Object.entries(TRIGGERS)) {
        const hits = ofSymptom.filter(log => test(log, thresholds)).length;
        const rate = hits / ofSymptom.length;
        const baseline = Math.max(base.total ? base[trigger] / base.total : 0, 0.05);
        if (hits < 2 || rate < 0.5 || rate / baseline < 1.3) continue;
        const strength = ofSymptom.length >= 5 && rate >= 0.7 ? "strong" : "early";
        patterns.push({
          symptom, symptomLabel: SYMPTOM_LABELS[symptom], trigger, title, detail: `Most common before ${SYMPTOM_LABELS[symptom]}`,
          hits, total: ofSymptom.length, rate: Math.round(rate * 100), strength,
          confidenceLine: strength === "strong" ? `Strong pattern · ${hits} of ${ofSymptom.length} ${SYMPTOM_LABELS[symptom]}` : `Early pattern · ${hits} logs`,
        });
      }
    }
    patterns.sort((a, b) => (b.strength === "strong") - (a.strength === "strong") || b.rate - a.rate || b.hits - a.hits);
  }

  // A simple confidence measure: more logs and more days of data make the patterns more trustworthy.
  const confidence = Math.round(100 * (0.6 * Math.min(logs.length / 20, 1) + 0.4 * Math.min(counts.days / 14, 1)));
  response.json({
    totalLogs: logs.length, minimumLogs: MIN_LOGS_FOR_PATTERNS, sessionCount: counts.sessions, daysOfData: counts.days,
    confidence, stage: logs.length < MIN_LOGS_FOR_PATTERNS ? "baseline" : logs.length < 15 ? "calibrating" : "personalized",
    patterns: patterns.slice(0, 3),
  });
});

module.exports = { router };
