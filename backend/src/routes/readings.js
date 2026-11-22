const crypto = require("node:crypto");
const express = require("express");
const db = require("../db");
const { LIGHT_MAX, AIR_MAX } = require("../config");
const { ingestReading } = require("../sessions");

const router = express.Router();

// The sensor script proves it is ours with a shared secret in the x-device-key header.
function requireDeviceKey(request, response, next) {
  const expected = process.env.DEVICE_KEY;
  if (!expected) return response.status(503).json({ error: "DEVICE_KEY is not configured on the server" });
  const hash = value => crypto.createHash("sha256").update(String(value || "")).digest();
  if (!crypto.timingSafeEqual(hash(request.get("x-device-key")), hash(expected))) {
    return response.status(401).json({ error: "Invalid device key" });
  }
  next();
}

// Accepts the sensor script's field names (light_avg, air_avg) as well as light and air.
function parseReading(body, now = new Date()) {
  const deviceId = typeof body.device_id === "string" ? body.device_id.trim() : "";
  if (!deviceId || deviceId.length > 64) return { error: "device_id is required" };

  const light = Number(body.light_avg ?? body.light);
  const air = Number(body.air_avg ?? body.air);
  if (!Number.isFinite(light) || light < 0 || light > 1023) return { error: "light must be a number from 0 to 625" };
  if (!Number.isFinite(air) || air < 0 || air > AIR_MAX) return { error: `air must be a number from 0 to ${AIR_MAX}` };

  // The device has no clock, so the server's time is used unless a valid one is supplied.
  const time = body.time === undefined ? now : new Date(body.time);
  if (Number.isNaN(time.getTime())) return { error: "time is not a valid date" };
  if (time - now > 60 * 1000) return { error: "time is in the future" };
  if (now - time > 7 * 24 * 60 * 60 * 1000) return { error: "time is more than 7 days old" };

  // Slightly bright readings above the expected range are clamped instead of being thrown away.
  return { reading: { deviceId, light: Math.min(light, LIGHT_MAX), air, time } };
}

router.post("/api/readings", requireDeviceKey, async (request, response) => {
  const { reading, error } = parseReading(request.body || {});
  if (error) return response.status(400).json({ error });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await ingestReading(client, reading);
    await client.query("COMMIT");
    response.status(201).json(result);
  } catch (caught) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Storing reading failed:", caught.message);
    response.status(500).json({ error: "Could not store reading" });
  } finally {
    client.release();
  }
});

module.exports = { router, parseReading };
