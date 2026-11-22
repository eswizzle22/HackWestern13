// Backend plugin: the only place the frontend talks to the Prodrome backend. The backend owns the TigerData
// connection; the browser never talks to the database directly, only to these endpoints (all under /api/users/:userId).
//
// Profile (survey and settings):
//   GET  /api/users/:userId   -> 200 with { surveyStatus, survey, settings }, 404 user does not exist
//   POST /api/users/:userId   -> creates the user; body { surveyStatus, survey, settings }
//   PUT  /api/users/:userId   -> updates the user; body { surveyStatus, survey, settings } (any subset)
//
//   surveyStatus: "completed" (all three sections saved), "partial" (some), "skipped" (none).
//   survey holds only the sections the user saved. A missing section means it was skipped and is "Not set":
//     about:       { name: { first, last }, profile: { age, height (cm), weight (kg), sex } }
//     health:      { familyHistory, headacheDays, sleepHours, screenTime, caffeine, hormonal[], symptoms[] }
//     environment: { sensitivities: { light, dim, air, voc }, schedule: { workStart, workEnd, windDown } }
//   Only about.name.first and about.name.last are required, and only when the about section is saved.
//   Other fields are null or "" when left blank. Each save sends whole sections, so the backend never merges nested fields.
//   settings: { theme, thresholdMode, ledAlerts, units: { height: "cm" | "ft", weight: "kg" | "lb" } }
//
// Live data and history (read-only, except logSymptom):
//   GET  /device                 -> { deviceId, online, lastSeen, latest, score, session }
//   GET  /readings?range=        -> chart points for 15m, 6h, 24h or 7d, ending at the newest reading
//   GET  /sessions?limit&before  -> working sessions, newest first, with their symptoms
//   GET  /sessions/:id           -> one session with its readings
//   GET  /symptoms?limit&before  -> the symptom log, newest first
//   GET  /symptoms/:id/context   -> the two hours of readings before one symptom
//   POST /symptoms               -> body { symptom, severity (1-10, optional), note (optional) }
//   GET  /insights               -> patterns across sessions
//
// With mock on (the default when no baseUrl is set), the profile is kept in localStorage and every live-data call
// resolves to null, so the app still runs without a server.
(function () {
  const config = window.PRODROME_BACKEND_CONFIG || {};
  const useMock = config.mock === undefined ? !config.baseUrl : config.mock;
  const mockKey = userId => `prodrome-mock-user:${userId}`;

  async function request(method, userId, subpath = "", body) {
    const headers = { "Content-Type": "application/json" };
    if (typeof config.getToken === "function") {
      headers.Authorization = `Bearer ${await config.getToken()}`;
    }
    return fetch(`${config.baseUrl}/api/users/${encodeURIComponent(userId)}${subpath}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  const query = params => {
    const text = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null)).toString();
    return text ? `?${text}` : "";
  };

  async function read(userId, subpath) {
    if (useMock) return null;
    const response = await request("GET", userId, subpath);
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }

  // Resolves the stored user ({ surveyStatus, survey, settings }) or null if they don't exist.
  async function getUser(userId) {
    if (useMock) {
      const stored = localStorage.getItem(mockKey(userId));
      return stored === null ? null : JSON.parse(stored);
    }
    const response = await request("GET", userId);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`User lookup failed (${response.status})`);
    return response.json();
  }

  // Creates the user record. Called when the survey is finished or skipped.
  async function registerUser(userId, { surveyStatus, survey = null, settings = null }) {
    if (useMock) {
      localStorage.setItem(mockKey(userId), JSON.stringify({ surveyStatus, survey, settings }));
      return;
    }
    const response = await request("POST", userId, "", { surveyStatus, survey, settings });
    if (!response.ok) throw new Error(`User save failed (${response.status})`);
  }

  // Updates an existing user's survey sections and/or settings from the Profile page.
  // `changes` holds only the top-level fields being sent, e.g. { survey: {...}, settings: {...} } or { settings: {...} }.
  async function updateUser(userId, changes) {
    if (useMock) {
      const stored = JSON.parse(localStorage.getItem(mockKey(userId)) || "{}");
      localStorage.setItem(mockKey(userId), JSON.stringify({ ...stored, ...changes }));
      return;
    }
    const response = await request("PUT", userId, "", changes);
    if (!response.ok) throw new Error(`User update failed (${response.status})`);
  }

  // Saves one symptom. The backend adds the 30-minute sensor averages. Resolves null when mock is on.
  async function logSymptom(userId, { symptom, severity = null, note = null }) {
    if (useMock) return null;
    const response = await request("POST", userId, "/symptoms", { symptom, severity, note });
    if (!response.ok) throw new Error(`Symptom save failed (${response.status})`);
    return response.json();
  }

  window.ProdromeBackend = {
    getUser, registerUser, updateUser, logSymptom,
    getDevice: userId => read(userId, "/device"),
    getReadings: (userId, range) => read(userId, `/readings${query({ range })}`),
    getSessions: (userId, options = {}) => read(userId, `/sessions${query(options)}`),
    getSession: (userId, sessionId) => read(userId, `/sessions/${sessionId}`),
    getSymptoms: (userId, options = {}) => read(userId, `/symptoms${query(options)}`),
    getSymptomContext: (userId, symptomId) => read(userId, `/symptoms/${symptomId}/context`),
    getInsights: userId => read(userId, "/insights"),
  };
})();
