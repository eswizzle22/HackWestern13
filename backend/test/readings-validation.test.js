const { test } = require("node:test");
const assert = require("node:assert/strict");

// parseReading needs no database, but requiring the route module loads the pool, so provide a dummy URL.
process.env.DATABASE_URL ||= "postgres://unused:unused@localhost:1/unused";
const { parseReading } = require("../src/routes/readings");

const now = new Date("2026-01-05T09:00:00Z");
const valid = { device_id: "CA-0018", light_avg: 300, air_avg: 400 };

test("accepts the sensor script's field names", () => {
  const { reading } = parseReading(valid, now);
  assert.deepEqual({ ...reading }, { deviceId: "CA-0018", light: 300, air: 400, time: now });
});

test("also accepts light and air", () => {
  assert.equal(parseReading({ device_id: "A", light: 10, air: 20 }, now).reading.light, 10);
});

test("clamps light between 625 and 1023 down to 625", () => {
  assert.equal(parseReading({ ...valid, light_avg: 800 }, now).reading.light, 625);
});

test("rejects light above 1023, negative values, and air above 1023", () => {
  assert.ok(parseReading({ ...valid, light_avg: 1100 }, now).error);
  assert.ok(parseReading({ ...valid, light_avg: -1 }, now).error);
  assert.ok(parseReading({ ...valid, air_avg: 1024 }, now).error);
});

test("rejects missing or non-numeric fields", () => {
  assert.ok(parseReading({ light_avg: 1, air_avg: 1 }, now).error);
  assert.ok(parseReading({ device_id: "A", light_avg: "bright", air_avg: 1 }, now).error);
  assert.ok(parseReading({ device_id: "A", light_avg: 1 }, now).error);
});

test("validates a supplied time", () => {
  assert.ok(parseReading({ ...valid, time: "not a date" }, now).error);
  assert.ok(parseReading({ ...valid, time: "2026-01-05T10:00:00Z" }, now).error);
  assert.ok(parseReading({ ...valid, time: "2025-12-01T00:00:00Z" }, now).error);
  assert.equal(parseReading({ ...valid, time: "2026-01-05T08:59:00Z" }, now).reading.time.toISOString(), "2026-01-05T08:59:00.000Z");
});
