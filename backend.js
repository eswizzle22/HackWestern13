// Backend plugin skeleton. The real backend (in progress) owns the TigerData connection;
// the browser never talks to the database directly, only to these endpoints.
//
// Assumed contract (change here once the backend is final):
//   GET  {baseUrl}/api/users/:userId   -> 200 with { surveyStatus, survey, settings }, 404 user does not exist
//   POST {baseUrl}/api/users/:userId   -> creates the user; body { surveyStatus, survey, settings }
//   PUT  {baseUrl}/api/users/:userId   -> updates the user; body { surveyStatus, survey, settings } (settings-only updates send just { settings })
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
// With no baseUrl configured, a localStorage mock stands in so the flow can be exercised.
(function () {
  const config = window.CIRCAAIR_BACKEND_CONFIG || {};
  const mockKey = userId => `circaair-mock-user:${userId}`;

  async function request(method, userId, body) {
    const headers = { "Content-Type": "application/json" };
    if (typeof config.getToken === "function") {
      headers.Authorization = `Bearer ${await config.getToken()}`;
    }
    return fetch(`${config.baseUrl}/api/users/${encodeURIComponent(userId)}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // Resolves the stored user ({ surveyStatus, survey, settings }) or null if they don't exist.
  async function getUser(userId) {
    if (!config.baseUrl) {
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
    if (!config.baseUrl) {
      localStorage.setItem(mockKey(userId), JSON.stringify({ surveyStatus, survey, settings }));
      return;
    }
    const response = await request("POST", userId, { surveyStatus, survey, settings });
    if (!response.ok) throw new Error(`User save failed (${response.status})`);
  }

  // Updates an existing user's survey sections and/or settings from the Profile page.
  // `changes` holds only the top-level fields being sent, e.g. { survey: {...}, settings: {...} } or { settings: {...} }.
  // Adjust the method, path or body shape here to match the backend.
  async function updateUser(userId, changes) {
    if (!config.baseUrl) {
      const stored = JSON.parse(localStorage.getItem(mockKey(userId)) || "{}");
      localStorage.setItem(mockKey(userId), JSON.stringify({ ...stored, ...changes }));
      return;
    }
    const response = await request("PUT", userId, changes);
    if (!response.ok) throw new Error(`User update failed (${response.status})`);
  }

  window.CircaAirBackend = { getUser, registerUser, updateUser };
})();
