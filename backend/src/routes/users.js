const express = require("express");
const db = require("../db");
const { OFFLINE_AFTER_MS } = require("../config");
const { checkInDueAt, autoEndsAt } = require("../sessions");
const { airBand, lightBand, comfortScore } = require("../bands");
const { thresholdsFor } = require("../thresholds");

const router = express.Router();

const MAX_BODY_CHARS = 50 * 1024;
const STATUSES = ["completed", "partial", "skipped"];
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

// For each chart range: how far back to look (from the newest reading) and how many seconds each point covers.
const RANGES = {
  "15m": { ms: 15 * 60 * 1000, bucketSeconds: 30 },
  "6h": { ms: 6 * 3600 * 1000, bucketSeconds: 300 },
  "24h": { ms: 24 * 3600 * 1000, bucketSeconds: 900 },
  "7d": { ms: 7 * 24 * 3600 * 1000, bucketSeconds: 3600 },
};

const profileJson = row => ({ userId: row.user_id, name: row.name, deviceId: row.device_id, surveyStatus: row.survey_status, survey: row.survey, settings: row.settings });

function nameFrom(survey) {
  const name = survey && survey.about && survey.about.name;
  return name ? `${name.first || ""} ${name.last || ""}`.trim() || null : null;
}

function validateProfileBody(body) {
  if (!isObject(body)) return "Body must be a JSON object";
  if (body.surveyStatus != null && !STATUSES.includes(body.surveyStatus)) return "surveyStatus must be completed, partial or skipped";
  if (body.survey != null && !isObject(body.survey)) return "survey must be an object";
  if (body.settings != null && !isObject(body.settings)) return "settings must be an object";
  if (JSON.stringify(body).length > MAX_BODY_CHARS) return "Body is too large";
  return null;
}

async function requireProfile(request, response, next) {
  const { rows: [profile] } = await db.query("SELECT * FROM profiles WHERE user_id = $1", [request.params.userId]);
  if (!profile) return response.status(404).json({ error: "User not found" });
  request.profile = profile;
  next();
}

router.get("/api/users/:userId", requireProfile, (request, response) => response.json(profileJson(request.profile)));

// Creates the profile (or replaces it if it already exists). The first profile created gets the default device.
router.post("/api/users/:userId", async (request, response) => {
  const problem = validateProfileBody(request.body);
  if (problem) return response.status(400).json({ error: problem });

  const surveyStatus = request.body.surveyStatus ?? "skipped";
  const survey = request.body.survey ?? {};
  const settings = request.body.settings ?? {};
  let { rows: [row] } = await db.query(
    `INSERT INTO profiles (user_id, name, survey_status, survey, settings) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE
       SET name = COALESCE(EXCLUDED.name, profiles.name), survey_status = EXCLUDED.survey_status,
           survey = EXCLUDED.survey, settings = EXCLUDED.settings, updated_at = now()
     RETURNING *`,
    [request.params.userId, nameFrom(survey), surveyStatus, survey, settings]
  );

  const defaultDevice = process.env.DEFAULT_DEVICE_ID;
  if (defaultDevice && !row.device_id) {
    try {
      const { rows: [claimed] } = await db.query("UPDATE profiles SET device_id = $2 WHERE user_id = $1 AND device_id IS NULL RETURNING *", [row.user_id, defaultDevice]);
      if (claimed) row = claimed;
    } catch (error) {
      if (error.code !== "23505") throw error; // someone else already owns that device
    }
  }
  response.status(201).json(profileJson(row));
});

// Updates only the fields that are sent.
router.put("/api/users/:userId", requireProfile, async (request, response) => {
  const problem = validateProfileBody(request.body);
  if (problem) return response.status(400).json({ error: problem });

  const { surveyStatus, survey, settings } = request.body;
  const { rows: [row] } = await db.query(
    `UPDATE profiles SET survey_status = COALESCE($2, survey_status), survey = COALESCE($3, survey),
                         settings = COALESCE($4, settings), name = COALESCE($5, name), updated_at = now()
      WHERE user_id = $1 RETURNING *`,
    [request.params.userId, surveyStatus ?? null, survey ?? null, settings ?? null, nameFrom(survey)]
  );
  response.json(profileJson(row));
});

// Online/Offline, the newest reading and the open session, for the dashboard and Device page.
router.get("/api/users/:userId/device", requireProfile, async (request, response) => {
  const deviceId = request.profile.device_id;
  const thresholds = await thresholdsFor(db, request.profile);
  if (!deviceId) return response.json({ deviceId: null, online: false, lastSeen: null, latest: null, score: null, session: null, thresholds });

  const { rows: [latest] } = await db.query("SELECT time, light, air FROM device_readings WHERE device_id = $1 ORDER BY time DESC LIMIT 1", [deviceId]);
  const { rows: [open] } = await db.query("SELECT id, started_at, last_active_at FROM working_sessions WHERE device_id = $1 AND ended_at IS NULL", [deviceId]);
  const online = Boolean(latest) && Date.now() - latest.time.getTime() <= OFFLINE_AFTER_MS;

  response.json({
    deviceId,
    online,
    lastSeen: latest ? latest.time : null,
    latest: latest ? { time: latest.time, light: latest.light, air: latest.air, lightBand: lightBand(latest.light, thresholds), airBand: airBand(latest.air, thresholds) } : null,
    score: latest ? comfortScore(latest.air, latest.light, thresholds) : null,
    thresholds,
    session: open ? { id: open.id, startedAt: open.started_at, lastActiveAt: open.last_active_at, checkInDueAt: checkInDueAt(open), autoEndsAt: autoEndsAt(open), durationSeconds: Math.round((Date.now() - open.started_at.getTime()) / 1000) } : null,
  });
});

// Chart data. The window ends at the newest reading, so an offline device still shows its last stretch of data.
router.get("/api/users/:userId/readings", requireProfile, async (request, response) => {
  const range = RANGES[request.query.range || "6h"];
  if (!range) return response.status(400).json({ error: `range must be one of ${Object.keys(RANGES).join(", ")}` });

  const deviceId = request.profile.device_id;
  const { rows: [newest] } = deviceId ? await db.query("SELECT max(time) AS time FROM device_readings WHERE device_id = $1", [deviceId]) : { rows: [{}] };
  if (!newest.time) return response.json({ range: request.query.range || "6h", bucketSeconds: range.bucketSeconds, from: null, to: null, points: [] });

  const from = new Date(newest.time.getTime() - range.ms);
  const { rows } = await db.query(
    `SELECT time_bucket($4 * interval '1 second', time) AS time, avg(light) AS light, avg(air) AS air
       FROM device_readings WHERE device_id = $1 AND time > $2 AND time <= $3 GROUP BY 1 ORDER BY 1`,
    [deviceId, from, newest.time, range.bucketSeconds]
  );
  response.json({
    range: request.query.range || "6h", bucketSeconds: range.bucketSeconds, from, to: newest.time,
    points: rows.map(row => ({ time: row.time, light: Math.round(row.light * 10) / 10, air: Math.round(row.air * 10) / 10 })),
  });
});

module.exports = { router, requireProfile, isObject };
