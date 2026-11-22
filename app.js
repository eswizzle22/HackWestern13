// Working product name. Change it here to rename the app everywhere.
const BRAND = "Prodrome";

const state = {
  route: location.hash.slice(1) || "login",
  auth: null,
  authenticated: false,
  authReady: false,
  authConfigured: false,
  demoMode: false,
  user: null,
  needsSurvey: false,
  onboardingStep: 1,
  saved: defaultSaved(),
  registered: false,
  profileSection: null,
  survey: defaultSurvey(),
  settings: defaultSettings(),
  selectedRange: "6h",
  live: defaultLive(),
  history: defaultHistory(),
  symptomModal: null,
  notificationsOpen: false,
  notifications: [
    { type: "warning", title: "Air's been getting a bit stale", message: "Some fresh air might help when you get a chance." },
    { type: "suggestion", title: "A screen break might help soon", message: "Your focus interval wraps up in about 18 minutes." },
    { type: "suggestion", title: "Great focus window", message: "Light and air quality are aligned for deep work right now." },
  ],
};

const routeMeta = {
  login: ["Welcome", "Sign in to Prodrome"],
  dashboard: ["Live dashboard", "Good morning, Alex"],
  onboarding: ["Sensitivity survey", "Personalize your guardian"],
  insights: ["Insights & triggers", "Your environment, decoded"],
  device: ["Device & settings", "Prodrome desk companion"],
  profile: ["Profile & settings", "Your profile"],
};

const navItems = [
  ["dashboard", "⌂", "Dashboard"],
  ["insights", "◌", "Insights"],
  ["device", "⌁", "Device"],
];

function render() {
  const app = document.querySelector("#app");
  if (!state.authenticated && state.route !== "login") {
    state.route = "login";
  }
  if (state.authenticated && state.needsSurvey) {
    state.route = "onboarding";
  }
  if (state.route === "login") {
    app.innerHTML = loginPage();
    bindLoginEvents();
    return;
  }
  if (state.route === "onboarding") {
    app.innerHTML = onboardingPage();
    bindEvents();
    return;
  }
  const meta = routeMeta[state.route] || routeMeta.dashboard;
  const heading = meta === routeMeta.dashboard ? `Good morning, ${escapeHtml(userName().split(" ")[0])}` : meta[1];
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" href="#dashboard"><span class="brand-mark">◒</span><span>${BRAND}</span></a>
        <a class="user-chip ${state.route === "profile" ? "active" : ""}" href="#profile"><div class="avatar">${userInitials()}</div><div><strong>${escapeHtml(userName())}</strong><small>Profile & settings</small></div><span class="chevron">⌄</span></a>
        <nav aria-label="Main navigation">
          <p class="nav-label">Monitor</p>
          ${navItems.map(([id, icon, label]) => `<a class="nav-item ${state.route === id ? "active" : ""}" href="#${id}"><span class="nav-icon">${icon}</span>${label}</a>`).join("")}
        </nav>
        <div class="sidebar-footer"><div class="mini-device"><span class="status-dot"></span><div><strong>Prodrome One</strong><small id="device-status">${sidebarStatus()}</small></div><span>›</span></div></div>
      </aside>
      <main class="main">
        <header class="topbar"><div><h1>${heading}</h1></div><div class="top-actions"><span class="live-pill" id="live-pill">${livePillHtml()}</span><button class="icon-button" data-action="toggle-notifications" aria-label="Notifications" aria-expanded="${state.notificationsOpen}">♢${state.notifications.length ? `<b>${state.notifications.length}</b>` : ""}</button><a class="avatar" href="#profile" aria-label="Profile & settings">${userInitials()}</a></div></header>
        <div class="content">${pageContent()}</div>
      </main>
    </div>
    ${notificationCenter()}`;
  bindEvents();
}

function pageContent() {
  if (state.route === "onboarding") return onboardingPage();
  if (state.route === "profile") return profilePage();
  if (state.route === "insights") return insightsPage();
  if (state.route === "device") return devicePage();
  return dashboardPage();
}

function loginPage() {
  const userName = state.user?.name || state.user?.nickname;
  return `
    <main class="auth-page">
      <section class="auth-brand-panel" aria-label="Prodrome introduction">
        <a class="brand auth-brand" href="#login"><span class="brand-mark">◒</span><span>${BRAND}</span></a>
        <div class="auth-visual">
          <div class="auth-orbit orbit-one"></div>
          <div class="auth-orbit orbit-two"></div>
          <div class="auth-sun"><span>☀</span></div>
          <div class="auth-status-card">
            <span class="status-dot"></span>
            <div><strong>Space is in balance</strong><small>Air and light are aligned</small></div>
          </div>
        </div>
        <div class="auth-quote"><p class="eyebrow">${BRAND} quietly tracks the air and light in your room and helps you see what's behind headaches, brain fog, and bad sleep.</p><h1>Catch invisible air and light triggers before they catch you</h1></div>
      </section>
      <section class="auth-form-panel">
        <div class="auth-card">
          <h2>${userName ? `Welcome, ${escapeHtml(userName)}` : "Sign in to your space"}</h2>
          <p class="auth-lede">${state.demoMode ? "Explore the protected prototype without an account." : "Use Auth0 to securely access your personal environment, insights, and Prodrome One."}</p>
          <button class="auth-primary" type="button" data-auth-action="login">
            <span class="auth-button-mark">◒</span>
            <span>${state.authReady ? "Get started" : "Setting up sign in"}</span>
            <span aria-hidden="true">→</span>
          </button>
          ${state.authConfigured ? "" : `<p class="auth-config-note"><strong>Demo mode.</strong> Add your Auth0 domain and client ID in <code>index.html</code> to enable secure login.</p>`}
          <div class="auth-divider"><span>or</span></div>
          <button class="auth-demo" type="button" data-auth-action="demo">Explore the demo</button>
          <p class="auth-privacy">By continuing, you agree to Prodrome’s privacy and use policies.</p>
        </div>
      </section>
    </main>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function bindLoginEvents() {
  document.querySelectorAll("[data-auth-action]").forEach(button => {
    button.addEventListener("click", async () => {
      if (button.dataset.authAction === "demo") {
        state.demoMode = true;
        state.authenticated = true;
        state.user = { sub: "demo-user", name: "Alex Chen" };
        await routeAfterLogin();
        return;
      }
      if (!state.authConfigured || !state.auth) {
        showToast("Configure Auth0 in index.html, then refresh.");
        return;
      }
      await state.auth.loginWithRedirect({
        authorizationParams: {
          redirect_uri: `${window.location.origin}${window.location.pathname}`
        }
      });
    });
  });
}

// ---- Live data, history and the symptom modal (all of it comes from the backend) ----
const api = () => window.ProdromeBackend;
const currentUserId = () => state.user && state.user.sub;

function defaultLive() {
  return { loaded: false, error: false, device: null, series: null, insights: null, symptoms: [], busy: false, notifiedFor: null, copy: null, copyStatus: "fallback", copyKey: "", copyAt: 0, copyBusy: false };
}

function defaultHistory() {
  return {
    loaded: false, error: false, sessions: [], nextSessions: null, symptoms: [], nextSymptoms: null, insights: null,
    openSession: null, sessionDetail: null, openSymptom: null, symptomContext: null,
  };
}

const SYMPTOM_TILES = [["headache", "Headache", "◌"], ["eye_strain", "Eye strain", "☼"], ["brain_fog", "Brain fog", "≋"], ["fatigue", "Fatigue", "◒"], ["irritated_eyes", "Irritated eyes", "◉"], ["other", "Something else", "◉"]];
const symptomLabel = key => (SYMPTOM_TILES.find(([id]) => id === key) || [key, key])[1];
const symptomKeyFromLabel = label => (SYMPTOM_TILES.find(([, name]) => name === label) || [])[0];
const AIR_WORDS = { good: "Good", caution: "Caution", poor: "Poor" };
const LIGHT_WORDS = { dim: "Dim", good: "Good", harsh: "Bright" };
const tagClass = band => (band === "good" ? "good-tag" : "break-tag");

function severityWord(value) {
  if (value === null || value === undefined) return "no rating";
  return value <= 2 ? "mild" : value <= 5 ? "dull" : value <= 8 ? "intense" : "searing";
}

const formatTime = value => new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
const formatDay = value => new Date(value).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
const formatShortDay = value => new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

function timeAgo(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

// Air and light on one chart. Each line is scaled to its own range (air 0 to 1023, light 0 to 625) so both stay readable.
// The line breaks where the device was off, and `markers` are symptoms, `shade` highlights a stretch of time.
function trendChart({ points, from, to, markers = [], shade = null, labelDays = false }) {
  if (!points || !points.length) return `<p class="muted chart-empty">No readings for this period yet.</p>`;
  const width = 760;
  const height = 220;
  const times = points.map(point => new Date(point.time).getTime());
  const start = new Date(from || points[0].time).getTime();
  const end = Math.max(new Date(to || points[points.length - 1].time).getTime(), start + 1);
  const x = time => (((typeof time === "number" ? time : new Date(time).getTime()) - start) / (end - start)) * width;
  const y = (value, max) => height - 10 - (Math.min(value, max) / max) * (height - 20);
  const spacings = times.slice(1).map((time, index) => time - times[index]).sort((a, b) => a - b);
  const gapMs = (spacings[Math.floor(spacings.length / 2)] || 60000) * 3;
  const line = (key, max) => points.map((point, index) => `${index === 0 || times[index] - times[index - 1] > gapMs ? "M" : "L"}${x(times[index]).toFixed(1)} ${y(point[key], max).toFixed(1)}`).join("");
  const labels = [0, 1, 2, 3].map(index => {
    const time = new Date(start + ((end - start) * index) / 3);
    return labelDays ? time.toLocaleDateString([], { weekday: "short" }) : formatTime(time);
  });
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Air quality and lighting over time">
    <path class="grid-line" d="M0 55H${width}M0 110H${width}M0 165H${width}"/>
    ${shade ? `<rect class="shade" x="${x(shade.from).toFixed(1)}" y="0" width="${Math.max(2, x(shade.to) - x(shade.from)).toFixed(1)}" height="${height}"/>` : ""}
    <path class="light-line" d="${line("light", 625)}"/>
    <path class="air-line" d="${line("air", 1023)}"/>
    ${markers.map(marker => `<rect class="marker" x="${(x(marker.time) - 4).toFixed(1)}" y="${height - 9}" width="8" height="8"/>`).join("")}
  </svg><div class="x-labels">${labels.map(label => `<span>${label}</span>`).join("")}</div>`;
}

function dashboardPage() {
  const { loaded, error, device, series, insights } = state.live;
  const latest = device && device.latest;
  const online = Boolean(device && device.online);
  const displayAirPercent = latest ? airDisplayPercent(latest.air, device && device.thresholds) : null;
  const displayLightPercent = latest ? lightDisplayPercent(latest.light, device && device.thresholds) : null;
  const score = device && device.score !== null && device.score !== undefined ? device.score : null;
  const scoreWord = score === null ? "" : score >= 75 ? "Good" : score >= 50 ? "Caution" : "Poor";
  const scoreNote = score === null ? "Waiting for a reading" : score >= 75 ? "Your space feels balanced" : score >= 50 ? "A few things are drifting" : "Your space could use some attention";

  let headline = "Your space is supporting you.";
  let detail = "Air and light both look good right now.";
  if (!loaded) {
    [headline, detail] = ["Checking your space.", ""];
  } else if (error) {
    [headline, detail] = ["We can't reach the Prodrome backend.", "Start the backend and refresh the page."];
  } else if (!device) {
    [headline, detail] = ["Live data is switched off.", "The app isn't connected to the backend, so there's nothing to show yet."];
  } else if (!device.deviceId) {
    [headline, detail] = ["No device is paired yet.", "Once a Prodrome One is linked to your account, your readings will appear here."];
  } else if (!online) {
    headline = "Your device is offline.";
    detail = latest ? `Showing your last reading from ${timeAgo(latest.time)}. Turn on Prodrome One, then press Start working.` : "No readings yet. Turn on Prodrome One to get started.";
  } else if (displayAirPercent !== null && displayAirPercent >= 100) {
    [headline, detail] = ["The air could use a refresh.", "Opening a window might help when you get a chance."];
  } else if (displayLightPercent !== null && displayLightPercent >= 100) {
    [headline, detail] = ["Light is on the bright side.", "Some shade on the screen or window might help."];
  } else if (displayLightPercent !== null && displayLightPercent < 50) {
    [headline, detail] = ["Light is on the dim side.", "A little more light might be easier on your eyes."];
  } else if (displayAirPercent !== null && displayAirPercent >= 50) {
    [headline, detail] = ["The air is elevated.", "A little fresh air might help when you get a chance."];
  }
  if (device && device.session) detail += ` You've been working for ${formatDuration(device.session.durationSeconds)}.`;
  const working = Boolean(device && device.session);
  const canStart = Boolean(device && device.deviceId);
  const workButton = `<button class="outline-button" data-action="toggle-working" ${working || canStart ? "" : 'disabled title="Link a device to start working"'}>${working ? "Stop working" : "Start working"}</button>`;

  const airNote = !latest ? "No reading yet" : latest.airBand === "good" ? "Comfortable for focus" : latest.airBand === "caution" ? "Getting a little stale" : "Stale, fresh air might help";
  const lightNote = !latest ? "No reading yet" : latest.lightBand === "good" ? "Comfortable for focus" : latest.lightBand === "dim" ? "On the dim side" : "On the bright side";
  const bars = (key, max) => ((series && series.points) || []).slice(-9).map(point => `<i style="--n:${Math.min(7, Math.max(1, Math.round((point[key] / max) * 7)))}"></i>`).join("");
  const suggestion = currentSuggestion();
  const hour = new Date().getHours();
  const daypart = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";

  const airDisplayNoteText = airDisplayNote(displayAirPercent);
  const lightDisplayNoteText = lightDisplayNote(displayLightPercent);

  return `
    ${profileBanner()}
    <section class="hero-row"><div><h2>${headline}</h2><p class="muted">${detail}</p></div><div class="hero-actions">${workButton}<button class="outline-button" data-action="log-symptom">+ Symptom</button></div></section>
    <section class="symptom-section" id="symptom-log" aria-labelledby="symptom-heading">
      <div class="symptom-heading"><div><h3 id="symptom-heading">Log a symptom</h3></div><p>Tap what you notice. Prodrome will look for patterns.</p></div>
      <div class="symptom-buttons">
        ${SYMPTOM_TILES.map(([, label, glyph]) => `<button type="button" class="symptom-button" data-symptom="${label}"><span>${glyph}</span>${label}</button>`).join("")}
      </div>
    </section>
    <section class="score-card">
      <div class="score-copy"><div class="score-line"><strong>${score === null ? "—" : score}</strong><span>/ 100</span><span class="good-tag">${scoreWord}</span></div><p>${scoreNote}</p><div class="score-track"><span style="width:${score || 0}%"></span><div class="scale"><span>Needs attention</span><span>Optimal</span></div></div>
      <div class="orb"><div class="orb-inner"><span>☀</span><small>${daypart}<br/>focus</small></div></div>
      <div class="score-meta"><div><span>Last updated</span><strong>${latest ? timeAgo(latest.time) : "—"}</strong></div><div><span>Profile confidence</span><strong>${insights ? `${insights.confidence}%` : "—"} <a href="#insights">View insights →</a></strong></div></div>
    </section>
    <section class="section-head"><div><h3>Environmental snapshot</h3></div><span class="sync-text"><span class="status-dot"></span> ${online ? "Synced from Prodrome One" : "Prodrome One is offline"}</span></section>
    <section class="metric-grid">
      <article class="metric-card air-card ${airStatusClass(displayAirPercent)}"><div class="metric-header"><div class="metric-icon">≋</div><span class="${tagClass(latest && latest.airBand)}">${airDisplayLabel(displayAirPercent)}</span></div><p class="metric-label">Air quality</p><div class="metric-value"><strong>${displayAirPercent === null ? "—" : `${displayAirPercent}%`}</strong><span>of your air quality limit</span></div><p class="metric-note">${airDisplayNoteText}</p><div class="sparkline air-spark">${bars("air", 1023)}</div></article>
      <article class="metric-card light-card ${lightStatusClass(displayLightPercent)}"><div class="metric-header"><div class="metric-icon">☼</div><span class="${tagClass(latest && latest.lightBand)}">${lightDisplayLabel(displayLightPercent)}</span></div><p class="metric-label">Lighting</p><div class="metric-value"><strong>${displayLightPercent === null ? "—" : `${displayLightPercent}%`}</strong><span>of your light limit</span></div><p class="metric-note">${lightDisplayNoteText}</p><div class="sparkline light-spark">${bars("light", 625)}</div></article>
    </section>
    <section class="section-head chart-head"><div><h3>How your space has felt</h3></div><div class="range-tabs">${["15m", "6h", "24h", "7d"].map(range => `<button class="${state.selectedRange === range ? "selected" : ""}" data-range="${range}">${range}</button>`).join("")}</div></section>
    <section class="chart-card"><div class="chart-legend"><span><i class="legend-air"></i> Air quality</span><span><i class="legend-light"></i> Lighting</span></div><div class="chart">${trendChart({ points: series && series.points, from: series && series.from, to: series && series.to, labelDays: state.selectedRange === "7d" })}</div></section>
    ${latest ? `<aside class="intervention" data-source="${suggestion.source}"><div class="intervention-icon">✦</div><div><h3>${escapeHtml(suggestion.intervention)}</h3><p>${escapeHtml(suggestion.detail)}</p></div><button class="close-intervention" data-action="dismiss">×</button></aside>` : ""}`;
}

// Redraws the page body in place (used when new data arrives) without rebuilding the sidebar or losing open dialogs.
function repaint() {
  const content = document.querySelector(".content");
  if (content && ["dashboard", "insights", "device"].includes(state.route)) content.innerHTML = pageContent();
  paintStatus();
}

const sidebarStatus = () => {
  const { loaded, device } = state.live;
  if (!loaded) return "Checking device";
  if (!device || !device.deviceId) return "Not connected";
  return device.online ? "Online, synced now" : device.latest ? `Offline, seen ${timeAgo(device.latest.time)}` : "Offline";
};
const livePillHtml = () => `<span class="status-dot"></span> ${state.live.device && state.live.device.online ? "Live" : "Offline"}`;

function paintStatus() {
  const status = document.querySelector("#device-status");
  if (status) status.textContent = sidebarStatus();
  const pill = document.querySelector("#live-pill");
  if (pill) pill.innerHTML = livePillHtml();
  renderCheckin();
}

const liveSignature = () => {
  const device = state.live.device;
  const session = device && device.session;
  return JSON.stringify([state.live.error, device && device.online, device && device.latest && device.latest.time, session && session.id, session && session.checkInDueAt, session ? Math.floor(Date.now() / 60000) : null]);
};

async function loadDashboard({ forceSuggestion = false } = {}) {
  if (!state.user) return;
  const before = liveSignature();
  try {
    const id = currentUserId();
    const [device, series, insights, symptoms] = await Promise.all([api().getDevice(id), api().getReadings(id, state.selectedRange), api().getInsights(id), api().getSymptoms(id, { limit: 5 })]);
    applyDevice(device);
    Object.assign(state.live, { loaded: true, error: false, series, insights, symptoms: symptoms ? symptoms.symptoms : [] });
  } catch (error) {
    console.error("Loading live data failed:", error);
    Object.assign(state.live, { loaded: true, error: true });
  }
  repaint();
  if (liveSignature() !== before && state.route === "dashboard") refreshSuggestion();
}

// Every place that receives the device status goes through here, so a session that ended by itself is noticed.
function applyDevice(device) {
  const before = state.live.device && state.live.device.session;
  state.live.device = device;
  if (before && !(device && device.session) && !state.live.busy) {
    showToast("Your session ended automatically because there was no answer. Your data was saved.");
    state.history.loaded = false;
  }
}

async function loadDevice() {
  if (!state.user) return;
  try {
    applyDevice(await api().getDevice(currentUserId()));
    Object.assign(state.live, { loaded: true, error: false });
  } catch (error) {
    console.error("Loading device status failed:", error);
    Object.assign(state.live, { loaded: true, error: true });
  }
  repaint();
}

// Runs every few seconds on every signed-in page, so the "still working?" popup can appear anywhere.
// The page body is only redrawn on the dashboard and Device page, and only when something changed.
async function refreshLive({ force = false } = {}) {
  if (!state.authenticated || !state.user || state.needsSurvey || ["login", "onboarding"].includes(state.route)) return;
  if (!force && !state.live.loaded && ["dashboard", "device"].includes(state.route)) return; // the first load is still running
  const before = liveSignature();
  try {
    applyDevice(await api().getDevice(currentUserId()));
    state.live.error = false;
    if (state.route === "dashboard" && liveSignature() !== before) state.live.series = await api().getReadings(currentUserId(), state.selectedRange);
  } catch (error) {
    state.live.error = true;
  }
  if (liveSignature() !== before && ["dashboard", "device"].includes(state.route)) repaint();
  else paintStatus();
  if (liveSignature() !== before && state.route === "dashboard") refreshSuggestion();
}

// ---- Working session: Start/Stop, and the hourly "still working?" check-in ----
async function toggleWorking() {
  const live = state.live;
  if (live.busy || !live.device || !live.device.deviceId) return;
  live.busy = true;
  try {
    if (live.device.session) {
      await api().stopSession(currentUserId());
      showToast("Session saved.");
    } else {
      await api().startSession(currentUserId());
      requestNotificationPermission();
    }
    state.history.loaded = false;
  } catch (error) {
    showToast(error.message || "Something went wrong.");
  }
  try {
    applyDevice(await api().getDevice(currentUserId()));
  } catch (error) {
    console.error("Refreshing device status failed:", error);
  }
  live.busy = false;
  repaint();
  refreshSuggestion({ force: true });
}

async function confirmWorking() {
  const live = state.live;
  if (live.busy) return;
  live.busy = true;
  try {
    await api().confirmActive(currentUserId());
  } catch (error) {
    showToast(error.message || "Could not reach the backend.");
  }
  try {
    applyDevice(await api().getDevice(currentUserId()));
  } catch (error) {
    console.error("Refreshing device status failed:", error);
  }
  live.busy = false;
  repaint();
}

const formatClock = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
let lastDeadlineLook = 0;

// Seconds left to answer, or null when no check-in is due.
function checkinSecondsLeft() {
  const session = state.live.device && state.live.device.session;
  if (!session || Date.now() < new Date(session.checkInDueAt).getTime()) return null;
  return Math.max(0, Math.ceil((new Date(session.autoEndsAt).getTime() - Date.now()) / 1000));
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
}

// A small card in the corner, drawn from the server's timestamps, so it survives page changes and reloads.
function renderCheckin() {
  const region = document.querySelector("#checkin-region");
  if (!region) return;
  const secondsLeft = checkinSecondsLeft();
  if (secondsLeft === null) {
    if (region.firstElementChild) region.innerHTML = "";
    return;
  }
  if (!region.firstElementChild) {
    region.innerHTML = `<aside class="checkin" role="alertdialog" aria-labelledby="checkin-title"><h3 id="checkin-title">Still working?</h3><p>Your session ends automatically in <b id="checkin-countdown"></b> if we don't hear back.</p><div class="checkin-actions"><button type="button" class="primary-button" data-action="confirm-working">Still working</button><button type="button" class="skip-button" data-action="end-working">End session</button></div></aside>`;
  }
  region.querySelector("#checkin-countdown").textContent = formatClock(secondsLeft);

  const session = state.live.device.session;
  if (state.live.notifiedFor !== session.checkInDueAt) {
    state.live.notifiedFor = session.checkInDueAt;
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification("Still working?", { body: "Your session ends automatically in a few minutes if there is no answer." });
    }
  }
  // The server ends the session within seconds of the deadline, so look more often once time is up.
  if (secondsLeft === 0 && Date.now() - lastDeadlineLook > 3000) {
    lastDeadlineLook = Date.now();
    refreshLive({ force: true });
  }
}

async function loadInsights() {
  if (!state.user) return;
  const history = state.history;
  try {
    const id = currentUserId();
    const [sessions, symptoms, insights] = await Promise.all([api().getSessions(id, { limit: 20 }), api().getSymptoms(id, { limit: 30 }), api().getInsights(id)]);
    Object.assign(history, {
      loaded: true, error: false, insights,
      sessions: sessions ? sessions.sessions : [], nextSessions: sessions ? sessions.nextBefore : null,
      symptoms: symptoms ? symptoms.symptoms : [], nextSymptoms: symptoms ? symptoms.nextBefore : null,
      openSession: null, sessionDetail: null, openSymptom: null, symptomContext: null,
    });
  } catch (error) {
    console.error("Loading history failed:", error);
    Object.assign(history, { loaded: true, error: true });
  }
  repaint();
}

function loadRouteData() {
  if (!state.authenticated || state.needsSurvey || !state.user) return;
  if (state.route === "dashboard") loadDashboard();
  if (state.route === "insights") loadInsights();
  if (state.route === "device") loadDevice();
}

async function changeRange(range) {
  state.selectedRange = range;
  repaint();
  try {
    state.live.series = await api().getReadings(currentUserId(), range);
    repaint();
  } catch (error) {
    console.error("Loading chart failed:", error);
  }
}

async function toggleSession(id) {
  const history = state.history;
  // Closing or switching sessions also closes a symptom that was opened inside one.
  if (history.openSymptom && history.openSymptom.scope === "session") Object.assign(history, { openSymptom: null, symptomContext: null });
  if (history.openSession === id) {
    Object.assign(history, { openSession: null, sessionDetail: null });
    return repaint();
  }
  Object.assign(history, { openSession: id, sessionDetail: null });
  repaint();
  try {
    const detail = await api().getSession(currentUserId(), id);
    if (history.openSession === id) {
      history.sessionDetail = detail;
      repaint();
    }
  } catch (error) {
    console.error("Loading session failed:", error);
    showToast("Could not load that session.");
  }
}

// A symptom can appear in an open session and in the log, so remember which list it was opened from.
async function toggleSymptom(id, scope) {
  const history = state.history;
  const isOpen = candidate => history.openSymptom && history.openSymptom.id === candidate && history.openSymptom.scope === scope;
  if (isOpen(id)) {
    Object.assign(history, { openSymptom: null, symptomContext: null });
    return repaint();
  }
  Object.assign(history, { openSymptom: { id, scope }, symptomContext: null });
  repaint();
  try {
    const context = await api().getSymptomContext(currentUserId(), id);
    if (isOpen(id)) {
      history.symptomContext = context;
      repaint();
    }
  } catch (error) {
    console.error("Loading symptom context failed:", error);
    showToast("Could not load that symptom.");
  }
}

async function loadMore(kind) {
  const history = state.history;
  try {
    if (kind === "sessions") {
      const page = await api().getSessions(currentUserId(), { limit: 20, before: history.nextSessions });
      history.sessions.push(...page.sessions);
      history.nextSessions = page.nextBefore;
    } else {
      const page = await api().getSymptoms(currentUserId(), { limit: 30, before: history.nextSymptoms });
      history.symptoms.push(...page.symptoms);
      history.nextSymptoms = page.nextBefore;
    }
    repaint();
  } catch (error) {
    console.error("Loading more failed:", error);
    showToast("Could not load more.");
  }
}

// ---- Suggestions from Gemini. A de-identified summary goes to the website server's proxy (which holds the API key);
// if Gemini is off, slow or fails, a built-in suggestion is shown instead. ----
const GEMINI_MIN_GAP_MS = 60 * 1000;
const GEMINI_TIMEOUT_MS = 12 * 1000;
const GEMINI_INSTRUCTIONS = "Write only short, general wellbeing interventions. Do not diagnose, infer identity, or claim medical causation.";
const GEMINI_AIR = { good: "low", caution: "moderate", poor: "bad" };
const GEMINI_LIGHT = { dim: "dim", good: "moderate", harsh: "harsh" };
const GEMINI_DEVICE = { model: "Prodrome One", adcResolutionBits: 10, adcMaximum: 1023, sensors: { air: "Grove Air Quality Sensor v1.3 (qualitative analog)", light: "Grove Light Sensor (analog)" } };
const capitalize = word => word.charAt(0).toUpperCase() + word.slice(1);

// Only symptom names, severity bands, environment bands and thresholds. No name, id, time stamps or raw logs.
function buildGeminiContext() {
  const { device, insights, symptoms } = state.live;
  const latest = device && device.latest;
  const pattern = insights && insights.patterns && insights.patterns[0];
  const hour = new Date().getHours();
  const sensitivities = state.saved.environment ? state.survey.environment.sensitivities : null;
  return {
    symptoms: (symptoms || []).slice(0, 5).map(log => ({ symptom: symptomLabel(log.symptom), severityBand: log.severity === null ? "moderate" : log.severity <= 4 ? "mild" : log.severity <= 8 ? "moderate" : "high" })),
    environment: {
      airBand: latest ? GEMINI_AIR[latest.airBand] : "unknown",
      lightBand: latest ? GEMINI_LIGHT[latest.lightBand] : "unknown",
      timeOfDayBand: hour >= 20 ? "wind-down" : hour < 6 ? "night" : "daytime",
    },
    learningProfile: {
      sensitivitySurveyCompleted: state.saved.environment,
      sensitivities: sensitivities && { brightLight: capitalize(sensitivities.light), dimLight: capitalize(sensitivities.dim), stuffyAir: capitalize(sensitivities.air), odors: capitalize(sensitivities.voc) },
      deviceSpecs: GEMINI_DEVICE,
      thresholds: device && device.thresholds,
    },
    // Whether a work session is running and roughly how long, rounded to 15 minutes so the summary does not change every minute.
    workSession: device && device.session ? { active: true, minutesWorking: Math.round(device.session.durationSeconds / 60 / 15) * 15 } : { active: false },
    correlation: pattern ? {
      label: pattern.title,
      lookbackMinutes: 30,
      minimumLogCount: insights.minimumLogs,
      confidenceBand: pattern.strength === "strong" ? (pattern.rate >= 80 ? "high" : "medium") : "low",
    } : null,
  };
}

// The built-in suggestion: what the readings say now, else the strongest pattern found, else a nudge to keep logging.
function fallbackCopy() {
  const { device, insights } = state.live;
  const latest = device && device.latest;
  const top = insights && insights.patterns && insights.patterns[0];
  if (latest && latest.airBand !== "good") {
    return { intervention: "Fresh air might help", detail: "The air has gotten a bit stale. Opening a window could help when you get a chance.", notification: "Some fresh air might help when you get a chance." };
  }
  if (latest && latest.lightBand === "harsh") {
    return { intervention: "Reduce glare and soften the light", detail: "Light is on the bright side. Some shade on the screen or window might help.", notification: "Lighting is bright; reducing glare or a short visual break might help." };
  }
  if (latest && latest.lightBand === "dim") {
    return { intervention: "A little more light might help", detail: "Light is on the dim side, which can be harder on your eyes.", notification: "Light is on the dim side; a lamp might be easier on your eyes." };
  }
  if (top && top.trigger === "air") {
    return { intervention: "Keep an eye on the air", detail: "Stale air has appeared around some logged symptoms, so a fresh-air break might be worth it.", notification: "Air has been linked to some of your symptoms; a window break might help." };
  }
  if (top && top.trigger === "harsh_light") {
    return { intervention: "Watch the glare", detail: "Bright light has appeared around some logged symptoms.", notification: "Bright light has been linked to some of your symptoms; some shade might help." };
  }
  if (top && top.trigger === "long_session") {
    return { intervention: "A short break might help", detail: "Long stretches without a break have appeared around some logged symptoms.", notification: "It might be a good moment for a short break." };
  }
  if (latest) {
    return { intervention: "A great time for deep work", detail: "Light is steady and the air is fresh, so this might be a good focus window.", notification: "Great focus window: light and air are aligned right now." };
  }
  return { intervention: "Keep logging symptoms", detail: "A few more logs will help Prodrome find patterns.", notification: "No pattern yet. Keep your symptom log up to date." };
}

// What the card shows: Gemini's text while it still matches the situation, otherwise the built-in suggestion.
function currentSuggestion() {
  const live = state.live;
  if (live.copyStatus === "generated" && live.copy && live.copyKey === JSON.stringify(buildGeminiContext())) return { ...live.copy, source: "gemini" };
  return { ...fallbackCopy(), source: "local" };
}

function applySuggestionToNotifications() {
  const suggestion = currentSuggestion();
  if (state.notifications[1] && suggestion.intervention) {
    state.notifications[1].title = suggestion.intervention;
    state.notifications[1].message = suggestion.notification;
  }
}

// Asks Gemini for fresh wording. Skipped while a request is running, when nothing changed, or within a minute of the last
// request (unless forced after something the user did). Never throws: any failure leaves the built-in suggestion in place.
async function refreshSuggestion({ force = false } = {}) {
  const live = state.live;
  applySuggestionToNotifications();
  if (!live.device || !live.device.latest) return;
  const config = window.PRODROME_GEMINI_CONFIG || {};
  if (!config.enabled || !config.endpoint) return;
  let endpoint;
  try {
    endpoint = new URL(config.endpoint, window.location.href);
  } catch (error) {
    return;
  }
  if (endpoint.origin !== window.location.origin) {
    console.warn("Gemini proxy blocked: only same-origin endpoints are allowed.");
    return;
  }
  const context = buildGeminiContext();
  const key = JSON.stringify(context);
  if (live.copyBusy || (live.copyStatus === "generated" && live.copyKey === key)) return;
  if (!force && Date.now() - live.copyAt < GEMINI_MIN_GAP_MS) return;

  live.copyBusy = true;
  live.copyAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context, instructions: GEMINI_INSTRUCTIONS }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Gemini proxy returned ${response.status}`);
    const copy = await response.json();
    if (typeof copy.intervention === "string" && typeof copy.detail === "string" && typeof copy.notification === "string") {
      Object.assign(live, { copy, copyKey: key, copyStatus: "generated" });
    } else {
      live.copyStatus = "fallback";
    }
  } catch (error) {
    console.warn("Gemini suggestion unavailable; using the built-in one.", error.message);
    live.copyStatus = "fallback";
  } finally {
    clearTimeout(timeoutId);
    live.copyBusy = false;
  }
  applySuggestionToNotifications();
  if (state.route === "dashboard") repaint();
}

// ---- Symptom logging dialog: pick a symptom, rate it from 1 to 10, add an optional note ----
function openSymptomModal(symptom = null) {
  state.symptomModal = { step: symptom ? 2 : 1, symptom, severity: 5, note: "", saving: false };
  renderSymptomModal();
}

function closeSymptomModal() {
  state.symptomModal = null;
  renderSymptomModal();
}

function renderSymptomModal() {
  const region = document.querySelector("#modal-region");
  const modal = state.symptomModal;
  if (!modal) {
    region.innerHTML = "";
    return;
  }
  const question = modal.step === 1 ? "What symptom are you experiencing?"
    : modal.step === 2 ? `On a scale of 1 to 10, how ${modal.symptom === "headache" ? "painful" : "strong"} does it feel?`
    : "Anything else?";
  const body = modal.step === 1
    ? `<div class="symptom-buttons modal-tiles">${SYMPTOM_TILES.map(([, label, glyph]) => `<button type="button" class="symptom-button" data-symptom="${label}" data-modal="pick"><span>${glyph}</span>${label}</button>`).join("")}</div>`
    : modal.step === 2
      ? `<div class="severity"><input type="range" id="severity" min="1" max="10" step="1" value="${modal.severity === null ? 5 : modal.severity}" aria-label="Severity from 1 to 10" /><div class="severity-anchors"><span>Mild</span><span>Dull</span><span>Intense</span><span>Searing</span></div><p class="severity-readout" id="severity-readout">${modal.severity === null ? 5 : modal.severity} of 10, ${severityWord(modal.severity === null ? 5 : modal.severity)}</p></div>`
      : `<textarea id="symptom-note" rows="4" maxlength="500" placeholder="Optional note">${escapeHtml(modal.note)}</textarea>`;
  const actions = modal.step === 1 ? "" : `<div class="modal-actions"><button type="button" class="skip-button" data-modal="skip" ${modal.saving ? "disabled" : ""}>Skip</button><button type="button" class="primary-button" data-modal="next" ${modal.saving ? "disabled" : ""}>${modal.step === 3 ? "Finish" : "Next →"}</button></div>`;
  region.innerHTML = `<div class="modal-backdrop" data-modal="backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">Log a symptom</h2><button type="button" class="modal-close" data-modal="close" aria-label="Close"></button></div><div class="onboarding-progress" aria-hidden="true">${[1, 2, 3].map(step => `<span class="${step <= modal.step ? "filled" : ""}"></span>`).join("")}</div><h3 class="modal-question">${question}</h3>${body}${actions}</div></div>`;
  const focusTarget = region.querySelector("textarea, input, .modal-tiles button, [data-modal='next']");
  if (focusTarget) focusTarget.focus();
}

function handleModalClick(element, event) {
  const modal = state.symptomModal;
  const action = element.dataset.modal;
  if (action === "backdrop") {
    if (event.target === element) closeSymptomModal();
    return;
  }
  if (action === "close") return closeSymptomModal();
  if (!modal || modal.saving) return;
  if (action === "pick") {
    modal.symptom = symptomKeyFromLabel(element.dataset.symptom);
    modal.step = 2;
    return renderSymptomModal();
  }
  // Skipping a step leaves that answer empty but still logs the symptom.
  if (action === "skip") {
    if (modal.step === 2) modal.severity = null;
    else modal.note = "";
  }
  if (modal.step === 2) {
    modal.step = 3;
    return renderSymptomModal();
  }
  return submitSymptom();
}

async function submitSymptom() {
  const modal = state.symptomModal;
  modal.saving = true;
  renderSymptomModal();
  try {
    const saved = await api().logSymptom(currentUserId(), { symptom: modal.symptom, severity: modal.severity, note: modal.note.trim() || null });
    closeSymptomModal();
    showToast(saved ? "Logged. We'll look at the 30 minutes before it." : "Not saved: the backend is switched off.");
    state.history.loaded = false;
    if (state.route === "insights") loadInsights();
    if (state.route === "dashboard") loadDashboard({ forceSuggestion: true });
  } catch (error) {
    console.error("Saving symptom failed:", error);
    modal.saving = false;
    renderSymptomModal();
    showToast("Could not save that symptom. Please try again.");
  }
}

// Demo mode loads the seeded demo profile and live history, while profile writes stay local.
const demoBackend = {
  getUser: () => window.ProdromeBackend.getUser("demo-user"),
  registerUser: async () => {},
  updateUser: async () => {},
};
const backend = () => (state.demoMode ? demoBackend : window.ProdromeBackend);

// One click listener for the whole page, so buttons keep working when a section is redrawn.
document.addEventListener("click", event => {
  const element = event.target.closest("[data-action], [data-range], [data-symptom], [data-session], [data-log], [data-modal], [data-dismiss-notification]");
  if (!element) return;
  const data = element.dataset;
  if (data.modal !== undefined) return handleModalClick(element, event);
  if (data.range) return changeRange(data.range);
  if (data.symptom) return openSymptomModal(symptomKeyFromLabel(data.symptom));
  if (data.session) return toggleSession(data.session);
  if (data.log) return toggleSymptom(data.log, data.scope);
  if (data.dismissNotification !== undefined) {
    state.notifications.splice(Number(data.dismissNotification), 1);
    return render();
  }
  switch (data.action) {
    case "log-symptom": openSymptomModal(); break;
    case "toggle-notifications": state.notificationsOpen = !state.notificationsOpen; render(); break;
    case "dismiss-all": state.notifications = []; render(); break;
    case "test-pattern": showToast("Test pattern sent to Prodrome One."); break;
    case "dismiss": element.closest(".toast, .intervention")?.remove(); break;
    case "skip-section": advanceSurvey(false); break;
    case "toggle-working": toggleWorking(); break;
    case "confirm-working": confirmWorking(); break;
    case "end-working": toggleWorking(); break;
    case "sign-out": signOut(); break;
    case "more-sessions": loadMore("sessions"); break;
    case "more-symptoms": loadMore("symptoms"); break;
  }
});

document.addEventListener("input", event => {
  const modal = state.symptomModal;
  if (!modal) return;
  if (event.target.id === "severity") {
    modal.severity = Number(event.target.value);
    document.querySelector("#severity-readout").textContent = `${modal.severity} of 10, ${severityWord(modal.severity)}`;
  }
  if (event.target.id === "symptom-note") modal.note = event.target.value;
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && state.symptomModal) closeSymptomModal();
});

const SYMPTOM_FOCUS = ["Migraine / Headache", "Eye Strain", "Brain Fog", "Poor Sleep"];
const SENSITIVITIES = [
  ["light", "Bright or harsh light", "Glare, screens, or direct sun", "☼"],
  ["dim", "Dim or flickering rooms", "Low light or inconsistent lighting", "◐"],
  ["air", "Stuffy air", "Feeling foggy in poorly ventilated spaces", "≋"],
  ["voc", "Strong odors / VOCs", "Perfume, cleaning products, or chemicals", "✧"],
];
const SCHEDULE_FIELDS = [["workStart", "Work start time"], ["workEnd", "Work end time"], ["windDown", "Evening wind-down time"]];

// Optional fields: select values are "" for "prefer not to say", number fields store a number or null.
const SEX_OPTIONS = [["", "Prefer not to say"], ["female", "Female"], ["male", "Male"], ["other", "Other"]];
const YES_NO_OPTIONS = [["", "Prefer not to say"], ["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]];
const HEADACHE_DAY_OPTIONS = [["", "Prefer not to say"], ["0-3", "0–3 days"], ["4-7", "4–7 days"], ["8-14", "8–14 days"], ["15+", "15+ days"]];
const CAFFEINE_OPTIONS = [["", "Prefer not to say"], ["none", "None"], ["1-2", "1–2 cups"], ["3-4", "3–4 cups"], ["5+", "5+ cups"]];
const HORMONAL_FACTORS = ["Menstrual cycle changes", "Pregnancy", "Hormonal contraceptives", "Menopause"];
const HEALTH_NUMBERS = [["sleepHours", "Typical sleep (hours per night)", 0, 24, 0.5], ["screenTime", "Daily screen time (hours)", 0, 24, 0.5]];

const ICONS = {
  person: `<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>`,
  heart: `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`,
  leaf: `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>`,
  gear: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
};
const icon = name => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// The survey is three independent sections. A section only exists in the saved profile once the user saves it.
const SECTION_ORDER = ["about", "health", "environment"];
const TOTAL_STEPS = SECTION_ORDER.length;
const SECTIONS = {
  about: { title: "About you", heading: "Tell us about you", short: "personal details", icon: "person", fields: aboutFields, note: "Only your name is required. The rest is optional and helps Prodrome spot what might affect you. Your answers are stored with your account." },
  health: { title: "Health background", heading: "Your health background", short: "health background", icon: "heart", fields: healthFields, note: "" },
  environment: { title: "Environment factors", heading: "Your environment", short: "environment factors", icon: "leaf", fields: environmentFields, note: "" },
};

function defaultSurvey() {
  return {
    about: { name: { first: "", last: "" }, profile: { age: null, height: null, weight: null, sex: "" } },
    health: { familyHistory: "", headacheDays: "", sleepHours: null, screenTime: null, caffeine: "", hormonal: [], symptoms: [] },
    environment: {
      sensitivities: { light: "medium", dim: "medium", air: "medium", voc: "medium" },
      schedule: { workStart: "09:00", workEnd: "17:00", windDown: "21:00" },
    },
  };
}

function defaultSaved() {
  return { about: false, health: false, environment: false };
}

function defaultSettings() {
  return { theme: "light", thresholdMode: "auto", ledAlerts: true, units: { height: "cm", weight: "kg" } };
}

function selectRow(name, label, options, value) {
  return `<label>${label}<select name="${name}">${options.map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${value === optionValue ? "selected" : ""}>${optionLabel}</option>`).join("")}</select></label>`;
}

function numberRow(name, label, min, max, value, step = 1) {
  return `<label>${label}<input type="number" name="${name}" min="${min}" max="${max}" step="${step}" value="${value ?? ""}" /></label>`;
}

// A row with a cm/ft or kg/lb toggle. Values are always stored in cm and kg; the inputs show the chosen unit.
function unitRow(label, field, units, inputs) {
  const current = state.settings.units[field];
  return `<div class="row"><span>${label}</span><span class="unit-input">${inputs}<span class="unit-toggle" role="group" aria-label="${label} unit">${units.map(unit => `<button type="button" class="${unit === current ? "selected" : ""}" data-unit="${field}:${unit}">${unit}</button>`).join("")}</span></span></div>`;
}

function heightRow() {
  const cm = state.survey.about.profile.height;
  let inputs;
  if (state.settings.units.height === "ft") {
    const totalInches = cm === null ? null : Math.round(cm / 2.54);
    const feet = totalInches === null ? "" : Math.floor(totalInches / 12);
    const inches = totalInches === null ? "" : totalInches % 12;
    inputs = `<input type="number" name="height-ft" min="0" max="8" step="1" value="${feet}" data-initial="${feet}" aria-label="Feet" />ft<input type="number" name="height-in" min="0" max="11" step="1" value="${inches}" data-initial="${inches}" aria-label="Inches" />in`;
  } else {
    inputs = `<input type="number" name="profile-height" min="50" max="250" step="any" value="${cm ?? ""}" aria-label="Height in centimetres" />`;
  }
  return unitRow("Height", "height", ["cm", "ft"], inputs);
}

function weightRow() {
  const kg = state.survey.about.profile.weight;
  let inputs;
  if (state.settings.units.weight === "lb") {
    const pounds = kg === null ? "" : Math.round(kg * 2.20462 * 10) / 10;
    inputs = `<input type="number" name="weight-lb" min="40" max="660" step="any" value="${pounds}" data-initial="${pounds}" aria-label="Weight in pounds" />`;
  } else {
    inputs = `<input type="number" name="profile-weight" min="20" max="300" step="any" value="${kg ?? ""}" aria-label="Weight in kilograms" />`;
  }
  return unitRow("Weight", "weight", ["kg", "lb"], inputs);
}

function aboutFields() {
  const { name, profile } = state.survey.about;
  return `<div class="form-rows">
    <label>First name *<input type="text" name="firstName" value="${escapeHtml(name.first)}" autocomplete="given-name" required /></label>
    <label>Last name *<input type="text" name="lastName" value="${escapeHtml(name.last)}" autocomplete="family-name" required /></label>
    ${numberRow("profile-age", "Age (years)", 1, 120, profile.age)}
    ${heightRow()}
    ${weightRow()}
    ${selectRow("profile-sex", "Sex", SEX_OPTIONS, profile.sex)}
  </div>`;
}

function healthFields() {
  const health = state.survey.health;
  return `<div class="form-rows">
    ${selectRow("health-familyHistory", "Family history of migraine", YES_NO_OPTIONS, health.familyHistory)}
    ${selectRow("health-headacheDays", "Headache days per month", HEADACHE_DAY_OPTIONS, health.headacheDays)}
    ${HEALTH_NUMBERS.map(([key, label, min, max, step]) => numberRow(`health-${key}`, label, min, max, health[key], step)).join("")}
    ${selectRow("health-caffeine", "Caffeine (cups per day)", CAFFEINE_OPTIONS, health.caffeine)}
  </div>
  <h4>Hormonal factors</h4>
  <div class="symptom-cards">${HORMONAL_FACTORS.map(label => `<label><input type="checkbox" name="hormonal" value="${label}" ${health.hormonal.includes(label) ? "checked" : ""} /> ${label}</label>`).join("")}</div>
  <h4>Symptom focus</h4>${symptomFields()}`;
}

function environmentFields() {
  return `<h4>Environmental sensitivities</h4>${sensitivityFields()}<h4>Workplace routine</h4>${scheduleFields()}`;
}

function symptomFields() {
  return `<div class="symptom-cards">${SYMPTOM_FOCUS.map(label => `<label><input type="checkbox" name="symptoms" value="${label}" ${state.survey.health.symptoms.includes(label) ? "checked" : ""} /> ${label}</label>`).join("")}</div>`;
}

function sensitivityFields() {
  const { sensitivities } = state.survey.environment;
  return `<div class="sensitivity-list">${SENSITIVITIES.map(([key, label, hint, icon]) => `<div class="sensitivity-row"><div class="sense-icon">${icon}</div><div><strong>${label}</strong><small>${hint}</small></div><select name="sens-${key}" aria-label="${label}">${["low", "medium", "high"].map(level => `<option value="${level}" ${sensitivities[key] === level ? "selected" : ""}>${level[0].toUpperCase() + level.slice(1)}</option>`).join("")}</select></div>`).join("")}</div>`;
}

function scheduleFields() {
  const { schedule } = state.survey.environment;
  return `<div class="form-rows">${SCHEDULE_FIELDS.map(([key, label]) => `<label>${label}<input type="time" name="${key}" value="${schedule[key]}" /></label>`).join("")}</div>`;
}

const toNumber = value => (value === "" || value === null ? null : Number(value));

// Unchanged inputs keep the stored cm/kg value, so toggling units and saving doesn't introduce rounding drift.
function readHeight(form) {
  if (state.settings.units.height === "cm") return toNumber(form.elements["profile-height"].value);
  const feet = form.elements["height-ft"];
  const inches = form.elements["height-in"];
  if (feet.value === feet.dataset.initial && inches.value === inches.dataset.initial) return state.survey.about.profile.height;
  if (feet.value === "" && inches.value === "") return null;
  return Math.round((Number(feet.value || 0) * 12 + Number(inches.value || 0)) * 2.54 * 10) / 10;
}

function readWeight(form) {
  if (state.settings.units.weight === "kg") return toNumber(form.elements["profile-weight"].value);
  const pounds = form.elements["weight-lb"];
  if (pounds.value === pounds.dataset.initial) return state.survey.about.profile.weight;
  return pounds.value === "" ? null : Math.round((Number(pounds.value) / 2.20462) * 10) / 10;
}

// Copies the section form's fields into state.survey[section].
function readSection(form, section) {
  const data = new FormData(form);
  const target = state.survey[section];
  if (section === "about") {
    target.name = { first: data.get("firstName").trim(), last: data.get("lastName").trim() };
    target.profile = { age: toNumber(data.get("profile-age")), height: readHeight(form), weight: readWeight(form), sex: data.get("profile-sex") };
  } else if (section === "health") {
    target.familyHistory = data.get("health-familyHistory");
    target.headacheDays = data.get("health-headacheDays");
    target.caffeine = data.get("health-caffeine");
    HEALTH_NUMBERS.forEach(([key]) => { target[key] = toNumber(data.get(`health-${key}`)); });
    target.hormonal = data.getAll("hormonal");
    target.symptoms = data.getAll("symptoms");
  } else {
    SENSITIVITIES.forEach(([key]) => { target.sensitivities[key] = data.get(`sens-${key}`); });
    SCHEDULE_FIELDS.forEach(([key]) => { target.schedule[key] = data.get(key); });
  }
}

// Full-page intermediate step between login and the dashboard. Each step is one section.
function onboardingPage() {
  const step = state.onboardingStep;
  const section = SECTION_ORDER[step - 1];
  const { heading, icon: iconName, fields, note } = SECTIONS[section];
  return `<main class="onboarding-page"><div class="onboarding-top"><span class="brand"><span class="brand-mark">◒</span><span>${BRAND}</span></span><div class="onboarding-progress" aria-hidden="true">${SECTION_ORDER.map((_, index) => `<span class="${index < step ? "filled" : ""}"></span>`).join("")}</div></div><form class="survey-card" id="survey-form" data-section="${section}"><span class="tile-icon">${icon(iconName)}</span><h3>${heading}</h3>${note ? `<p class="privacy-note">${note}</p>` : ""}${fields()}<button class="primary-button" type="submit">${step === TOTAL_STEPS ? "Finish" : "Next"} <span>→</span></button><button class="skip-button" type="button" data-action="skip-section">Skip</button></form></main>`;
}

function profilePage() {
  const section = state.profileSection;
  if (section === "system") return systemSettingsPage();
  if (SECTIONS[section]) return profileSectionPage(section);
  return profileHome();
}

function profileHome() {
  const tiles = [
    ...SECTION_ORDER.map(section => [section, SECTIONS[section].title, SECTIONS[section].icon, state.saved[section] ? `<small class="tile-status saved">Saved</small>` : `<small class="tile-status">Not set</small>`]),
    ["system", "System settings", "gear", ""],
  ];
  return `
    <div class="profile-page">
      <section class="panel profile-panel profile-head">
        <div class="avatar">${userInitials()}</div>
        <div><h3>${escapeHtml(userName())}</h3></div>
      </section>
      <div class="tile-grid">${tiles.map(([key, title, iconName, status]) => `<a class="tile" href="#profile/${key}"><span class="tile-icon">${icon(iconName)}</span><strong>${title}</strong>${status}</a>`).join("")}</div>
      <button class="outline-button profile-signout" type="button" data-action="sign-out">Sign out</button>
    </div>`;
}

function profileSectionPage(section) {
  const { title, icon: iconName, fields } = SECTIONS[section];
  return `
    <div class="profile-page">
      <a class="back-link" href="#profile">← Profile</a>
      <form class="panel profile-panel" id="profile-section-form" data-section="${section}">
        <div class="profile-section-head"><span class="tile-icon small">${icon(iconName)}</span><div><h3>${title}</h3></div></div>
        ${fields()}
        <button class="primary-button" type="submit">Save ${title.toLowerCase()}</button>
      </form>
    </div>`;
}

function systemSettingsPage() {
  const settings = state.settings;
  return `
    <div class="profile-page">
      <a class="back-link" href="#profile">← Profile</a>
      <form class="panel profile-panel" id="profile-settings-form">
        <div class="profile-section-head"><span class="tile-icon small">${icon("gear")}</span><div><h3>System settings</h3></div></div>
        <label>Theme <select name="theme">${["light", "dark"].map(value => `<option value="${value}" ${settings.theme === value ? "selected" : ""}>${value[0].toUpperCase() + value.slice(1)}</option>`).join("")}</select></label>
        <label>Thresholds <select name="thresholdMode">${[["auto", "Auto-learn"], ["manual", "Manual"]].map(([value, label]) => `<option value="${value}" ${settings.thresholdMode === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <label>Device light suggestions <input type="checkbox" name="ledAlerts" ${settings.ledAlerts ? "checked" : ""} /></label>
        <button class="primary-button" type="submit">Save settings</button>
      </form>
    </div>`;
}

// Shown on the dashboard until every survey section has been saved.
function profileBanner() {
  const missing = SECTION_ORDER.filter(section => !state.saved[section]).map(section => SECTIONS[section].short);
  if (!missing.length) return "";
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}` : missing[0];
  return `<aside class="profile-banner"><div><strong>Complete your profile</strong><p>Add your ${list} to personalize your suggestions.</p></div><a class="outline-button small" href="#profile">Go to profile →</a></aside>`;
}

function userName() {
  const { first, last } = state.survey.about.name;
  return `${first} ${last}`.trim() || state.user?.name || state.user?.nickname || "Guest";
}

function userInitials() {
  return userName().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join("") || "?";
}

function applySettings() {
  document.documentElement.dataset.theme = state.settings.theme;
}

async function signOut() {
  if (state.demoMode || !state.auth) {
    Object.assign(state, { authenticated: false, demoMode: false, user: null, needsSurvey: false, onboardingStep: 1, registered: false, live: defaultLive(), history: defaultHistory() });
    location.hash = "login";
    render();
    return;
  }
  await state.auth.logout({ logoutParams: { returnTo: window.location.origin } });

}

function symptomLine(log) {
  if (log.note) return escapeHtml(log.note);
  if (log.readingsInWindow > 0) return `Air ${(AIR_WORDS[log.airBand] || "unknown").toLowerCase()}, light ${(LIGHT_WORDS[log.lightBand] || "unknown").toLowerCase()} in the 30 minutes before`;
   return "The device was off, and there are no readings for this one.";
}

function symptomContextHtml(log) {
         const context = state.history.symptomContext;
  if (!context || String(context.symptom.id) !== String(log.id)) return `<p class="muted session-detail">Loading.</p>`;
  const summary = log.readingsInWindow >  0
    ? `In the  30 minutes before: air ${(AIR_WORDS[log.airBand] || "unknown").toLowerCase()}, light ${(LIGHT_WORDS[log.lightBand] || "unknown").toLowerCase()}.`
    : "The device was off, so there are no readings for this one.";
  return `<div class="session-detail"><p class="section-kicker">Before your symptom</p><div class="chart">${trendChart({ points: context.points, from: context.from, to: context.to, shade: { from: context.windowFrom, to: context.to } })}</div><p class="muted">${summary}</p></div>`;
}

function logRows(logs, scope) {
  return logs.map(log => {
    const open = Boolean(state.history.openSymptom) && state.history.openSymptom.id === String(log.id) && state.history.openSymptom.scope === scope;
    return `<div class="log-item"><button type="button" class="log-row" data-log="${log.id}" data-scope="${scope}" aria-expanded="${open}"><span class="log-main"><b>${symptomLabel(log.symptom)}, ${severityWord(log.severity)}</b><small>${symptomLine(log)}</small></span><span class="history-time">${formatShortDay(log.loggedAt)}, ${formatTime(log.loggedAt)}</span></button>${open ? symptomContextHtml(log) : ""}</div>`;
  }).join("");
}

function sessionDetailHtml(session) {
  const detail = state.history.sessionDetail;
  if (!detail || String(detail.id) !== String(session.id)) return `<p class="muted session-detail">Loading.</p>`;
  const end = detail.endedAt || (detail.points.length ? detail.points[detail.points.length - 1].time : detail.startedAt);
  return `<div class="session-detail"><div class="chart">${trendChart({ points: detail.points, from: detail.startedAt, to: end, markers: detail.symptoms.map(log => ({ time: log.loggedAt })) })}</div>${detail.symptoms.length ? `<div class="log-list">${logRows(detail.symptoms, "session")}</div>` : `<p class="muted">No symptoms logged in this session.</p>`}</div>`;
}

function sessionCards() {
  const history = state.history;
  if (!history.sessions.length) return `<p class="muted">Nothing here yet. Sessions appear when you turn on your Prodrome One.</p>`;
  let lastDay = "";
  return history.sessions.map(session => {
    const day = formatDay(session.startedAt);
    const heading = day !== lastDay ? `<h4 class="day-label">${day}</h4>` : "";
    lastDay = day;
    const open = history.openSession === String(session.id);
    return `${heading}<article class="session-card"><button type="button" class="session-head" data-session="${session.id}" aria-expanded="${open}"><span><b>${formatTime(session.startedAt)} to ${session.open ? "now" : formatTime(session.endedAt)}</b><small>${formatDuration(session.durationSeconds)}${session.endedReason === "inactivity" ? " · ended automatically" : ""}</small></span><span class="session-tags"><span class="${tagClass(session.airBand)}">Air: ${AIR_WORDS[session.airBand] || "no data"}</span><span class="${tagClass(session.lightBand)}">Light: ${LIGHT_WORDS[session.lightBand] || "no data"}</span></span><span class="session-dots" aria-label="${session.symptoms.length} symptoms logged">${session.symptoms.map(() => "<i></i>").join("")}</span></button>${open ? sessionDetailHtml(session) : ""}</article>`;
  }).join("");
}

function insightsPage() {
  const history = state.history;
  const intro = (note, badge = "") => `<section class="hero-row"><div><h2>Patterns worth knowing.</h2><p class="muted">${note}</p></div>${badge}</section>`;
  if (!history.loaded) return intro("Loading your history.");
  if (history.error) return intro("We can't reach the Prodrome backend. Start it and refresh the page.");

  const insights = history.insights;
  const patterns = (insights && insights.patterns) || [];
  const confidence = insights ? insights.confidence : 0;
  const stage = insights ? insights.stage : "baseline";
  const emptyPatterns = insights && insights.totalLogs >= insights.minimumLogs ? "No clear pattern yet. Keep logging and we'll keep looking." : "Log a few symptoms and we'll start finding patterns.";
  return `${intro("Prodrome learns from your environment and how you feel in it.", insights ? `<span class="confidence-badge">${confidence}% confidence</span>` : "")}
    <section class="insight-grid">
      <article class="panel confidence-panel"><div class="panel-title"><div><h3>${stage === "personalized" ? "Personalized" : stage === "calibrating" ? "Calibrating" : "Getting to know you"}</h3></div><div class="confidence-ring"><strong>${confidence}</strong><small>%</small></div></div><div class="confidence-bar"><span style="width:${confidence}%"></span></div><p class="muted">Based on <b>${insights ? insights.totalLogs : 0} symptom logs</b> and ${insights ? insights.daysOfData : 0} days of environmental data.</p><div class="stage-row"><span>Baseline</span><span>Calibrating</span><b>Personalized</b></div></article>
      <article class="panel"><div class="panel-title"><div><h3>What seems to affect you</h3></div><span class="spark-icon">✦</span></div>${patterns.length ? patterns.map((pattern, index) => `<div class="trigger"><span class="trigger-rank">0${index + 1}</span><div class="trigger-bar"><b>${escapeHtml(pattern.title)}</b><span>${escapeHtml(pattern.detail)}</span><i><em style="width:${pattern.rate}%"></em></i><small class="muted">${escapeHtml(pattern.confidenceLine)}</small></div><strong>${pattern.rate}%</strong></div>`).join("") : `<p class="muted">${emptyPatterns}</p>`}</article>
    </section>
    <section class="section-head"><div><h3>Your sessions</h3></div><button class="outline-button small" data-action="log-symptom">+ Symptom</button></section>
    <section class="sessions">${sessionCards()}${history.nextSessions ? `<p><button class="text-button" data-action="more-sessions">Show more</button></p>` : ""}</section>
    <section class="section-head"><div><h3>Your log</h3></div></section>
    <section class="panel correlation-panel">${history.symptoms.length ? `<div class="log-list">${logRows(history.symptoms, "log")}</div>${history.nextSymptoms ? `<p><button class="text-button" data-action="more-symptoms">Show more</button></p>` : ""}` : `<p class="muted">Nothing logged yet. Tap + Symptom when you feel off.</p>`}</section>`;
}

function devicePage() {
  const device = state.live.device;
  const deviceOnline = Boolean(device && device.online);
  const sensorStatus = deviceOnline ? `<b class="setting-good">Connected</b>` : `<b>Offline</b>`;
  const pixels = Array.from({length: 104}, (_, i) => `<i class="${[8,9,10,19,20,21,30,31,32,33,42,43,52,53,54,64,65,66,75,76,77,86,87,88,89,98,99,100].includes(i) ? "on" : ""}"></i>`).join("");
  return `<section class="hero-row"><div><h2>Your calm, on the desk.</h2><p class="muted">Manage your Prodrome One and tailor how it supports you.</p></div><span class="online-badge"><span class="status-dot"></span> ${deviceOnline ? "Online" : "Offline"}</span></section><section class="device-grid"><article class="panel device-preview"><div class="panel-title"><div><h3>Prodrome One</h3></div><span class="device-id">${escapeHtml(device && device.deviceId ? device.deviceId : "Not paired")}</span></div><div class="matrix-shell"><div class="matrix">${pixels}</div></div><p class="matrix-caption">Showing <b>Good air + light</b> pattern</p><button class="outline-button" data-action="test-pattern">Send test pattern</button></article><article class="panel settings-panel"><p class="section-kicker">Device status</p><div class="setting-row"><span>Air quality sensor</span>${sensorStatus}</div><div class="setting-row"><span>Light sensor</span>${sensorStatus}</div><div class="setting-row"><span>Last sync</span><b>${device && device.lastSeen ? timeAgo(device.lastSeen) : "Never"}</b></div><hr/><p class="section-kicker">Break reminders</p><label class="setting-control"><span>Focus interval <small>Time between break nudges</small></span><select><option>45 minutes</option><option>50 minutes</option><option>60 minutes</option></select></label><label class="setting-control"><span>Eye rest mode <small>Shorter intervals for screen time</small></span><input type="checkbox" checked /></label><hr/><p class="section-kicker">Circadian schedule</p><div class="time-pair"><label>Wake up<input type="time" value="07:00" /></label><label>Wind down<input type="time" value="22:00" /></label></div></article></section>`;
}

function showToast(message) {
  const region = document.querySelector("#toast-region");
  region.innerHTML = `<div class="toast"><span>✦</span>${message}<button data-action="dismiss">×</button></div>`;
  setTimeout(() => { region.innerHTML = ""; }, 4500);
}

function notificationCenter() {
  return `
    <aside class="notification-centre" aria-label="Notification centre">
      <button class="notification-bubble" type="button" data-action="toggle-notifications" aria-label="${state.notificationsOpen ? "Close" : "Open"} notifications" aria-expanded="${state.notificationsOpen}">
        <span>♢</span>${state.notifications.length ? `<b>${state.notifications.length}</b>` : ""}
      </button>
      ${state.notificationsOpen ? `
        <div class="notification-panel" role="dialog" aria-label="Notifications">
          <div class="notification-panel-head"><div><h3>Notifications</h3></div>${state.notifications.length ? `<button type="button" class="notification-clear" data-action="dismiss-all">Dismiss all</button>` : ""}</div>
          <div class="notification-list">
            ${state.notifications.length ? state.notifications.map((notification, index) => `
              <article class="notification-item ${notification.type}">
                <div class="notification-symbol">${notification.type === "warning" ? "!" : "✦"}</div>
                <div class="notification-copy"><strong>${notification.title}</strong><p>${notification.message}</p></div>
                <button type="button" data-dismiss-notification="${index}">OK</button>
              </article>`).join("") : `<div class="notification-empty"><span>✓</span><p>You’re all caught up.</p></div>`}
          </div>
        </div>` : ""}
    </aside>`;
}

function bindEvents() {
  document.querySelectorAll("[data-unit]").forEach(button => button.addEventListener("click", () => {
    const [field, unit] = button.dataset.unit.split(":");
    const form = button.closest("form");
    readSection(form, form.dataset.section);
    state.settings.units[field] = unit;
    render();
  }));

  const onboardingForm = document.querySelector("#survey-form");
  if (onboardingForm) onboardingForm.addEventListener("submit", event => {
    event.preventDefault();
    readSection(onboardingForm, onboardingForm.dataset.section);
    advanceSurvey(true);
  });

  const sectionForm = document.querySelector("#profile-section-form");
  if (sectionForm) sectionForm.addEventListener("submit", event => {
    event.preventDefault();
    saveProfileSection(sectionForm);
  });

  const settingsForm = document.querySelector("#profile-settings-form");
  if (settingsForm) settingsForm.addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(settingsForm);
    state.settings = { ...state.settings, theme: data.get("theme"), thresholdMode: data.get("thresholdMode"), ledAlerts: data.has("ledAlerts") };
    applySettings();
    try {
      await backend().updateUser(state.user.sub, { settings: state.settings });
      showToast("Settings saved.");
    } catch (error) {
      console.error("Saving settings failed:", error);
      showToast("Could not save your settings.");
    }
  });
}

// Routes look like "dashboard" or "profile/<section>".
window.addEventListener("hashchange", () => {
  const [route, section] = (location.hash.slice(1) || (state.authenticated ? "dashboard" : "login")).split("/");
  state.route = route;
  state.profileSection = section || null;
  render();
  loadRouteData();
});
// Keeps the dashboard and Device page current while they are open.
setInterval(refreshLive, 10000);
setInterval(renderCheckin, 1000);

// New users (not found in TigerData) see the survey; existing users go straight to the dashboard.
async function routeAfterLogin() {
  state.needsSurvey = false;
  state.registered = false;
  state.survey = defaultSurvey();
  state.saved = defaultSaved();
  state.settings = defaultSettings();
  state.live = defaultLive();
  state.history = defaultHistory();
  try {
    const stored = await backend().getUser(state.user.sub);
    if (stored) {
      state.registered = true;
      loadStoredProfile(stored);
    } else {
      state.needsSurvey = true;
    }
  } catch (error) {
    console.error("User lookup failed:", error);
    showToast("Could not reach the Prodrome backend.");
  }
  applySettings();
  state.route = state.needsSurvey ? "onboarding" : "dashboard";
  location.hash = state.route;
  render();
}

// A section present in the stored survey was saved; a missing one was skipped and stays "Not set".
function loadStoredProfile(stored) {
  const defaults = defaultSurvey();
  const survey = stored.survey || {};
  SECTION_ORDER.forEach(section => { state.saved[section] = Boolean(survey[section]); });
  if (survey.about) state.survey.about = { name: { ...defaults.about.name, ...survey.about.name }, profile: { ...defaults.about.profile, ...survey.about.profile } };
  if (survey.health) state.survey.health = { ...defaults.health, ...survey.health };
  if (survey.environment) state.survey.environment = { sensitivities: { ...defaults.environment.sensitivities, ...survey.environment.sensitivities }, schedule: { ...defaults.environment.schedule, ...survey.environment.schedule } };
  state.settings = { ...state.settings, ...stored.settings, units: { ...state.settings.units, ...stored.settings?.units } };
}

function surveyStatus() {
  const count = SECTION_ORDER.filter(section => state.saved[section]).length;
  return count === TOTAL_STEPS ? "completed" : count ? "partial" : "skipped";
}

// Sends every saved section (never a skipped one). The first save creates the user; later saves update it.
async function persistSurvey() {
  const survey = Object.fromEntries(SECTION_ORDER.filter(section => state.saved[section]).map(section => [section, state.survey[section]]));
  const payload = { surveyStatus: surveyStatus(), survey, settings: state.settings };
  if (state.registered) {
    await backend().updateUser(state.user.sub, payload);
  } else {
    await backend().registerUser(state.user.sub, payload);
    state.registered = true;
  }
}

// Continue saves the current section and moves on; Skip moves on without saving it.
async function advanceSurvey(saveCurrent) {
  const section = SECTION_ORDER[state.onboardingStep - 1];
  if (saveCurrent) {
    state.saved[section] = true;
    try {
      await persistSurvey();
    } catch (error) {
      state.saved[section] = false;
      console.error("Saving survey section failed:", error);
      showToast("Could not save this section.");
      return;
    }
  }
  if (state.onboardingStep < TOTAL_STEPS) {
    state.onboardingStep += 1;
    render();
    return;
  }
  await finishSurvey();
}

async function finishSurvey() {
  if (!state.registered) {
    // Every section was skipped; still create the user so the survey doesn't come back at next login.
    try {
      await persistSurvey();
    } catch (error) {
      console.error("Creating user failed:", error);
      showToast("Could not save your survey.");
    }
  }
  state.needsSurvey = false;
  state.onboardingStep = 1;
  location.hash = "dashboard";
}

async function saveProfileSection(form) {
  const section = form.dataset.section;
  const wasSaved = state.saved[section];
  readSection(form, section);
  state.saved[section] = true;
  try {
    await persistSurvey();
    render();
    showToast(`${SECTIONS[section].title} saved.`);
  } catch (error) {
    state.saved[section] = wasSaved;
    console.error("Saving profile section failed:", error);
    showToast("Could not save this section.");
  }
}

async function initializeAuth0() {
  const config = window.PRODROME_AUTH0_CONFIG || {};
  state.authConfigured = Boolean(
    config.domain &&
    config.clientId &&
    !config.domain.includes("YOUR_AUTH0") &&
    !config.clientId.includes("YOUR_AUTH0")
  );

  if (state.authConfigured && window.auth0) {
    try {
      state.auth = await window.auth0.createAuth0Client({
        domain: config.domain,
        clientId: config.clientId,
        authorizationParams: {
          redirect_uri: `${window.location.origin}${window.location.pathname}`
        }
      });
      state.authReady = true;
      if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
        await state.auth.handleRedirectCallback();
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      state.authenticated = await state.auth.isAuthenticated();
      if (state.authenticated) {
        state.user = await state.auth.getUser();
        await routeAfterLogin();
      }
    } catch (error) {
      console.error("Auth0 initialization failed:", error);
      showToast("Could not initialize secure sign in.");
    }
  }

  state.authReady = state.authConfigured && Boolean(state.auth);
  render();
}

initializeAuth0();

// Calculate display-only percentage values for the Environmental snapshot cards using the live readings and personalized thresholds.
const AIR_DISPLAY_BASELINE = 16.4;

function airDisplayPercent(air, thresholds) {
  if (air === null || air === undefined) return null;
  const threshold = Number(thresholds && thresholds.airPoor) || 690;
  return Math.max(0, Math.round(((Number(air) - AIR_DISPLAY_BASELINE) / threshold) * 100));
}

function lightDisplayPercent(light, thresholds) {
  if (light === null || light === undefined) return null;
  const baseline = 0;
  const threshold = Number(thresholds && thresholds.lightHarsh) || 510;
  return Math.max(0, Math.round(((Number(light) - baseline) / (threshold - baseline)) * 100));
}

function airDisplayLabel(percent) {
  return percent === null ? "No data" : percent < 50 ? "Fresh" : percent < 100 ? "Elevated" : "Poor";
}

function lightDisplayLabel(percent) {
  return percent === null ? "No data" : percent < 50 ? "Low" : percent < 100 ? "Moderate" : "Bright";
}

function airDisplayNote(percent) {
  return percent === null ? "No reading yet" : percent < 50 ? "Fresh air" : percent < 100 ? "Air is elevated" : "Poor air";
}

function lightDisplayNote(percent) {
  return percent === null ? "No reading yet" : percent < 50 ? "Low light" : percent < 100 ? "Moderate light" : "Bright light";
}

function airStatusClass(percent) {
  return percent === null ? "status-neutral" : percent < 50 ? "status-good" : percent < 100 ? "status-moderate" : "status-poor";
}

function lightStatusClass(percent) {
  return percent === null ? "status-neutral" : percent < 50 ? "status-good" : percent < 100 ? "status-moderate" : "status-poor";
}
