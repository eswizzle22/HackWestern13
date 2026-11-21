# CircaAir prototype

A dependency-free browser prototype based on the CircaAir project brief. It includes:

- Live dashboard with seeded air quality, light, alignment score, trends, and Gemini-style intervention.
- Sensitivity survey with editable sensitivity levels.
- Insights page with confidence meter, personalized triggers, and lagged symptom correlations.
- Device page with an LED matrix mirror, sensor status, break settings, and circadian schedule.
- Hash-based navigation and simulated live sensor updates.

## Run locally

Open `index.html` in a browser, or serve the folder with any static file server:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Auth0 setup

The prototype includes a polished Auth0-ready login page and demo fallback.

1. Create a **Single Page Application** in your Auth0 dashboard.
2. Add `http://localhost:8000` as an allowed callback URL, allowed logout URL, and allowed web origin.
3. In `index.html`, replace `YOUR_AUTH0_DOMAIN` and `YOUR_AUTH0_CLIENT_ID` in `CIRCAAIR_AUTH0_CONFIG`.
4. Refresh the app. Use **Continue with Auth0** for the secure flow or **Explore the demo** to browse locally.
