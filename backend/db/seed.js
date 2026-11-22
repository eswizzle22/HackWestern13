// Builds 14 days of believable sample data for the "demo-user" profile and its device "CA-DEMO".
// Re-running replaces the previous sample data. The random seed is fixed, so the shape is the same every time;
// only the dates move forward with today.
const db = require("../src/db");
const { closeSession } = require("../src/sessions");
const { logSymptom } = require("../src/symptoms");
const { AIR_CAUTION, LIGHT_HARSH_ABOVE, LIGHT_DIM_BELOW } = require("../src/bands");

const USER_ID = "demo-user";
const DEVICE_ID = "CA-DEMO";
const DAYS = 14;
const STEP_MS = 30 * 1000; // one averaged record every 30 seconds, like the real sensor script
const AIR_MAX = 1023;
const LIGHT_MAX = 625;

function mulberry32(seed) {
  return function random() {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20260101);
const between = (min, max) => min + random() * (max - min);
const gauss = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round1 = value => Math.round(value * 10) / 10;
const pick = list => list[Math.floor(random() * list.length)];

// Which sessions happen on a day. Weekdays are mostly a morning and an afternoon session (the device is off at lunch),
// sometimes one long session, and now and then an evening session with the lamp on.
function planSessions(date, isStuffyDay) {
  const weekday = date.getDay() >= 1 && date.getDay() <= 5;
  const plans = [];
  if (weekday) {
    const kind = random();
    if (kind < 0.7) {
      const morningStart = between(8.8, 9.4);
      const morningLength = between(2.8, 3.6);
      const afternoonStart = morningStart + morningLength + between(0.7, 1);
      plans.push([morningStart, morningLength], [afternoonStart, between(3.3, 4.4)]);
    } else if (kind < 0.9) {
      plans.push([between(9, 9.5), between(8, 8.5)]);
    }
    if (random() < 0.15) plans.push([between(19.8, 20.3), between(1, 1.5)]);
  } else if (random() < 0.25) {
    plans.push([between(10, 11), between(1.5, 2)]);
  }
  return plans.map(([startHour, lengthHours]) => ({ startHour, lengthHours, stuffy: isStuffyDay }));
}

// Builds one session's readings: air slowly builds up in a closed room (faster on stuffy days) and drops when a window
// is opened; light follows the daylight curve, with glare in the early afternoon on bright days.
function buildSession(date, plan, glareDay) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  start.setMinutes(Math.round(plan.startHour * 60));
  const count = Math.round((plan.lengthHours * 3600 * 1000) / STEP_MS);

  const airStart = between(170, 260);
  const gainPerHour = plan.stuffy ? between(110, 165) : between(30, 60);
  const windowOpenings = Array.from({ length: plan.stuffy ? (random() < 0.4 ? 1 : 0) : Math.floor(between(0, 2.2)) }, () => ({ at: between(0.8, plan.lengthHours - 0.5), saved: between(0.8, 1.6) }));
  let airNoise = 0;
  let lightNoise = 0;

  const readings = [];
  for (let i = 1; i <= count; i++) {
    const time = new Date(start.getTime() + i * STEP_MS);
    const hours = (i * STEP_MS) / 3600000;
    const clock = time.getHours() + time.getMinutes() / 60;

    // Opening a window removes some of the built-up stuffiness over about five minutes.
    const saved = windowOpenings.reduce((total, event) => total + event.saved * clamp((hours - event.at) / (5 / 60), 0, 1), 0);
    airNoise = 0.9 * airNoise + gauss() * 4;
    const air = clamp(airStart + gainPerHour * Math.max(0, hours - saved) + airNoise, 60, 900);

    const daylight = clock > 7 && clock < 19 ? 60 + 340 * Math.sin((Math.PI * (clock - 7)) / 12) : 60;
    const glare = glareDay ? 150 * Math.exp(-(((clock - 14.2) / 0.9) ** 2)) : 0;
    const lamp = clock >= 19 ? 130 : 0;
    lightNoise = 0.85 * lightNoise + gauss() * 6;
    const light = clamp(daylight + glare + lamp + lightNoise, 0, LIGHT_MAX);

    readings.push({ time, light: round1(light), air: round1(Math.min(air, AIR_MAX)) });
  }
  return { startedAt: new Date(readings[0].time.getTime() - STEP_MS), endedAt: readings[readings.length - 1].time, readings };
}

const NOTES = {
  headache: ["Started behind the eyes", "Dull and constant", "Came on gradually"],
  eye_strain: ["Screen glare today", "Eyes feel dry"],
  brain_fog: ["Hard to focus", "Room felt stuffy"],
  fatigue: ["Heavy afternoon slump"],
  irritated_eyes: ["Eyes itchy and red"],
};

// Decides when symptoms happen in a session, using the same kind of 30-minute averages the app records.
function planSymptoms(session) {
  const events = [];
  const lastLogged = {};
  const stepMs = 10 * 60 * 1000;
  for (let t = session.startedAt.getTime() + 25 * 60 * 1000; t <= session.endedAt.getTime() && events.length < 3; t += stepMs) {
    const window = session.readings.filter(reading => reading.time.getTime() > t - 30 * 60 * 1000 && reading.time.getTime() <= t);
    if (!window.length) continue;
    const air = window.reduce((sum, reading) => sum + reading.air, 0) / window.length;
    const light = window.reduce((sum, reading) => sum + reading.light, 0) / window.length;
    const minutesIn = (t - session.startedAt.getTime()) / 60000;

    const chances = {
      headache: air >= 600 ? 0.25 : air >= AIR_CAUTION ? 0.07 : 0.008,
      brain_fog: (air >= 550 ? 0.16 : 0.008) + (minutesIn >= 150 ? 0.03 : 0),
      eye_strain: light > LIGHT_HARSH_ABOVE ? 0.22 : minutesIn >= 150 ? 0.03 : 0.008,
      irritated_eyes: light > LIGHT_HARSH_ABOVE && air >= AIR_CAUTION ? 0.1 : 0.005,
      fatigue: (minutesIn >= 300 ? 0.12 : minutesIn >= 150 ? 0.06 : 0.005) + (light < LIGHT_DIM_BELOW ? 0.08 : 0),
      other: 0.003,
    };
    for (const [symptom, chance] of Object.entries(chances)) {
      if (events.length >= 3 || random() > chance) continue;
      if (lastLogged[symptom] && t - lastLogged[symptom] < 90 * 60 * 1000) continue;
      lastLogged[symptom] = t;
      const excess = symptom === "headache" || symptom === "brain_fog" ? (air - AIR_CAUTION) / 70 : symptom === "eye_strain" || symptom === "irritated_eyes" ? (light - LIGHT_HARSH_ABOVE) / 30 : minutesIn / 100;
      const time = new Date(Math.min(t + between(-4, 4) * 60000, session.endedAt.getTime() - 60000));
      events.push({
        symptom, time, severity: clamp(Math.round(3 + excess + gauss()), 2, 9),
        note: random() < 0.25 && NOTES[symptom] ? pick(NOTES[symptom]) : null,
      });
    }
  }
  return events;
}

async function insertReadings(client, readings) {
  for (let i = 0; i < readings.length; i += 2000) {
    const chunk = readings.slice(i, i + 2000);
    await client.query(
      "INSERT INTO device_readings (time, device_id, light, air) SELECT * FROM unnest($1::timestamptz[], $2::text[], $3::real[], $4::real[])",
      [chunk.map(r => r.time), chunk.map(() => DEVICE_ID), chunk.map(r => r.light), chunk.map(r => r.air)]
    );
  }
}

const DEMO_SURVEY = {
  about: { name: { first: "Alex", last: "Chen" }, profile: { age: 34, height: 170, weight: 66, sex: "" } },
  health: { familyHistory: "yes", headacheDays: "4-7", sleepHours: 6.5, screenTime: 9, caffeine: "3-4", hormonal: [], symptoms: ["Migraine / Headache", "Eye Strain", "Brain Fog"] },
  environment: {
    sensitivities: { light: "high", dim: "medium", air: "high", voc: "low" },
    schedule: { workStart: "09:00", workEnd: "17:00", windDown: "21:00" },
  },
};
const DEMO_SETTINGS = { theme: "light", thresholdMode: "auto", ledAlerts: true, units: { height: "cm", weight: "kg" } };

async function seed() {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM symptom_logs WHERE user_id = $1", [USER_ID]);
    await client.query("DELETE FROM working_sessions WHERE user_id = $1", [USER_ID]);
    await client.query("DELETE FROM device_readings WHERE device_id = $1", [DEVICE_ID]);
    await client.query("DELETE FROM profiles WHERE user_id = $1", [USER_ID]);
    await client.query(
      "INSERT INTO profiles (user_id, name, device_id, survey_status, survey, settings) VALUES ($1, 'Alex Chen', $2, 'completed', $3, $4)",
      [USER_ID, DEVICE_ID, DEMO_SURVEY, DEMO_SETTINGS]
    );

    const sessions = [];
    const today = new Date();
    for (let daysAgo = DAYS; daysAgo >= 1; daysAgo--) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
      // The last few days are normal ones, so the demo opens on a calm dashboard instead of a poor-air reading.
      const stuffyDay = daysAgo <= 3 ? false : random() < 0.5;
      const glareDay = random() < 0.3;
      for (const plan of planSessions(date, stuffyDay)) sessions.push(buildSession(date, plan, glareDay));
    }

    let readingCount = 0;
    const symptomEvents = [];
    for (const session of sessions) {
      await insertReadings(client, session.readings);
      readingCount += session.readings.length;
      const { rows: [created] } = await client.query(
        "INSERT INTO working_sessions (user_id, device_id, started_at) VALUES ($1, $2, $3) RETURNING id, device_id, started_at", [USER_ID, DEVICE_ID, session.startedAt]
      );
      await closeSession(client, created, session.endedAt, "manual");
      symptomEvents.push(...planSymptoms(session));
    }

    // Logged through the app's own function, so the stored averages are calculated exactly as they are live.
    for (const event of symptomEvents) {
      await logSymptom(client, { userId: USER_ID, symptom: event.symptom, severity: event.severity, note: event.note, time: event.time });
    }
    await client.query("COMMIT");
    console.log(`Seeded ${USER_ID}: ${sessions.length} sessions, ${readingCount} readings, ${symptomEvents.length} symptom logs.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await db.end();
  }
}

seed().catch(error => {
  console.error("Seeding failed:", error.message);
  process.exit(1);
});
