window.CircaAirPages = window.CircaAirPages || {};

window.CircaAirPages.dashboard = function dashboardPage() {
  const chartSamples = getChartData(state.selectedRange);
  const chartLines = buildChartLines(chartSamples);
  const chartLabels = getChartAxisLabels(state.selectedRange);
  return `
    <section class="hero-row"><div><p class="date-label" id="dashboard-date">LIVE ENVIRONMENT</p><h2>Your space is supporting you.</h2><p class="muted">${state.working ? "Live updates are running." : "Data collection is stopped."}</p></div><button class="outline-button ${state.working ? "stop-working" : "start-working"}" type="button" data-action="${state.working ? "stop-working" : "start-working"}">${state.working ? "■ Stop working" : "▶ Start working"}</button></section>
    <section class="live-data-panel" aria-labelledby="live-data-heading">
      <div class="live-data-heading"><div><p class="section-kicker">TEMPORARY LIVE INPUT</p><h3 id="live-data-heading">Sensor data collector</h3></div><span class="live-status ${state.working ? "is-working" : ""}"><i></i>${state.working ? "Receiving" : "Stopped"}</span></div>
      <form id="live-data-form" class="live-data-form">
        <label>CO₂ equivalent<input id="live-air" name="airPpm" type="number" min="300" max="5000" value="${state.air}" required /><small>ppm</small></label>
        <label>Ambient light<input id="live-lux" name="lux" type="number" min="0" max="10000" value="${state.lux}" required /><small>lux</small></label>
        <button class="outline-button" type="submit">Insert live reading</button>
      </form>
      <p class="live-data-note">Temporary manual collector · last sync: ${state.lastDataSync ? escapeHtml(new Date(state.lastDataSync).toLocaleTimeString()) : "No reading yet"}</p>
    </section>
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
};
