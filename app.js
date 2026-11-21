const INSIGHT_CONFIG = {
  lookbackMinutes: 120,
  minimumLogs: 5,
  minimumConfidence: 60,
  symptomSeverityScale: 5,
  airRisePpm: 120,
  brightLux: 600,
  windDownLux: 200,
};

const now = Date.now();
const minutesAgo = minutes => new Date(now - minutes * 60 * 1000);

function createSimulatedEnvironment() {
  const samples = [];
  for (let minutes = 7 * 24 * 60; minutes >= 0; minutes -= 30) {
    const time = minutesAgo(minutes);
    const hour = time.getHours();
    const dayWave = hour >= 7 && hour <= 18 ? 520 : 380;
    const syntheticNoise = ((minutes * 37) % 90) - 45;
    const eventRise = minutes >= 165 && minutes <= 195 ? 155 : 0;
    const lateLightRise = hour >= 20 && hour <= 23 ? 90 : 0;
    samples.push({
      timestamp: time.toISOString(),
      airPpm: Math.max(380, dayWave + syntheticNoise + eventRise),
      lux: hour >= 7 && hour <= 18
        ? Math.max(300, 620 + ((minutes * 53) % 180) + lateLightRise)
        : Math.max(40, 210 + ((minutes * 29) % 180) + lateLightRise),
    });
  }
  return samples;
}

function createSimulatedSymptomLogs() {
  return [
    { symptom: "Headache", offsetMinutes: 190, severity: 3, airPpm: 154 },
    { symptom: "Headache", offsetMinutes: 1560, severity: 4, airPpm: 148 },
    { symptom: "Brain fog", offsetMinutes: 480, severity: 3, airPpm: 136 },
    { symptom: "Eye strain", offsetMinutes: 300, severity: 4, lux: 760 },
    { symptom: "Irritated eyes", offsetMinutes: 1320, severity: 3, lux: 710 },
    { symptom: "Poor sleep", offsetMinutes: 260, severity: 4, lux: 260 },
    { symptom: "Fatigue", offsetMinutes: 920, severity: 2, airPpm: 130 },
    { symptom: "Brain fog", offsetMinutes: 2200, severity: 3, airPpm: 145 },
    { symptom: "Eye strain", offsetMinutes: 2880, severity: 2, lux: 680 },
    { symptom: "Poor sleep", offsetMinutes: 3900, severity: 5, lux: 240 },
  ].map((item, index) => ({
    id: `sim-${index + 1}`,
    symptom: item.symptom,
    severity: item.severity,
    timestamp: minutesAgo(item.offsetMinutes).toISOString(),
    simulated: true,
    context: { airPpm: item.airPpm, lux: item.lux },
  }));
}

function calculateCorrelations(symptomLogs, environment) {
  const candidates = [
    {
      id: "air-rise",
      title: "Air quality rise",
      description: "CO₂-equivalent rise of 120+ ppm",
      symptomTypes: ["Headache", "Brain fog", "Fatigue"],
      measure: "airPpm",
      threshold: (sample, prior) => prior && sample.airPpm - prior.airPpm >= INSIGHT_CONFIG.airRisePpm,
    },
    {
      id: "bright-light",
      title: "Bright or harsh light",
      description: "Light at or above 600 lux",
      symptomTypes: ["Eye strain", "Irritated eyes"],
      measure: "lux",
      threshold: (sample) => sample.lux >= INSIGHT_CONFIG.brightLux,
    },
    {
      id: "late-light",
      title: "Late-day brightness",
      description: "Light at or above 200 lux near wind-down",
      symptomTypes: ["Poor sleep"],
      measure: "lux",
      threshold: (sample) => {
        const hour = new Date(sample.timestamp).getHours();
        return hour >= 20 && sample.lux >= INSIGHT_CONFIG.windDownLux;
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

const simulatedEnvironment = createSimulatedEnvironment();
const initialSymptomLogs = createSimulatedSymptomLogs();

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
  insightConfig: INSIGHT_CONFIG,
  environmentHistory: simulatedEnvironment,
  symptomLogs: initialSymptomLogs,
  correlations: [],
  geminiStatus: "fallback",
  generatedCopy: null,
  notifications: [
    { type: "warning", title: "Air quality rising", message: "CO2 equivalent has risen 120 ppm over the last two hours." },
    { type: "suggestion", title: "Take a screen break", message: "Your 45-minute focus interval ends in 18 minutes." },
    { type: "suggestion", title: "Great focus window", message: "Light and air quality are aligned for deep work right now." },
  ],
};

state.logs = state.symptomLogs.length;
state.correlations = calculateCorrelations(state.symptomLogs, state.environmentHistory);
state.generatedCopy = getFallbackCopy();
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
        <header class="topbar"><div><p class="eyebrow">${meta[0]}</p><h1>${meta[1]}</h1></div><div class="top-actions"><span class="live-pill"><span class="status-dot"></span> Live</span><button class="icon-button" data-action="toggle-notifications" aria-label="Notifications" aria-expanded="${state.notificationsOpen}">♢${state.notifications.length ? `<b>${state.notifications.length}</b>` : ""}</button><div class="avatar">AC</div></div></header>
        <div class="content">${pageContent()}</div>
      </main>
    </div>
    ${notificationCenter()}`;
  bindEvents();
}

function pageContent() {
  if (state.route === "onboarding") return onboardingPage();
  if (state.route === "insights") return insightsPage();
  if (state.route === "device") return devicePage();
  return dashboardPage();
}

function loginPage() {
  const userName = state.user?.name || state.user?.nickname;
  return `
    <main class="auth-page">
      <section class="auth-brand-panel" aria-label="CircaAir introduction">
        <a class="brand auth-brand" href="#login"><span class="brand-mark">◒</span><span>circa<span>air</span></span></a>
        <div class="auth-visual">
          <div class="auth-orbit orbit-one"></div>
          <div class="auth-orbit orbit-two"></div>
          <div class="auth-sun"><span>☀</span></div>
          <div class="auth-status-card">
            <span class="status-dot"></span>
            <div><strong>Space is in balance</strong><small>Air and light are aligned</small></div>
          </div>
        </div>
        <div class="auth-quote"><p class="eyebrow">YOUR ENVIRONMENTAL GUARDIAN</p><h1>A calmer space starts with awareness.</h1></div>
      </section>
      <section class="auth-form-panel">
        <div class="auth-card">
          <p class="eyebrow">WELCOME TO CIRCAAIR</p>
          <h2>${userName ? `Welcome, ${escapeHtml(userName)}` : "Sign in to your space"}</h2>
          <p class="auth-lede">${state.demoMode ? "Explore the protected prototype without an account." : "Use Auth0 to securely access your personal environment, insights, and CircaAir One."}</p>
          <button class="auth-primary" type="button" data-auth-action="login">
            <span class="auth-button-mark">◒</span>
            <span>${state.authReady ? "Continue with Auth0" : "Prepare secure sign in"}</span>
            <span aria-hidden="true">→</span>
          </button>
          ${state.authConfigured ? "" : `<p class="auth-config-note"><strong>Demo mode</strong> · Add your Auth0 domain and client ID in <code>index.html</code> to enable secure login.</p>`}
          <div class="auth-divider"><span>or</span></div>
          <button class="auth-demo" type="button" data-auth-action="demo">Explore the demo</button>
          <p class="auth-privacy">By continuing, you agree to CircaAir’s privacy and use policies.</p>
        </div>
      </section>
    </main>`;
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
        airPpm: Math.round(before.airPpm + (after.airPpm - before.airPpm) * mix),
        lux: Math.round(before.lux + (after.lux - before.lux) * mix),
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
    air: lineFor(sample => sample.airPpm, 200, 800),
    light: lineFor(sample => sample.lux, 40, 800),
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
      airBand: state.air >= 800 ? "elevated" : state.air >= 600 ? "moderate" : "low",
      lightBand: state.lux >= 600 ? "bright" : state.lux >= 200 ? "moderate" : "dim",
      timeOfDayBand: new Date().getHours() >= 20 ? "wind-down" : "daytime",
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

function dashboardPage() {
  const chartSamples = getChartData(state.selectedRange);
  const chartLines = buildChartLines(chartSamples);
  const chartLabels = getChartAxisLabels(state.selectedRange);
  return `
    <section class="hero-row"><div><p class="date-label">TUESDAY, OCTOBER 24 · 9:42 AM</p><h2>Your space is supporting you.</h2><p class="muted">Both air and light are aligned with your morning routine.</p></div><button class="outline-button" data-action="log-symptom">＋ Log a symptom</button></section>
    <section class="symptom-section" id="symptom-log" aria-labelledby="symptom-heading">
      <div class="symptom-heading"><div><p class="section-kicker">QUICK CHECK-IN</p><h3 id="symptom-heading">Log a symptom</h3></div><p>Tap what you notice. CircaAir will look for patterns.</p></div>
      <div class="symptom-buttons">
        ${[
          ["Headache", "◌"],
          ["Eye strain", "☼"],
          ["Brain fog", "≋"],
          ["Fatigue", "◒"],
          ["Irritated eyes", "◉"],
          ["Poor sleep", "☾"],
        ].map(([label, icon]) => `<button type="button" class="symptom-button" data-symptom="${label}"><span>${icon}</span>${label}</button>`).join("")}
      </div>
    </section>
    <section class="score-card">
      <div class="score-copy"><div class="section-kicker">CIRCADIAN ALIGNMENT</div><div class="score-line"><strong>${state.score}</strong><span>/ 100</span><span class="good-tag">Excellent</span></div><p>Your environment is in a healthy range for focus right now.</p><div class="score-track"><span style="width:${state.score}%"></span></div><div class="scale"><span>Needs attention</span><span>Optimal</span></div></div>
      <div class="orb"><div class="orb-inner"><span>☀</span><small>Morning<br/>focus</small></div></div>
      <div class="score-meta"><div><span>Last updated</span><strong>Just now</strong></div><div><span>Profile confidence</span><strong>85% <a href="#insights">View insights →</a></strong></div></div>
    </section>
    <section class="section-head"><div><p class="section-kicker">RIGHT NOW</p><h3>Environmental snapshot</h3></div><span class="sync-text"><span class="status-dot"></span> Synced from CircaAir One</span></section>
    <section class="metric-grid">
      <article class="metric-card air-card"><div class="metric-header"><div class="metric-icon">≋</div><span class="good-tag">Good</span></div><p class="metric-label">AIR QUALITY</p><div class="metric-value"><strong>${state.air}</strong><span>ppm CO₂ eq.</span></div><p class="metric-note">Comfortable for focus · <b>Low VOCs</b></p><div class="sparkline air-spark"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
      <article class="metric-card light-card"><div class="metric-header"><div class="metric-icon">☼</div><span class="good-tag">Aligned</span></div><p class="metric-label">AMBIENT LIGHT</p><div class="metric-value"><strong>${state.lux}</strong><span>lux</span></div><p class="metric-note">Ideal for morning focus · <b>Soft daylight</b></p><div class="sparkline light-spark"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
      <article class="metric-card break-card"><div class="metric-header"><div class="metric-icon">☕</div><span class="break-tag">In 18 min</span></div><p class="metric-label">NEXT BREAK</p><div class="metric-value"><strong>10:00</strong><span>AM</span></div><p class="metric-note">You’ve been focused for <b>32 minutes</b></p><button class="text-button" data-action="start-break">Start break timer →</button></article>
    </section>
    <section class="section-head chart-head"><div><p class="section-kicker">ENVIRONMENTAL TRENDS</p><h3>How your space has felt</h3></div><div class="range-tabs">${["15m","6h","24h","7d"].map(r => `<button class="${state.selectedRange === r ? "selected" : ""}" data-range="${r}">${r}</button>`).join("")}</div></section>
    <section class="chart-card"><div class="chart-legend"><span><i class="legend-air"></i> Air quality</span><span><i class="legend-light"></i> Light level</span><span class="chart-note">${escapeHtml(state.selectedRange)} window</span></div><div class="chart"><div class="ideal-band"></div><span class="y-label top">800</span><span class="y-label mid">500</span><span class="y-label bottom">200</span><svg viewBox="0 0 760 220" preserveAspectRatio="none" role="img" aria-label="Environmental trends chart for ${escapeHtml(state.selectedRange)}"><path class="grid-line" d="M0 55H760M0 110H760M0 165H760"/><path class="light-line" d="${chartLines.light}"/><path class="air-line" d="${chartLines.air}"/></svg><div class="x-labels">${chartLabels.map(label => `<span>${escapeHtml(label)}</span>`).join("")}</div></div></section>
    <aside class="intervention"><div class="intervention-icon">✦</div><div><p class="section-kicker">${state.geminiStatus === "generated" ? "GEMINI SUGGESTION" : "FALLBACK SUGGESTION"}</p><h3>${escapeHtml(state.generatedCopy?.intervention || "Keep logging symptoms")}</h3><p>${escapeHtml(state.generatedCopy?.detail || "Continue for a few more logs to improve pattern confidence.")}</p><small>Pattern support only — not a medical diagnosis or proven cause.</small></div><button class="close-intervention" data-action="dismiss">×</button></aside>`;
}

function onboardingPage() {
  return `<section class="survey-wrap"><div class="survey-intro"><span class="large-mark">◒</span><p class="eyebrow">A LITTLE ABOUT YOU</p><h2>Make CircaAir<br/><em>personal.</em></h2><p>Tell us what your body notices first. We’ll use this to tune your alerts from day one.</p><div class="survey-progress"><span class="filled"></span><span class="filled"></span><span></span></div><small>Step 2 of 3 · Sensitivities</small></div><form class="survey-card" id="survey-form"><div class="step-count">02 <span>/ 03</span></div><h3>What are you sensitive to?</h3><p class="muted">Choose a sensitivity level for each. You can always change these later.</p><div class="sensitivity-list">${[["Bright or harsh light","Glare, screens, or direct sun","high"],["Dim or flickering rooms","Low light or inconsistent lighting","medium"],["Stuffy air","Feeling foggy in poorly ventilated spaces","high"],["Strong odors / VOCs","Perfume, cleaning products, or chemicals","medium"]].map((x,i) => `<div class="sensitivity-row"><div class="sense-icon">${["☼","◐","≋","✧"][i]}</div><div><strong>${x[0]}</strong><small>${x[1]}</small></div><select aria-label="${x[0]}"><option ${x[2] === "low" ? "selected" : ""}>Low</option><option ${x[2] === "medium" ? "selected" : ""}>Medium</option><option ${x[2] === "high" ? "selected" : ""}>High</option></select></div>`).join("")}</div><button class="primary-button" type="submit">Continue <span>→</span></button><button class="skip-button" type="button" data-action="skip-survey">Skip for now</button></form></section>`;
}

function insightsPage() {
  const topCorrelations = state.correlations;
  const profileConfidence = topCorrelations.length
    ? Math.round(topCorrelations.reduce((sum, item) => sum + item.confidence, 0) / topCorrelations.length)
    : 0;
  const triggerRows = topCorrelations.length
    ? topCorrelations.slice(0, 3).map((item, index) => `
      <div class="trigger">
        <span class="trigger-rank">${String(index + 1).padStart(2, "0")}</span>
        <div class="trigger-bar"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.description)}</span><i><em style="width:${item.confidence}%"></em></i></div>
        <strong>${item.confidence}%</strong>
      </div>`).join("")
    : `<p class="muted">No confidence-qualified correlation yet. Minimum: ${INSIGHT_CONFIG.minimumLogs} symptom logs.</p>`;
  const top = topCorrelations[0];
  const linkedEvents = top?.linkedEvents || [];
  const historyRows = linkedEvents.slice(0, 4).map(event => {
    const date = new Date(event.log.timestamp);
    return `<div>
      <span class="history-time">${date.toLocaleDateString([], { month: "short", day: "numeric" }).toUpperCase()} · ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
      <b>${escapeHtml(event.log.symptom)} · severity ${event.log.severity}/${INSIGHT_CONFIG.symptomSeverityScale}</b>
      <span>${escapeHtml(top.description)} in the prior ${INSIGHT_CONFIG.lookbackMinutes / 60} hours</span>
    </div>`;
  }).join("") || `<div><span class="history-time">WAITING</span><b>Keep logging</b><span>No threshold-qualified event in this window.</span></div>`;

  return `<section class="hero-row">
    <div><p class="date-label">YOUR PERSONAL PROFILE</p><h2>Patterns worth knowing.</h2><p class="muted">Calculated from your logs and simulated environmental history.</p></div>
    <span class="confidence-badge">✦ ${profileConfidence}% confidence</span>
  </section>
  <section class="insight-grid">
    <article class="panel confidence-panel">
      <div class="panel-title"><div><p class="section-kicker">PROFILE CONFIDENCE</p><h3>${profileConfidence >= INSIGHT_CONFIG.minimumConfidence ? "Calibrating" : "Baseline"}</h3></div><div class="confidence-ring"><strong>${profileConfidence}</strong><small>%</small></div></div>
      <div class="confidence-bar"><span style="width:${profileConfidence}%"></span></div>
      <p class="muted">Based on <b>${state.logs} symptom logs</b>, a ${INSIGHT_CONFIG.lookbackMinutes}-minute window, and simulated 7-day environmental data.</p>
      <div class="stage-row"><span>Baseline</span><b>Calculated correlation</b></div>
    </article>
    <article class="panel">
      <div class="panel-title"><div><p class="section-kicker">${state.geminiStatus === "generated" ? "GEMINI ANALYSIS" : "CALCULATED ANALYSIS"}</p><h3>Your top correlations</h3></div><span class="spark-icon">✦</span></div>
      ${triggerRows}
    </article>
  </section>
  <p class="correlation-disclaimer"><strong>Correlation is not medical causation.</strong> These patterns are observation-based support and may reflect other factors.</p>
  <section class="section-head"><div><p class="section-kicker">LAGGED CORRELATION</p><h3>Before your symptoms</h3></div><button class="outline-button small" data-action="log-symptom">＋ Log symptom</button></section>
  <section class="panel correlation-panel">
    <div class="correlation-summary">
      <div class="correlation-stat"><strong>${INSIGHT_CONFIG.lookbackMinutes / 60}h</strong><span>lookback window</span></div>
      <div class="correlation-stat"><strong>${linkedEvents.length}</strong><span>linked events</span></div>
      <div class="correlation-copy"><span class="warning-dot"></span><p>${top ? `Symptoms appeared with <b>${escapeHtml(top.description)}</b> in the configured window.` : "Keep logging until the minimum threshold is reached."}</p></div>
    </div>
    <div class="history-list">${historyRows}</div>
  </section>`;
}

function devicePage() {
  const pixels = Array.from({length: 104}, (_, i) => `<i class="${[8,9,10,19,20,21,30,31,32,33,42,43,52,53,54,64,65,66,75,76,77,86,87,88,89,98,99,100].includes(i) ? "on" : ""}"></i>`).join("");
  return `<section class="hero-row"><div><p class="date-label">CONNECTED HARDWARE</p><h2>Your calm, on the desk.</h2><p class="muted">Manage your CircaAir One and tailor how it supports you.</p></div><span class="online-badge"><span class="status-dot"></span> Online</span></section><section class="device-grid"><article class="panel device-preview"><div class="panel-title"><div><p class="section-kicker">LED MATRIX MIRROR</p><h3>CircaAir One</h3></div><span class="device-id">CA-0018</span></div><div class="matrix-shell"><div class="matrix">${pixels}</div></div><p class="matrix-caption">Showing <b>Good air + light</b> pattern</p><button class="outline-button" data-action="test-pattern">Send test pattern</button></article><article class="panel settings-panel"><p class="section-kicker">DEVICE STATUS</p><div class="setting-row"><span>Air quality sensor</span><b class="setting-good">Connected</b></div><div class="setting-row"><span>Light sensor</span><b class="setting-good">Connected</b></div><div class="setting-row"><span>Last sync</span><b>Just now</b></div><hr/><p class="section-kicker">BREAK REMINDERS</p><label class="setting-control"><span>Focus interval <small>Time between break nudges</small></span><select><option>45 minutes</option><option>50 minutes</option><option>60 minutes</option></select></label><label class="setting-control"><span>Eye rest mode <small>Shorter intervals for screen time</small></span><input type="checkbox" checked /></label><hr/><p class="section-kicker">CIRCadian SCHEDULE</p><div class="time-pair"><label>Wake up<input type="time" value="07:00" /></label><label>Wind down<input type="time" value="22:00" /></label></div></article></section>`;
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
    const symptom = button.dataset.symptom;
    const severityInput = window.prompt(`Rate ${symptom} severity from 1 (mild) to 5 (high):`, "3");
    const severity = Number(severityInput);
    if (!Number.isInteger(severity) || severity < 1 || severity > INSIGHT_CONFIG.symptomSeverityScale) {
      showToast("Symptom not logged. Enter a severity from 1 to 5.");
      return;
    }
    state.symptomLogs.push({
      id: `log-${Date.now()}`,
      symptom,
      severity,
      timestamp: new Date().toISOString(),
      simulated: false,
      context: { airPpm: state.air, lux: state.lux },
    });
    state.logs += 1;
    state.correlations = calculateCorrelations(state.symptomLogs, state.environmentHistory);
    generateGeminiCopy();
    showToast(`${symptom} severity ${severity}/5 logged — comparing the prior ${INSIGHT_CONFIG.lookbackMinutes / 60} hours.`);
  }));
  document.querySelectorAll("[data-dismiss-notification]").forEach(button => button.addEventListener("click", () => {
    state.notifications.splice(Number(button.dataset.dismissNotification), 1);
    render();
  }));
  document.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", event => {
    const action = event.currentTarget.dataset.action;
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
  if (form) form.addEventListener("submit", event => { event.preventDefault(); showToast("Your sensitivity profile is saved."); setTimeout(() => { location.hash = "dashboard"; }, 800); });
}

window.addEventListener("hashchange", () => {
  state.route = location.hash.slice(1) || (state.authenticated ? "dashboard" : "login");
  render();
});
setInterval(() => {
  if (state.route === "dashboard") {
    state.air += Math.round((Math.random() - 0.5) * 14);
    state.lux += Math.round((Math.random() - 0.5) * 30);
    state.environmentHistory.push({
      timestamp: new Date().toISOString(),
      airPpm: state.air,
      lux: state.lux,
    });
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    state.environmentHistory = state.environmentHistory.filter(sample =>
      new Date(sample.timestamp).getTime() >= cutoff
    );
    const air = document.querySelector(".air-card .metric-value strong");
    const lux = document.querySelector(".light-card .metric-value strong");
    if (air) air.textContent = state.air;
    if (lux) lux.textContent = state.lux;
    const chartCard = document.querySelector(".chart-card");
    if (chartCard) {
      const chartLines = buildChartLines(getChartData(state.selectedRange));
      chartCard.querySelector(".light-line")?.setAttribute("d", chartLines.light);
      chartCard.querySelector(".air-line")?.setAttribute("d", chartLines.air);
      const chartNote = chartCard.querySelector(".chart-note");
      if (chartNote) chartNote.textContent = `${state.selectedRange} window`;
    }
  }
}, 5000);

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

