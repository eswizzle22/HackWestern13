# CircaAir prototype

## Repository structure

- `app.js` - shared application state, routing shell, data engine, events, and live-data polling
- `pages/login.js` - login and demo-access page
- `pages/dashboard.js` - dashboard, live readings, chart, and symptom section
- `pages/onboarding.js` - sensitivity survey
- `pages/insights.js` - correlations and insight history
- `pages/device.js` - CircaAir One and device settings
- `server.js` - static server, Gemini proxy, and temporary live-data API

A dependency-free browser prototype based on the CircaAir project brief. It includes:

- Live dashboard with seeded air quality, light, alignment score, trends, and Gemini-style intervention.
- Sensitivity survey with editable sensitivity levels.
- Insights page with confidence meter, personalized triggers, and lagged symptom correlations.
- Device page with an LED matrix mirror, sensor status, break settings, and circadian schedule.
- Hash-based navigation and simulated live sensor updates.

## Run locally

Create `.env` once:

```powershell
Copy-Item .env.example .env
```

Open `.env` and set `GEMINI_API_KEY`. The key is read automatically by `server.js`.
In VS Code, press `F5` and choose **Run CircaAir**. No terminal environment setup is required.

Start the Node server:

```powershell
$env:GEMINI_API_KEY = "your-server-side-key"
npm start
```

If npm is blocked by your PowerShell execution policy, run the server directly:

```powershell
$env:GEMINI_API_KEY = "your-server-side-key"
node server.js
```

Then visit `http://127.0.0.1:8000`. `/api/health` reports whether Gemini is configured.

## Auth0 setup

The prototype includes a polished Auth0-ready login page and demo fallback.

1. Create a **Single Page Application** in your Auth0 dashboard.
2. Add `http://localhost:8000` as an allowed callback URL, allowed logout URL, and allowed web origin.
3. In `index.html`, replace `YOUR_AUTH0_DOMAIN` and `YOUR_AUTH0_CLIENT_ID` in `CIRCAAIR_AUTH0_CONFIG`.
4. Refresh the app. Use **Continue with Auth0** for the secure flow or **Explore the demo** to browse locally.

## Insight engine

The prototype uses simulated 7-day sensor history plus seeded symptom logs for the correlation engine:

- Lookback window: 2 hours
- Minimum logs: 5
- Minimum displayed confidence: 60%
- Symptom severity: 1–5
- Grove air-sensor warning threshold: 700/1023 qualitative ADC
- Grove harsh-light warning threshold: 700/1023 analog ADC
- Grove dim-light threshold: 300/1023 analog ADC after 8 PM

These values are calculated from the in-browser simulated data. Correlations are observations, not evidence of medical causation.

## Safe Gemini integration

Gemini credentials must remain on a server. Set `window.CIRCAAIR_GEMINI_CONFIG` only to enable a same-origin server proxy; never put an API key in `index.html` or `app.js`.

The browser sends only a JSON context containing symptom names, severity bands, environmental bands, time-of-day band, and an optional correlation confidence band. It does not send names, account IDs, exact timestamps, locations, or raw logs.

The proxy should accept `POST` JSON:

```json
{
  "context": {
    "symptoms": [{ "symptom": "Headache", "severityBand": "moderate" }],
    "environment": { "airBand": "moderate", "lightBand": "bright", "timeOfDayBand": "daytime" },
    "correlation": { "label": "Air quality rise", "confidenceBand": "medium" }
  },
  "instructions": "..."
}
```

It should return only:

```json
{
  "intervention": "Short dashboard title",
  "detail": "Short explanatory sentence",
  "notification": "Short notification copy"
}
```

If the endpoint is disabled, times out, returns an error, or returns malformed copy, the app uses local fallback suggestions.

## Temporary live-data collector

The dashboard includes a **Start/Stop working** control and a temporary sensor input panel:

1. Start the app with `node server.js` or VS Code's **Run CircaAir** launch configuration.
2. Open `http://127.0.0.1:8000`.
3. Choose **Start working** to begin regular dashboard polling.
4. Enter a 10-bit Grove air-sensor reading and light-sensor reading from 0–1023.
5. Choose **Insert live reading** to update the dashboard and chart immediately.

The temporary API is `GET/POST /api/live-data`. A POST accepts:

```json
{
  "airRaw": 754,
  "lightRaw": 530
}
```

This collector is intentionally in-memory and will reset when the server restarts. Replace it with hardware polling or a sensor ingestion endpoint when the device is connected.

## Working sessions and personalized thresholds

- Starting a working session captures sensor readings and 1–5 symptom severity logs.
- The sensitivity survey calibrates air, bright-light, dim-light, and VOC thresholds. Until it is completed, default thresholds are used.
- Thresholds are recalculated at session start, after symptom logs and survey changes, and once every hour.
- The Gemini context includes the sensitivity profile, recent symptom severity, threshold profile, and device specifications.
- Stopping a session uploads it through `POST /api/session-data`; the insights page pulls recent sessions through `GET /api/session-data`.
- Session uploads are retained locally in browser storage and in the prototype server's in-memory session store.
