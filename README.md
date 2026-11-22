# Prodrome

A desk companion that tracks the air and light around you, and helps you spot what is behind headaches, brain fog and tired eyes.

## What is in the repo

- `index.html`, `app.js`, `styles.css`, `backend.js` is the website. `backend.js` is the only file that talks to the data backend.
- `server.js` is the website server. It serves the site on port 8000 and proxies Gemini, so the Gemini key never reaches the browser.
- `backend/` is the data server on port 3000 (TigerData). It stores profiles, readings, working sessions and symptoms. See `backend/README.md`.
- `migrane_light_moniter.py` reads the Arduino and sends readings to the backend.
- `DESIGN.md` is the design system.
- `pages/` is left over from an earlier split of the app and is not loaded.

## Run it

Two servers, in two terminals:

```
cd backend && npm start     # data server, http://localhost:3000
npm start                   # website and Gemini, http://localhost:8000
```

Then visit `http://localhost:8000`. First-time setup for the backend is in `backend/README.md`.

### Gemini key (optional)

Suggestions on the dashboard come from Gemini. Without a key the app shows built-in suggestions instead.

1. Create a file named `.env` in this folder (it is ignored by git).
2. Add `GEMINI_API_KEY=your-key`. `GEMINI_MODEL` can optionally name a different model.
3. Restart `npm start`.

Never put a key in `index.html` or `app.js`.

## Auth0 setup

1. Create a **Single Page Application** in your Auth0 dashboard.
2. Add `http://localhost:8000` as an allowed callback URL, allowed logout URL and allowed web origin.
3. In `index.html`, set `domain` and `clientId` in `PRODROME_AUTH0_CONFIG`.
4. Use **Get started** for the real sign-in, or **Explore the demo** to browse the sample data.
