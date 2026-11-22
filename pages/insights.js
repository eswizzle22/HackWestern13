window.ProdromePages = window.ProdromePages || {};

window.ProdromePages.insights = function insightsPage() {
  const topCorrelations = state.correlations;
  const recentSessions = state.sessionStore.slice(0, 3);
  const sessionRows = recentSessions.length
    ? recentSessions.map(session => {
      const start = new Date(session.startedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
      return `<div><span class="history-time">${escapeHtml(start)}</span><b>${session.readings?.length || 0} readings · ${session.symptoms?.length || 0} symptoms</b><span>${session.thresholds?.calibrated ? "Calibrated personalized thresholds" : "Default hazard thresholds"}</span></div>`;
    }).join("")
    : `<div><span class="history-time">NO SESSIONS</span><b>Start a working session</b><span>Session readings and symptoms will appear here when it ends.</span></div>`;
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
  <section class="section-head"><div><p class="section-kicker">UPLOADED SESSIONS</p><h3>Recent working sessions</h3></div></section>
  <section class="panel correlation-panel"><div class="history-list">${sessionRows}</div></section>
  <section class="section-head"><div><p class="section-kicker">LAGGED CORRELATION</p><h3>Before your symptoms</h3></div><button class="outline-button small" data-action="log-symptom">＋ Log symptom</button></section>
  <section class="panel correlation-panel">
    <div class="correlation-summary">
      <div class="correlation-stat"><strong>${INSIGHT_CONFIG.lookbackMinutes / 60}h</strong><span>lookback window</span></div>
      <div class="correlation-stat"><strong>${linkedEvents.length}</strong><span>linked events</span></div>
      <div class="correlation-copy"><span class="warning-dot"></span><p>${top ? `Symptoms appeared with <b>${escapeHtml(top.description)}</b> in the configured window.` : "Keep logging until the minimum threshold is reached."}</p></div>
    </div>
    <div class="history-list">${historyRows}</div>
  </section>`;
};
