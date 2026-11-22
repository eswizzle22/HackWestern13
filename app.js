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
  score: 84,
  air: 612,
  lux: 420,
  logs: 10,
  breakDue: false,
  deviceOnline: true,
  notificationsOpen: false,
  notifications: [
    { type: "warning", title: "Air quality rising", message: "CO2 equivalent has risen 120 ppm over the last two hours." },
    { type: "suggestion", title: "Take a screen break", message: "Your 45-minute focus interval ends in 18 minutes." },
    { type: "suggestion", title: "Great focus window", message: "Light and air quality are aligned for deep work right now." },
  ],
};

const routeMeta = {
  login: ["Welcome", "Sign in to CircaAir"],
  dashboard: ["Live dashboard", "Good morning, Alex"],
  onboarding: ["Sensitivity survey", "Personalize your guardian"],
  insights: ["Insights & triggers", "Your environment, decoded"],
  device: ["Device & settings", "CircaAir desk companion"],
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
        <a class="brand" href="#dashboard"><span class="brand-mark">◒</span><span>circa<span>air</span></span></a>
        <a class="user-chip ${state.route === "profile" ? "active" : ""}" href="#profile"><div class="avatar">${userInitials()}</div><div><strong>${escapeHtml(userName())}</strong><small>Profile & settings</small></div><span class="chevron">⌄</span></a>
        <nav aria-label="Main navigation">
          <p class="nav-label">Monitor</p>
          ${navItems.map(([id, icon, label]) => `<a class="nav-item ${state.route === id ? "active" : ""}" href="#${id}"><span class="nav-icon">${icon}</span>${label}</a>`).join("")}
        </nav>
        <div class="sidebar-footer"><div class="mini-device"><span class="status-dot"></span><div><strong>CircaAir One</strong><small>Online · synced now</small></div><span>›</span></div><small class="version">CircaAir prototype · v0.1</small></div>
      </aside>
      <main class="main">
        <header class="topbar"><div><p class="eyebrow">${meta[0]}</p><h1>${heading}</h1></div><div class="top-actions"><span class="live-pill"><span class="status-dot"></span> Live</span><button class="icon-button" data-action="toggle-notifications" aria-label="Notifications" aria-expanded="${state.notificationsOpen}">♢${state.notifications.length ? `<b>${state.notifications.length}</b>` : ""}</button><a class="avatar" href="#profile" aria-label="Profile & settings">${userInitials()}</a></div></header>
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

function dashboardPage() {
  return `
    ${profileBanner()}
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
    <section class="chart-card"><div class="chart-legend"><span><i class="legend-air"></i> Air quality</span><span><i class="legend-light"></i> Light level</span><span class="chart-note">Ideal range shown</span></div><div class="chart"><div class="ideal-band"></div><span class="y-label top">800</span><span class="y-label mid">500</span><span class="y-label bottom">200</span><svg viewBox="0 0 760 220" preserveAspectRatio="none" role="img" aria-label="Environmental trends chart"><path class="grid-line" d="M0 55H760M0 110H760M0 165H760"/><path class="light-line" d="M0 155 C55 148, 78 165, 125 142 S195 115, 245 130 S325 172, 380 130 S445 85, 505 105 S570 145, 620 108 S700 115, 760 75"/><path class="air-line" d="M0 110 C55 103, 95 120, 140 105 S215 115, 265 95 S325 110, 375 100 S430 118, 480 90 S540 105, 590 92 S670 104, 760 84"/></svg><div class="x-labels"><span>4 AM</span><span>6 AM</span><span>8 AM</span><span>Now</span></div></div></section>
    <aside class="intervention"><div class="intervention-icon">✦</div><div><p class="section-kicker">GEMINI SUGGESTION</p><h3>A great time for deep work</h3><p>Your light level is steady and air is fresh. This is your personal focus window.</p></div><button class="close-intervention" data-action="dismiss">×</button></aside>`;
}

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
  about: { title: "About you", heading: "Tell us about you", short: "personal details", icon: "person", fields: aboutFields, note: "Only your name is required. The rest is optional and helps CircaAir estimate your migraine risk. Your answers are stored with your account." },
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
  return `<main class="onboarding-page"><div class="onboarding-top"><span class="brand"><span class="brand-mark">◒</span><span>circa<span>air</span></span></span><div class="onboarding-progress" aria-hidden="true">${SECTION_ORDER.map((_, index) => `<span class="${index < step ? "filled" : ""}"></span>`).join("")}</div></div><form class="survey-card" id="survey-form" data-section="${section}"><span class="tile-icon">${icon(iconName)}</span><div class="step-count">0${step} <span>/ 0${TOTAL_STEPS}</span></div><h3>${heading}</h3>${note ? `<p class="privacy-note">${note}</p>` : ""}${fields()}<button class="primary-button" type="submit">${step === TOTAL_STEPS ? "Finish" : "Continue"} <span>→</span></button><button class="skip-button" type="button" data-action="skip-section">Skip this section</button></form></main>`;
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
        <div><p class="section-kicker">PROFILE</p><h3>${escapeHtml(userName())}</h3></div>
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
        <div class="profile-section-head"><span class="tile-icon small">${icon(iconName)}</span><div><p class="section-kicker">PROFILE</p><h3>${title}</h3></div></div>
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
        <div class="profile-section-head"><span class="tile-icon small">${icon("gear")}</span><div><p class="section-kicker">PROFILE</p><h3>System settings</h3></div></div>
        <label>Theme <select name="theme">${["light", "dark"].map(value => `<option value="${value}" ${settings.theme === value ? "selected" : ""}>${value[0].toUpperCase() + value.slice(1)}</option>`).join("")}</select></label>
        <label>Alert thresholds <select name="thresholdMode">${[["auto", "Auto-Learn"], ["manual", "Manual"]].map(([value, label]) => `<option value="${value}" ${settings.thresholdMode === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <label>Arduino LED Matrix alerts <input type="checkbox" name="ledAlerts" ${settings.ledAlerts ? "checked" : ""} /></label>
        <button class="primary-button" type="submit">Save settings</button>
      </form>
    </div>`;
}

// Shown on the dashboard until every survey section has been saved.
function profileBanner() {
  const missing = SECTION_ORDER.filter(section => !state.saved[section]).map(section => SECTIONS[section].short);
  if (!missing.length) return "";
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}` : missing[0];
  return `<aside class="profile-banner"><div><strong>Complete your profile</strong><p>Add your ${list} to personalize your alerts.</p></div><a class="outline-button small" href="#profile">Go to Profile →</a></aside>`;
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
    Object.assign(state, { authenticated: false, demoMode: false, user: null, needsSurvey: false, onboardingStep: 1, registered: false });
    location.hash = "login";
    render();
    return;
  }
  await state.auth.logout({ logoutParams: { returnTo: window.location.origin } });
}

function insightsPage() {
  return `<section class="hero-row"><div><p class="date-label">YOUR PERSONAL PROFILE</p><h2>Patterns worth knowing.</h2><p class="muted">CircaAir learns from your environment and how you feel in it.</p></div><span class="confidence-badge">✦ 85% confidence</span></section><section class="insight-grid"><article class="panel confidence-panel"><div class="panel-title"><div><p class="section-kicker">PROFILE CONFIDENCE</p><h3>Personalized</h3></div><div class="confidence-ring"><strong>85</strong><small>%</small></div></div><div class="confidence-bar"><span></span></div><p class="muted">Based on <b>${state.logs} symptom logs</b> and 7 days of environmental data.</p><div class="stage-row"><span>Baseline</span><span>Calibrating</span><b>Personalized</b></div></article><article class="panel"><div class="panel-title"><div><p class="section-kicker">GEMINI ANALYSIS</p><h3>Your top triggers</h3></div><span class="spark-icon">✦</span></div><div class="trigger"><span class="trigger-rank">01</span><div class="trigger-bar"><b>Air quality dips</b><span>Most common before brain fog</span><i><em style="width:82%"></em></i></div><strong>82%</strong></div><div class="trigger"><span class="trigger-rank">02</span><div class="trigger-bar"><b>Harsh light</b><span>Correlates with eye strain</span><i><em style="width:64%"></em></i></div><strong>64%</strong></div><div class="trigger"><span class="trigger-rank">03</span><div class="trigger-bar"><b>Late-day brightness</b><span>May affect sleep quality</span><i><em style="width:41%"></em></i></div><strong>41%</strong></div></article></section><section class="section-head"><div><p class="section-kicker">LAGGED CORRELATION</p><h3>Before your symptoms</h3></div><button class="outline-button small" data-action="log-symptom">＋ Log symptom</button></section><section class="panel correlation-panel"><div class="correlation-summary"><div class="correlation-stat"><strong>2h</strong><span>lookback window</span></div><div class="correlation-stat"><strong>7</strong><span>linked events</span></div><div class="correlation-copy"><span class="warning-dot"></span><p>Symptoms most often followed a <b>120+ ppm air quality rise</b> within two hours.</p></div></div><div class="history-list"><div><span class="history-time">YESTERDAY · 3:14 PM</span><b>Headache · severity 3/5</b><span>Air quality rose 154 ppm in prior 2 hours</span></div><div><span class="history-time">OCT 22 · 9:40 PM</span><b>Poor sleep · severity 4/5</b><span>Light stayed above 200 lux past wind-down</span></div></div></section>`;
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
    state.logs += 1;
    showToast(`${symptom} logged — Gemini will compare your last 2 hours.`);
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
    if (action === "skip-section") advanceSurvey(false);
    if (action === "sign-out") signOut();
  }));

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
});
setInterval(() => {
  if (state.route === "dashboard") {
    state.air += Math.round((Math.random() - 0.5) * 14);
    state.lux += Math.round((Math.random() - 0.5) * 30);
    const air = document.querySelector(".air-card .metric-value strong");
    const lux = document.querySelector(".light-card .metric-value strong");
    if (air) air.textContent = state.air;
    if (lux) lux.textContent = state.lux;
  }
}, 5000);

// Demo mode never touches the backend, so every demo session starts with the survey and nothing persists.
const demoBackend = { getUser: async () => null, registerUser: async () => {}, updateUser: async () => {} };
const backend = () => (state.demoMode ? demoBackend : window.CircaAirBackend);

// New users (not found in TigerData) see the survey; existing users go straight to the dashboard.
async function routeAfterLogin() {
  state.needsSurvey = false;
  state.registered = false;
  state.survey = defaultSurvey();
  state.saved = defaultSaved();
  state.settings = defaultSettings();
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
    showToast("Could not reach the CircaAir backend.");
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
