# Prodrome backend

An Express server on top of TigerData (TimescaleDB). It receives the Arduino's readings, groups them into working sessions, stores symptoms with sensor averages, and serves the website.

## Run it

```
cd backend
cp .env.example .env    # fill in DATABASE_URL and DEVICE_KEY (never commit .env)
npm install
npm run migrate         # create the tables (safe to repeat)
npm run seed            # optional: 14 days of sample data for "demo-user"
npm start               # http://localhost:3000
```

`.env` settings: `DATABASE_URL`, `DEVICE_KEY` (secret the sensor script sends), `PORT`, `FRONTEND_ORIGIN`, `SESSION_TIMEOUT_SECONDS` (default 120). Optional: `DEFAULT_DEVICE_ID`, the device given to the first real user who signs up.

Other commands: `npm test`, `npm run dev` (auto-restart), `npm run simulate` (fake Arduino), `npm run db:reset -- --yes` (deletes every table).

## Tables

| Table | One row is | Key columns |
|---|---|---|
| `profiles` | a person | `user_id` (the Auth0 id), `name`, `device_id`, `survey_status`, `survey` and `settings` (JSON) |
| `device_readings` | one 30-second sensor record (time series) | `time`, `device_id`, `light` (0 to 625), `air` (0 to 1023, lower is better) |
| `working_sessions` | the time the Arduino was on | `user_id`, `device_id`, `started_at`, `ended_at` (empty while on), plus average and max light and air saved when it closes |
| `symptom_logs` | one symptom the user logged | `user_id`, `session_id` (empty if the device was off), `symptom`, `severity` (1 to 10, optional), `note`, and the light and air averages of the 30 minutes before |

Symptoms: `headache`, `eye_strain`, `brain_fog`, `fatigue`, `irritated_eyes`, `other`. A device belongs to at most one profile.

## How it works

1. **Readings in.** The sensor script posts to `POST /api/readings` with the `x-device-key` header.
2. **Sessions.** The first reading after silence opens a session. After 2 minutes with no readings it closes, because the Arduino is off.
3. **Symptoms.** Logging one saves the average light and air of the previous 30 minutes. It works with the device off, with the sensor columns left empty.
4. **Insights.** The server compares how often a symptom followed stale air, bright or dim light, or a long stretch without a break against how often that condition simply happens. Plain templates write the wording.

## API

Routes are under `/api/users/:userId`.

| Route | Purpose |
|---|---|
| `GET`, `POST`, `PUT /` | Profile: survey and settings |
| `GET /device` | Online or offline, newest reading, comfort score, open session |
| `GET /readings?range=15m\|6h\|24h\|7d` | Chart points |
| `GET /sessions`, `GET /sessions/:id` | Past sessions, and one with its readings |
| `GET`, `POST /symptoms` | The symptom log, and logging a symptom |
| `GET /symptoms/:id/context` | The 2 hours before a symptom |
| `GET /insights` | Patterns across sessions |

## Not done yet

- **Login checks.** The server trusts the `userId` in the URL, so anyone who knows an id can read that user's data. It needs Auth0 token verification.
- **Comfort score.** `comfortScore` in `src/bands.js` is a placeholder formula.
- **Device pairing.**

## Where things are

`src/` server code (`routes/`, `sessions.js`, `symptoms.js`, `bands.js` for thresholds) · `db/` schema, seed and reset · `scripts/` fake Arduino · `test/` automated tests.
