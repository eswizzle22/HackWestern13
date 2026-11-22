-- Safe to run repeatedly: every statement is idempotent.
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- One row per person. user_id is the Auth0 "sub". survey and settings are JSONB so the
-- shape used by the frontend (backend.js) can change without a migration.
CREATE TABLE IF NOT EXISTS profiles (
  user_id       text PRIMARY KEY,
  name          text,
  device_id     text,
  survey_status text NOT NULL DEFAULT 'skipped',
  survey        jsonb NOT NULL DEFAULT '{}',
  settings      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- A device belongs to at most one profile, so incoming readings always know whose session to open.
DROP INDEX IF EXISTS profiles_device;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_device_unique ON profiles (device_id) WHERE device_id IS NOT NULL;

-- The live stream from the Arduino: one row per averaged record from the sensor script.
-- light is 0 (darkest) to 625 (brightest); air is 0 (best) to 1023 (worst).
CREATE TABLE IF NOT EXISTS device_readings (
  time      timestamptz NOT NULL,
  device_id text NOT NULL,
  light     real NOT NULL CHECK (light BETWEEN 0 AND 625),
  air       real NOT NULL CHECK (air BETWEEN 0 AND 1023)
);
-- Turns the table into a hypertable: Timescale splits it into time chunks behind the scenes.
SELECT create_hypertable('device_readings', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS device_readings_device_time ON device_readings (device_id, time DESC);

-- A working session lasts while the Arduino is on. ended_at stays NULL while it is on.
-- The summary columns are filled in when the session closes, so lists never have to scan readings.
CREATE TABLE IF NOT EXISTS working_sessions (
  id            bigserial PRIMARY KEY,
  user_id       text NOT NULL REFERENCES profiles ON DELETE CASCADE,
  device_id     text NOT NULL,
  started_at    timestamptz NOT NULL,
  ended_at      timestamptz,
  avg_light     real,
  avg_air       real,
  max_light     real,
  max_air       real,
  reading_count integer,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX IF NOT EXISTS working_sessions_user_started ON working_sessions (user_id, started_at DESC);
-- A device can only have one open session at a time.
CREATE UNIQUE INDEX IF NOT EXISTS working_sessions_one_open ON working_sessions (device_id) WHERE ended_at IS NULL;

-- One row per symptom the user logs. session_id is NULL when the device was off, and in that
-- case the sensor columns stay NULL. severity is NULL when the user skips that step.
-- light_avg_30m and air_avg_30m are the averages of the 30 minutes before logged_at, frozen at log time.
CREATE TABLE IF NOT EXISTS symptom_logs (
  id                 bigserial PRIMARY KEY,
  user_id            text NOT NULL REFERENCES profiles ON DELETE CASCADE,
  session_id         bigint REFERENCES working_sessions ON DELETE SET NULL,
  logged_at          timestamptz NOT NULL,
  symptom            text NOT NULL CHECK (symptom IN ('headache', 'eye_strain', 'brain_fog', 'fatigue', 'irritated_eyes', 'other')),
  severity           smallint CHECK (severity BETWEEN 1 AND 10),
  note               text,
  light              real,
  light_avg_30m      real,
  air                real,
  air_avg_30m        real,
  readings_in_window integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS symptom_logs_user_logged ON symptom_logs (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS symptom_logs_session ON symptom_logs (session_id);
