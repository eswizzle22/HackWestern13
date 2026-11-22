const express = require("express");
const db = require("../db");
const { startSession, stopSession, confirmActive, sessionJson } = require("../sessions");
const { thresholdsFor } = require("../thresholds");
const { requireProfile } = require("./users");

const router = express.Router();

// The user starts and stops their own working session, and answers the hourly "still working?" check-in.
router.post("/api/users/:userId/sessions/start", requireProfile, async (request, response) => {
  response.status(201).json(sessionJson(await db.transaction(client => startSession(client, request.params.userId)), [], await thresholdsFor(db, request.profile)));
});

router.post("/api/users/:userId/sessions/stop", requireProfile, async (request, response) => {
  response.json(sessionJson(await db.transaction(client => stopSession(client, request.params.userId)), [], await thresholdsFor(db, request.profile)));
});

router.post("/api/users/:userId/sessions/confirm", requireProfile, async (request, response) => {
  response.json(sessionJson(await db.transaction(client => confirmActive(client, request.params.userId)), [], await thresholdsFor(db, request.profile)));
});

module.exports = { router };
