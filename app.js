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
    <section class="chart-card"><div class="chart-legend"><span><i class="legend-air"></i> Air quality</span><span><i class="legend-light"></i> Light level</span><span class="chart-note">Ideal range shown</span></div><div class="chart"><div class="ideal-band"></div><span class="y-label top">800</span><span class="y-label mid">500</span><span class="y-label bottom">200</span><svg viewBox="0 0 760 220" preserveAspectRatio="none" role="img" aria-label="Environmental trends chart"><path class="grid-line" d="M0 55H760M0 110H760M0 165H760"/><path class="light-line" d="M0 155 C55 148, 78 165, 125 142 S195 115, 245 130 S325 172, 380 130 S445 85, 505 105 S570 145, 620 108 S700 115, 760 75"/><path class="air-line" d="M0 110 C55 103, 95 120, 140 105 S215 115, 265 95 S325 110, 375 100 S430 118, 480 90 S540 105, 590 92 S670 104, 760 84"/></svg><div class="x-labels"><span>4 AM</span><span>6 AM</span><span>8 AM</span><span>Now</span></div></div></section>
    <aside class="intervention"><div class="intervention-icon">✦</div><div><p class="section-kicker">GEMINI SUGGESTION</p><h3>A great time for deep work</h3><p>Your light level is steady and air is fresh. This is your personal focus window.</p></div><button class="close-intervention" data-action="dismiss">×</button></aside>`;
}

function onboardingPage() {
  return `<section class="survey-wrap"><div class="survey-intro"><span class="large-mark">◒</span><p class="eyebrow">A LITTLE ABOUT YOU</p><h2>Make CircaAir<br/><em>personal.</em></h2><p>Tell us what your body notices first. We’ll use this to tune your alerts from day one.</p><div class="survey-progress"><span class="filled"></span><span class="filled"></span><span></span></div><small>Step 2 of 3 · Sensitivities</small></div><form class="survey-card" id="survey-form"><div class="step-count">02 <span>/ 03</span></div><h3>What are you sensitive to?</h3><p class="muted">Choose a sensitivity level for each. You can always change these later.</p><div class="sensitivity-list">${[["Bright or harsh light","Glare, screens, or direct sun","high"],["Dim or flickering rooms","Low light or inconsistent lighting","medium"],["Stuffy air","Feeling foggy in poorly ventilated spaces","high"],["Strong odors / VOCs","Perfume, cleaning products, or chemicals","medium"]].map((x,i) => `<div class="sensitivity-row"><div class="sense-icon">${["☼","◐","≋","✧"][i]}</div><div><strong>${x[0]}</strong><small>${x[1]}</small></div><select aria-label="${x[0]}"><option ${x[2] === "low" ? "selected" : ""}>Low</option><option ${x[2] === "medium" ? "selected" : ""}>Medium</option><option ${x[2] === "high" ? "selected" : ""}>High</option></select></div>`).join("")}</div><button class="primary-button" type="submit">Continue <span>→</span></button><button class="skip-button" type="button" data-action="skip-survey">Skip for now</button></form></section>`;
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
    const air = document.querySelector(".air-card .metric-value strong");
    const lux = document.querySelector(".light-card .metric-value strong");
    if (air) air.textContent = state.air;
    if (lux) lux.textContent = state.lux;
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
