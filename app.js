const INSIGHT_CONFIG = {
  lookbackMinutes: 120,
  minimumLogs: 5,
  minimumConfidence: 60,
  symptomSeverityScale: 5,
  airRiseRaw: 120,
  badAirRaw: 700,
  harshLightRaw: 700,
  dimLightRaw: 300,
  adcMaximum: 1023,
};

const now = Date.now();
const minutesAgo = minutes => new Date(now - minutes * 60 * 1000);

function createSimulatedEnvironment() {
  const samples = [];
  for (let minutes = 7 * 24 * 60; minutes >= 0; minutes -= 30) {
    const time = minutesAgo(minutes);
    const hour = time.getHours();
    const dayWave = hour >= 7 && hour <= 18 ? 560 : 400;
    const syntheticNoise = ((minutes * 37) % 90) - 45;
    const eventRise = minutes >= 165 && minutes <= 195 ? 180 : 0;
    const lateLightRise = hour >= 20 && hour <= 23 ? 90 : 0;
    samples.push({
      timestamp: time.toISOString(),
      airRaw: Math.max(260, Math.min(1023, dayWave + syntheticNoise + eventRise)),
      lightRaw: hour >= 7 && hour <= 18
        ? Math.max(300, 620 + ((minutes * 53) % 180) + lateLightRise)
        : Math.max(40, 210 + ((minutes * 29) % 180) + lateLightRise),
    });
  }
  return samples;
}

function createSimulatedSymptomLogs() {
  return [
    { symptom: "Headache", offsetMinutes: 190, severity: 3, airRaw: 754 },
    { symptom: "Headache", offsetMinutes: 1560, severity: 4, airRaw: 748 },
    { symptom: "Brain fog", offsetMinutes: 480, severity: 3, airRaw: 736 },
    { symptom: "Eye strain", offsetMinutes: 300, severity: 4, lightRaw: 760 },
    { symptom: "Irritated eyes", offsetMinutes: 1320, severity: 3, lightRaw: 710 },
    { symptom: "Poor sleep", offsetMinutes: 260, severity: 4, lightRaw: 260 },
    { symptom: "Fatigue", offsetMinutes: 920, severity: 2, airRaw: 730 },
    { symptom: "Brain fog", offsetMinutes: 2200, severity: 3, airRaw: 745 },
    { symptom: "Eye strain", offsetMinutes: 2880, severity: 2, lightRaw: 680 },
    { symptom: "Poor sleep", offsetMinutes: 3900, severity: 5, lightRaw: 240 },
  ].map((item, index) => ({
    id: `sim-${index + 1}`,
    symptom: item.symptom,
    severity: item.severity,
    timestamp: minutesAgo(item.offsetMinutes).toISOString(),
    simulated: true,
    context: { airRaw: item.airRaw, lightRaw: item.lightRaw },
  }));
}

function calculateCorrelations(symptomLogs, environment) {
  const candidates = [
    {
      id: "air-rise",
      title: "Air quality rise",
      description: "Air-sensor raw rise of 120+ ADC units",
      symptomTypes: ["Headache", "Brain fog", "Fatigue"],
      measure: "airRaw",
      threshold: (sample, prior) => prior && sample.airRaw - prior.airRaw >= INSIGHT_CONFIG.airRiseRaw,
    },
    {
      id: "bright-light",
      title: "Bright or harsh light",
      description: "Harsh light at or above 700 ADC units",
      symptomTypes: ["Eye strain", "Irritated eyes"],
      measure: "lightRaw",
      threshold: (sample) => sample.lightRaw >= INSIGHT_CONFIG.harshLightRaw,
    },
    {
      id: "late-light",
      title: "Late-day brightness",
      description: "Light at or above 300 ADC units near wind-down",
      symptomTypes: ["Poor sleep"],
      measure: "lightRaw",
      threshold: (sample) => {
        const hour = new Date(sample.timestamp).getHours();
        return hour >= 20 && sample.lightRaw >= INSIGHT_CONFIG.dimLightRaw;
      },
    },
  ];

  return candidates.map(candidate => {
    const relevantLogs = symptomLogs.filter(log => candidate.symptomTypes.includes(log.symptom));
    let matches = 0;
    const linkedEvents = [];

    relevantLogs.forEach(log => {
      const logTime = new Date(log.timestamp).getTime();
      const lookbackStart = logTime - INSIGHT_CONFIG.lookbackMinutes * 60 * 1000;
      const windowSamples = environment.filter(sample => {
        const sampleTime = new Date(sample.timestamp).getTime();
        return sampleTime >= lookbackStart && sampleTime <= logTime;
      });

      const matchingSample = windowSamples.find((sample) => {
        const prior = windowSamples
          .filter(priorSample =>
            new Date(priorSample.timestamp).getTime() <= new Date(sample.timestamp).getTime() - 60 * 60 * 1000
          )
          .at(-1);
        return candidate.threshold(sample, prior);
      });

      if (matchingSample) {
        matches += 1;
        linkedEvents.push({ log, sample: matchingSample });
      }
    });

    const fraction = relevantLogs.length ? matches / relevantLogs.length : 0;
    const logFactor = relevantLogs.length >= INSIGHT_CONFIG.minimumLogs
      ? 1
      : relevantLogs.length / INSIGHT_CONFIG.minimumLogs;
    const confidence = relevantLogs.length
      ? Math.round(fraction * 85 * logFactor + Math.min(relevantLogs.length, 5) * 3)
      : 0;

    return {
      ...candidate,
      relevantLogs: relevantLogs.length,
      matches,
      linkedEvents,
      confidence: Math.min(confidence, 99),
    };
  }).filter(correlation =>
    correlation.relevantLogs > 0 &&
    correlation.confidence >= INSIGHT_CONFIG.minimumConfidence
  ).sort((a, b) => b.confidence - a.confidence);
}

function sensitivityWeight(level) {
  return level === "High" ? 1.25 : level === "Low" ? 0.75 : 1;
}

function calculatePersonalizedThresholds() {
  const recentLogs = state.symptomLogs
    .filter(log => !log.simulated)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);
  const averageSeverity = recentLogs.length
    ? recentLogs.reduce((sum, log) => sum + log.severity, 0) / recentLogs.length
    : 0;
  const symptomFactor = 1 - Math.min(0.25, (averageSeverity / 5) * 0.25);

  if (!state.surveyCompleted) {
    return {
      calibrated: false,
      airMinRaw: INSIGHT_CONFIG.badAirRaw,
      harshLightMinRaw: INSIGHT_CONFIG.harshLightRaw,
      dimLightMaxRaw: INSIGHT_CONFIG.dimLightRaw,
      profileSource: "default",
    };
  }

  const brightWeight = sensitivityWeight(state.sensitivityProfile.brightLight);
  const dimWeight = sensitivityWeight(state.sensitivityProfile.dimLight);
  const airWeight = sensitivityWeight(state.sensitivityProfile.stuffyAir);
  const odorWeight = sensitivityWeight(state.sensitivityProfile.odors);
  const refreshFactor = state.deviceSpecs.refreshRateHz >= 120 ? 0.95 : 1;
  const displayFactor = state.deviceSpecs.displaySizeInches >= 32 ? 1.05 : 1;

  return {
    calibrated: true,
    airMinRaw: Math.round(INSIGHT_CONFIG.badAirRaw - ((airWeight - 1) * 120) - ((odorWeight - 1) * 60) - ((averageSeverity - 2.5) * 12)),
    harshLightMinRaw: Math.round((INSIGHT_CONFIG.harshLightRaw / brightWeight) * refreshFactor * displayFactor * symptomFactor),
    dimLightMaxRaw: Math.round(INSIGHT_CONFIG.dimLightRaw * dimWeight * symptomFactor),
    profileSource: "sensitivity-survey-symptoms-device",
  };
}

const simulatedEnvironment = createSimulatedEnvironment();
const initialSymptomLogs = createSimulatedSymptomLogs();

const DEFAULT_SENSITIVITY = {
  brightLight: "Medium",
  dimLight: "Medium",
  stuffyAir: "Medium",
  odors: "Medium",
};

const DEFAULT_DEVICE_SPECS = {
  model: "CircaAir One",
  displaySizeInches: 27,
  refreshRateHz: 60,
  adcResolutionBits: 10,
  adcMaximum: 1023,
  sensors: {
    air: "Grove Air Quality Sensor v1.3 (qualitative analog)",
    light: "Grove Light Sensor (analog)",
  },
};

function loadPersisted(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Could not persist ${key}:`, error);
  }
}

const persistedProfile = loadPersisted("circaair-sensitivity-profile", null);
const persistedSessions = loadPersisted("circaair-sessions", []);
const persistedDeviceSpecs = loadPersisted("circaair-device-specs", DEFAULT_DEVICE_SPECS);

const state = {
  route: location.hash.slice(1) || "login",
  auth: null,
  authenticated: false,
  authReady: false,
  authConfigured: false,
  demoMode: false,
  user: null,
  selectedRange: "6h",
  score: 84,
  air: 612,
  lux: 420,
  logs: 10,
  breakDue: false,
  deviceOnline: true,
  notificationsOpen: false,
  working: false,
  updateIntervalMs: 5000,
  lastDataSync: null,
  lastAppliedReadingAt: null,
  lastLiveNotificationAt: 0,
  insightConfig: INSIGHT_CONFIG,
  environmentHistory: simulatedEnvironment,
  symptomLogs: initialSymptomLogs,
  correlations: [],
  geminiStatus: "fallback",
  generatedCopy: null,
  sensitivityProfile: persistedProfile || { ...DEFAULT_SENSITIVITY },
  surveyCompleted: Boolean(persistedProfile),
  deviceSpecs: persistedDeviceSpecs,
  thresholds: null,
  sessionId: null,
  sessionStartedAt: null,
  sessionReadings: [],
  sessionSymptoms: [],
  pendingSymptom: null,
  pendingSeverity: 3,
  profileRecalculatedAt: null,
  profileRecalculationTimer: null,
  sessionStore: persistedSessions,
  notifications: [
    { type: "warning", title: "Air quality rising", message: "The Grove air sensor has risen 120 ADC units over the last two hours." },
    { type: "suggestion", title: "Take a screen break", message: "Your 45-minute focus interval ends in 18 minutes." },
    { type: "suggestion", title: "Great focus window", message: "Light and air quality are aligned for deep work right now." },
  ],
};

state.logs = state.symptomLogs.length;
state.correlations = calculateCorrelations(state.symptomLogs, state.environmentHistory);
state.generatedCopy = getFallbackCopy();
state.thresholds = calculatePersonalizedThresholds();
state.notifications = [
  { type: "warning", title: "Calculated pattern available", message: state.correlations[0]?.description || "Keep logging to establish correlations." },
  { type: "suggestion", title: state.generatedCopy.intervention, message: state.generatedCopy.notification },
];
generateGeminiCopy();

const routeMeta = {
  login: ["Welcome", "Sign in to CircaAir"],
  dashboard: ["Live dashboard", "Good morning, Alex"],
  onboarding: ["Sensitivity survey", "Personalize your guardian"],
  insights: ["Insights & triggers", "Your environment, decoded"],
  device: ["Device & settings", "CircaAir desk companion"],
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
  if (state.route === "login") {
    app.innerHTML = loginPage();
    bindLoginEvents();
    return;
  }
  const meta = routeMeta[state.route] || routeMeta.dashboard;
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" href="#dashboard"><span class="brand-mark">◒</span><span>circa<span>air</span></span></a>
        <div class="user-chip"><div class="avatar">AC</div><div><strong>Alex Chen</strong><small>Personal profile</small></div><span class="chevron">⌄</span></div>
        <nav aria-label="Main navigation">
          <p class="nav-label">Monitor</p>
          ${navItems.map(([id, icon, label]) => `<a class="nav-item ${state.route === id ? "active" : ""}" href="#${id}"><span class="nav-icon">${icon}</span>${label}</a>`).join("")}
          <p class="nav-label settings-label">Personalize</p>
          <a class="nav-item ${state.route === "onboarding" ? "active" : ""}" href="#onboarding"><span class="nav-icon">✦</span>Survey</a>
          <a class="nav-item" href="#device"><span class="nav-icon">⚙</span>Settings</a>
        </nav>
        <div class="sidebar-footer"><div class="mini-device"><span class="status-dot"></span><div><strong>CircaAir One</strong><small>Online · synced now</small></div><span>›</span></div><small class="version">CircaAir prototype · v0.1</small></div>
      </aside>
      <main class="main">
        <header class="topbar"><div><p class="eyebrow">${meta[0]}</p><h1>${meta[1]}</h1></div><div class="top-actions"><span class="live-pill"><span class="status-dot"></span> ${state.working ? "Receiving" : "Paused"}</span><button class="icon-button" data-action="toggle-notifications" aria-label="Notifications" aria-expanded="${state.notificationsOpen}">♢${state.notifications.length ? `<b>${state.notifications.length}</b>` : ""}</button><div class="avatar">AC</div></div></header>
        <div class="content">${pageContent()}</div>
      </main>
    </div>
    ${notificationCenter()}`;
  bindEvents();
}

function pageContent() {
  if (state.route === "onboarding") return window.CircaAirPages.onboarding();
  if (state.route === "insights") return window.CircaAirPages.insights();
  if (state.route === "device") return window.CircaAirPages.device();
  return window.CircaAirPages.dashboard();
}

function loginPage() {
  return window.CircaAirPages.login();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function getChartData(range) {
  const ranges = {
    "15m": 15,
    "6h": 6 * 60,
    "24h": 24 * 60,
    "7d": 7 * 24 * 60,
  };
  const windowMinutes = ranges[range] || ranges["6h"];
  const latestTime = state.environmentHistory.length
    ? new Date(state.environmentHistory[state.environmentHistory.length - 1].timestamp).getTime()
    : Date.now();
  const windowStart = latestTime - windowMinutes * 60 * 1000;
  let samples = state.environmentHistory.filter(sample =>
    new Date(sample.timestamp).getTime() >= windowStart
  );
  if (!samples.length) return [];

  const pointCount = range === "15m" ? 6 : range === "6h" ? 10 : range === "24h" ? 12 : 14;
  const result = [];
  for (let i = 0; i < pointCount; i++) {
    const targetTime = windowStart + (windowMinutes * 60 * 1000 * i / (pointCount - 1));
    const before = samples.reduce((closest, sample) =>
      new Date(sample.timestamp).getTime() <= targetTime &&
      (!closest || new Date(sample.timestamp).getTime() > new Date(closest.timestamp).getTime())
        ? sample
        : closest,
    null);
    const after = samples.find(sample => new Date(sample.timestamp).getTime() >= targetTime);
    if (!before && after) result.push(after);
    else if (before && !after) result.push(before);
    else if (before && after) {
      const beforeTime = new Date(before.timestamp).getTime();
      const afterTime = new Date(after.timestamp).getTime();
      const mix = afterTime === beforeTime ? 0 : (targetTime - beforeTime) / (afterTime - beforeTime);
      result.push({
        timestamp: new Date(targetTime).toISOString(),
        airRaw: Math.round(before.airRaw + (after.airRaw - before.airRaw) * mix),
        lightRaw: Math.round(before.lightRaw + (after.lightRaw - before.lightRaw) * mix),
      });
    }
  }
  return result;
}

function buildChartLines(samples) {
  const width = 760;
  const height = 220;
  const bottom = 185;
  const top = 20;

  function lineFor(getValue, minimum, maximum) {
    if (!samples.length) return "";
    return samples.map((sample, index) => {
      const x = samples.length === 1 ? width / 2 : width * index / (samples.length - 1);
      const value = getValue(sample);
      const clamped = Math.max(minimum, Math.min(maximum, value));
      const y = bottom - ((clamped - minimum) / (maximum - minimum)) * (bottom - top);
      return `${index === 0 ? "M" : "L"}${Math.round(x)} ${Math.round(y)}`;
    }).join(" ");
  }

  return {
    air: lineFor(sample => sample.airRaw, 0, 1023),
    light: lineFor(sample => sample.lightRaw, 0, 1023),
  };
}

function getChartAxisLabels(range) {
  const now = new Date();
  const formats = {
    "15m": date => date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    "6h": date => date.toLocaleTimeString([], { hour: "numeric" }),
    "24h": date => date.toLocaleTimeString([], { hour: "numeric" }),
    "7d": date => date.toLocaleDateString([], { weekday: "short" }),
  };
  const format = formats[range] || formats["6h"];
  const minutes = { "15m": 15, "6h": 360, "24h": 1440, "7d": 10080 }[range] || 360;
  return [0, 1, 2, 3].map(index => {
    const elapsedFraction = index / 3;
    const date = new Date(now.getTime() - minutes * 60 * 1000 * (1 - elapsedFraction));
    return format(date);
  });
}

function getFallbackCopy() {
  const top = state.correlations[0];
  if (top?.id === "air-rise") {
    return {
      intervention: "Consider fresh air or a ventilation break",
      detail: "An air-quality pattern has appeared around some logged symptoms.",
      notification: "Air conditions have changed; open a window or pause in a fresh-air space.",
    };
  }
  if (top?.id === "bright-light") {
    return {
      intervention: "Reduce glare and soften the light",
      detail: "Bright-light periods have appeared around some logged eye symptoms.",
      notification: "Lighting is bright; reduce glare or take a short visual break.",
    };
  }
  if (top?.id === "late-light") {
    return {
      intervention: "Start your evening wind-down",
      detail: "Late-day brightness has appeared around some logged sleep symptoms.",
      notification: "Evening light is elevated; dim the room as wind-down begins.",
    };
  }
  return {
    intervention: "Keep logging symptoms",
    detail: "Continue for a few more logs to improve pattern confidence.",
    notification: "No confident pattern yet. Keep your symptom log up to date.",
  };
}

function buildGeminiContext() {
  const latestLogs = [...state.symptomLogs]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5)
    .map(log => ({
      symptom: log.symptom,
      severityBand: log.severity <= 2 ? "mild" : log.severity <= 4 ? "moderate" : "high",
    }));
  const top = state.correlations[0];

  return {
    symptoms: latestLogs,
    environment: {
      airBand: state.air >= state.thresholds.airMinRaw ? "bad" : state.air >= 500 ? "moderate" : "low",
      lightBand: state.lux >= state.thresholds.harshLightMinRaw ? "harsh" : state.lux >= 300 ? "moderate" : "dim",
      timeOfDayBand: new Date().getHours() >= 20 ? "wind-down" : "daytime",
    },
    learningProfile: {
      sensitivitySurveyCompleted: state.surveyCompleted,
      sensitivities: state.sensitivityProfile,
      deviceSpecs: state.deviceSpecs,
      recalculatedAt: state.profileRecalculatedAt,
      thresholds: state.thresholds,
    },
    correlation: top ? {
      label: top.title,
      lookbackMinutes: state.insightConfig.lookbackMinutes,
      minimumLogCount: state.insightConfig.minimumLogs,
      confidenceBand: top.confidence >= 80 ? "high" : top.confidence >= 60 ? "medium" : "low",
    } : null,
  };
}

async function generateGeminiCopy() {
  state.generatedCopy = getFallbackCopy();
  if (state.notifications[1]) {
    state.notifications[1].title = state.generatedCopy.intervention;
    state.notifications[1].message = state.generatedCopy.notification;
  }
  const config = window.CIRCAAIR_GEMINI_CONFIG || {};
  if (!config.enabled || !config.endpoint) {
    state.geminiStatus = "fallback";
    return;
  }
  let endpoint;
  try {
    endpoint = new URL(config.endpoint, window.location.href);
  } catch {
    state.geminiStatus = "fallback";
    return;
  }
  if (endpoint.origin !== window.location.origin) {
    console.warn("Gemini proxy blocked: only same-origin endpoints are allowed.");
    state.geminiStatus = "fallback";
    return;
  }

  state.geminiStatus = "loading";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(endpoint.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: buildGeminiContext(),
        instructions: "Write only short, general wellbeing interventions. Do not diagnose, infer identity, or claim medical causation.",
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Gemini proxy returned ${response.status}`);
    const copy = await response.json();
    if (
      typeof copy.intervention === "string" &&
      typeof copy.detail === "string" &&
      typeof copy.notification === "string"
    ) {
      state.generatedCopy = copy;
      state.geminiStatus = "generated";
      if (state.notifications[1]) {
        state.notifications[1].title = copy.intervention;
        state.notifications[1].message = copy.notification;
      }
    } else {
      state.geminiStatus = "fallback";
    }
  } catch (error) {
    console.warn("Gemini copy unavailable; using local fallback.", error);
    state.geminiStatus = "fallback";
  } finally {
    clearTimeout(timeoutId);
  }
}

function bindLoginEvents() {
  document.querySelectorAll("[data-auth-action]").forEach(button => {
    button.addEventListener("click", async () => {
      if (button.dataset.authAction === "demo") {
        state.demoMode = true;
        state.authenticated = true;
        state.user = { name: "Alex Chen" };
        location.hash = "onboarding";
        render();
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
          <div class="notification-panel-head"><div><p class="section-kicker">CIRCAAIR</p><h3>Notifications</h3></div>${state.notifications.length ? `<button type="button" class="notification-clear" data-action="dismiss-all">Dismiss all</button>` : ""}</div>
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
  document.querySelectorAll("[data-range]").forEach(button => button.addEventListener("click", () => { state.selectedRange = button.dataset.range; render(); }));
  document.querySelectorAll("[data-symptom]").forEach(button => button.addEventListener("click", () => {
    state.pendingSymptom = button.dataset.symptom;
    state.pendingSeverity = 3;
    render();
  }));
  document.querySelectorAll("[data-severity]").forEach(button => button.addEventListener("click", () => {
    state.pendingSeverity = Number(button.dataset.severity);
    render();
  }));
  document.querySelectorAll("[data-dismiss-notification]").forEach(button => button.addEventListener("click", () => {
    state.notifications.splice(Number(button.dataset.dismissNotification), 1);
    render();
  }));
  document.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", event => {
    const action = event.currentTarget.dataset.action;
    if (action === "save-symptom" && state.pendingSymptom) {
      const symptom = state.pendingSymptom;
      const severity = state.pendingSeverity;
      const symptomLog = {
        id: `log-${Date.now()}`,
        symptom,
        severity,
        timestamp: new Date().toISOString(),
        simulated: false,
        context: { airRaw: state.air, lightRaw: state.lux },
      };
      state.symptomLogs.push(symptomLog);
      if (state.working) state.sessionSymptoms.push(symptomLog);
      state.logs += 1;
      state.correlations = calculateCorrelations(state.symptomLogs, state.environmentHistory);
      recalculateLearningProfile();
      generateGeminiCopy();
      state.pendingSymptom = null;
      state.pendingSeverity = 3;
      render();
      showToast(`${symptom} severity ${severity}/5 logged — comparing the prior ${INSIGHT_CONFIG.lookbackMinutes / 60} hours.`);
    }
    if (action === "cancel-symptom") {
      state.pendingSymptom = null;
      state.pendingSeverity = 3;
      render();
    }
    if (action === "start-working") {
      state.working = true;
      startWorkingSession();
      state.lastDataSync = new Date().toISOString();
      pollLiveData();
      render();
      showToast("Live data collection started.");
    }
    if (action === "stop-working") {
      state.working = false;
      stopWorkingSession();
      render();
      showToast("Live data collection stopped.");
    }
    if (action === "log-symptom") {
      if (state.route !== "dashboard") {
        location.hash = "dashboard";
        setTimeout(() => document.querySelector("#symptom-log")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      } else {
        document.querySelector("#symptom-log")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    if (action === "toggle-notifications") { state.notificationsOpen = !state.notificationsOpen; render(); }
    if (action === "dismiss-all") { state.notifications = []; render(); }
    if (action === "start-break") { state.breakDue = true; showToast("Break timer started — see you in 5 minutes."); }
    if (action === "test-pattern") showToast("Test pattern sent to CircaAir One.");
    if (action === "dismiss") event.currentTarget.closest(".toast, .intervention")?.remove();
    if (action === "skip-survey") { location.hash = "dashboard"; }
  }));
  const form = document.querySelector("#survey-form");
  if (form) form.addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(form);
    state.sensitivityProfile = {
      brightLight: data.get("brightLight"),
      dimLight: data.get("dimLight"),
      stuffyAir: data.get("stuffyAir"),
      odors: data.get("odors"),
    };
    state.surveyCompleted = true;
    persist("circaair-sensitivity-profile", state.sensitivityProfile);
    recalculateLearningProfile();
    generateGeminiCopy();
    showToast("Your sensitivity profile is saved. Hazard thresholds recalculated.");
    setTimeout(() => { location.hash = "dashboard"; }, 800);
  });
  const liveDataForm = document.querySelector("#live-data-form");
  if (liveDataForm) liveDataForm.addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(liveDataForm);
    const airRaw = Number(data.get("airRaw"));
    const lightRaw = Number(data.get("lightRaw"));
    if (!Number.isFinite(airRaw) || airRaw < 0 || airRaw > 1023 ||
      !Number.isFinite(lightRaw) || lightRaw < 0 || lightRaw > 1023) {
      showToast("Enter 0–1023 for both 10-bit Grove sensor readings.");
      return;
    }
    try {
      const response = await fetch("/api/live-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ airRaw, lightRaw }),
      });
      if (!response.ok) throw new Error(`Live data rejected (${response.status})`);
      const reading = await response.json();
      applyLiveReading(reading);
      showToast(`Live reading inserted: air ${reading.airRaw}, light ${reading.lightRaw} (10-bit ADC).`);
    } catch (error) {
      showToast(error.message);
    }
  });
}

function detectLiveEnvironmentNotifications(previousAir, previousLux) {
  const thresholds = state.thresholds;
  const airHazard = state.air >= thresholds.airMinRaw;
  const brightHazard = state.lux >= thresholds.harshLightMinRaw;
  const dimHazard = state.lux <= thresholds.dimLightMaxRaw;

  if (airHazard) {
    const airRise = state.air - previousAir;
    addLiveNotification(
      "warning",
      "Bad air quality",
      `Qualitative air reading is ${state.air}${airRise >= 0 ? `, up ${airRise} ADC units` : ""}; the threshold is ${thresholds.airMinRaw}/1023.`
    );
  }
  if (brightHazard) {
    addLiveNotification(
      "warning",
      "Harsh lighting",
      `Ambient light reading is ${state.lux}; the threshold is ${thresholds.harshLightMinRaw}/1023.`
    );
  } else if (dimHazard) {
    addLiveNotification(
      "warning",
      "Low-light hazard",
      `Ambient light reading is ${state.lux}; the threshold is ${thresholds.dimLightMaxRaw}/1023 or lower.`
    );
  }
}

function addLiveNotification(type, title, message) {
  state.lastLiveNotificationAt = Date.now();
  const isDuplicate = state.notifications.some(notification =>
    notification.title === title && notification.message === message
  );
  if (isDuplicate) return;

  state.notifications.unshift({ type, title, message });
  showToast(`${title} — ${message}`);
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body: message });
  }
  if (state.route === "dashboard") render();
}

function recalculateLearningProfile() {
  state.thresholds = calculatePersonalizedThresholds();
  state.profileRecalculatedAt = new Date().toISOString();
  generateGeminiCopy();
  persist("circaair-sensitivity-profile", state.surveyCompleted ? state.sensitivityProfile : null);
  persist("circaair-device-specs", state.deviceSpecs);
  return state.thresholds;
}

function startWorkingSession() {
  state.sessionId = `session-${Date.now()}`;
  state.sessionStartedAt = new Date().toISOString();
  state.sessionReadings = [];
  state.sessionSymptoms = [];
  recalculateLearningProfile();
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
  if (state.profileRecalculationTimer) clearInterval(state.profileRecalculationTimer);
  state.profileRecalculationTimer = setInterval(() => {
    if (!state.working) return;
    recalculateLearningProfile();
  }, 60 * 60 * 1000);
}

async function stopWorkingSession() {
  if (!state.sessionId) return;
  const payload = {
    sessionId: state.sessionId,
    startedAt: state.sessionStartedAt,
    endedAt: new Date().toISOString(),
    readings: state.sessionReadings,
    symptoms: state.sessionSymptoms,
    thresholds: state.thresholds,
    sensitivityProfile: state.surveyCompleted ? state.sensitivityProfile : null,
    deviceSpecs: state.deviceSpecs,
  };
  state.sessionStore.unshift(payload);
  state.sessionStore = state.sessionStore.slice(0, 20);
  persist("circaair-sessions", state.sessionStore);

  try {
    await fetch("/api/session-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("Session upload unavailable; data remains in local storage.", error);
  }
  if (state.profileRecalculationTimer) {
    clearInterval(state.profileRecalculationTimer);
    state.profileRecalculationTimer = null;
  }
  state.sessionId = null;
  state.sessionStartedAt = null;
  state.sessionReadings = [];
  state.sessionSymptoms = [];
  loadUploadedSessionData();
}

async function loadUploadedSessionData() {
  try {
    const response = await fetch("/api/session-data", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    if (Array.isArray(payload.sessions) && payload.sessions.length) {
      state.sessionStore = payload.sessions;
      persist("circaair-sessions", state.sessionStore);
    }
  } catch (error) {
    console.warn("Could not pull uploaded sessions.", error);
  }
}

window.addEventListener("hashchange", () => {
  state.route = location.hash.slice(1) || (state.authenticated ? "dashboard" : "login");
  render();
});
function appendLiveReading(reading) {
  const previousAir = state.air;
  const previousLux = state.lux;
  state.air = reading.airRaw ?? reading.airPpm;
  state.lux = reading.lightRaw ?? reading.lux;
  state.lastDataSync = reading.updatedAt || new Date().toISOString();
  state.environmentHistory.push({
    timestamp: state.lastDataSync,
    airRaw: state.air,
    lightRaw: state.lux,
  });
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  state.environmentHistory = state.environmentHistory.filter(sample =>
    new Date(sample.timestamp).getTime() >= cutoff
  );
  if (state.working) {
    state.sessionReadings.push({
      timestamp: state.lastDataSync,
      airRaw: state.air,
      lightRaw: state.lux,
    });
  }
  return { previousAir, previousLux };
}

function applyLiveReading(reading) {
  const readingTime = reading.updatedAt || null;
  if (readingTime && readingTime === state.lastAppliedReadingAt) return;
  const { previousAir, previousLux } = appendLiveReading(reading);
  if (readingTime) state.lastAppliedReadingAt = readingTime;
  detectLiveEnvironmentNotifications(previousAir, previousLux);
  if (state.route !== "dashboard") return;
  const air = document.querySelector(".air-card .metric-value strong");
  const lux = document.querySelector(".light-card .metric-value strong");
  if (air) air.textContent = state.air;
  if (lux) lux.textContent = state.lux;
  const syncText = document.querySelector(".live-data-note");
  if (syncText) syncText.textContent = `Temporary manual collector · last sync: ${new Date(state.lastDataSync).toLocaleTimeString()}`;
  const chartCard = document.querySelector(".chart-card");
  if (chartCard) {
    const chartLines = buildChartLines(getChartData(state.selectedRange));
    chartCard.querySelector(".light-line")?.setAttribute("d", chartLines.light);
    chartCard.querySelector(".air-line")?.setAttribute("d", chartLines.air);
  }
}

async function pollLiveData() {
  if (!state.working) return;
  try {
    const response = await fetch("/api/live-data", { cache: "no-store" });
    if (!response.ok) throw new Error("Live data unavailable");
    const reading = await response.json();
    if (reading.updatedAt) applyLiveReading(reading);
  } catch (error) {
    console.warn(error.message);
  }
}

setInterval(() => {
  if (state.working) pollLiveData();
}, state.updateIntervalMs);

async function initializeAuth0() {
  const config = window.CIRCAAIR_AUTH0_CONFIG || {};
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
        state.route = "onboarding";
        location.hash = "onboarding";
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
loadUploadedSessionData();

