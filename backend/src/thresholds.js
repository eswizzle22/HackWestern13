const { DEFAULT_THRESHOLDS } = require("./bands");

// Personalized thresholds, ported from the dashboard prototype. Each sensitivity from the survey becomes a weight, and
// recent symptoms nudge the numbers further when the user is on Auto-Learn.
//   - Sensitive to air or odors: air counts as poor sooner.
//   - Sensitive to bright light: light counts as harsh sooner. Sensitive to dim rooms: dim counts sooner.
//   - Recent symptoms (the last 10 with a rating): worse symptoms lower the thresholds by up to 25%.
// The prototype rated symptoms 1 to 5 and measured light 0 to 1023; here it is 1 to 10 and 0 to 625, so both are converted.

const WEIGHTS = { high: 1.25, medium: 1, low: 0.75 };
const weight = level => WEIGHTS[String(level).toLowerCase()] ?? 1;

const LIGHT_SCALE = 625 / 1023;
const BASE = { airPoor: 700, lightHarsh: 700 * LIGHT_SCALE, lightDim: 300 * LIGHT_SCALE };
const AIR_CAUTION_SHARE = DEFAULT_THRESHOLDS.airCaution / DEFAULT_THRESHOLDS.airPoor;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// sensitivities: { light, dim, air, voc } each "low" | "medium" | "high", or null when the survey section was never saved.
// recentSeverities: the user's last (up to 10) symptom ratings from 1 to 10. learn: false for Manual mode.
function calculateThresholds({ sensitivities = null, recentSeverities = [], learn = true } = {}) {
  if (!sensitivities) return { ...DEFAULT_THRESHOLDS };

  const learning = learn && recentSeverities.length > 0;
  const averageSeverity = learning ? recentSeverities.reduce((sum, value) => sum + value, 0) / recentSeverities.length / 2 : 0; // on the 1 to 5 scale
  const symptomFactor = learning ? 1 - Math.min(0.25, (averageSeverity / 5) * 0.25) : 1;
  const airLearning = learning ? -(averageSeverity - 2.5) * 12 : 0;

  const airPoor = clamp(Math.round(BASE.airPoor - (weight(sensitivities.air) - 1) * 120 - (weight(sensitivities.voc) - 1) * 60 + airLearning), 300, 900);
  const lightHarsh = clamp(Math.round((BASE.lightHarsh / weight(sensitivities.light)) * symptomFactor), 60, 600);
  const lightDim = clamp(Math.round(BASE.lightDim * weight(sensitivities.dim) * symptomFactor), 20, lightHarsh - 1);

  return {
    calibrated: true,
    source: learning ? "survey-and-symptoms" : "survey",
    airCaution: Math.round(airPoor * AIR_CAUTION_SHARE),
    airPoor,
    lightDim,
    lightHarsh,
  };
}

// Looks up what the thresholds need for one profile (its saved survey and settings, and its recent symptom ratings).
async function thresholdsFor(queryable, profile) {
  const sensitivities = (profile.survey && profile.survey.environment && profile.survey.environment.sensitivities) || null;
  const learn = !(profile.settings && profile.settings.thresholdMode === "manual");
  let recentSeverities = [];
  if (sensitivities && learn) {
    const { rows } = await queryable.query(
      "SELECT severity FROM symptom_logs WHERE user_id = $1 AND severity IS NOT NULL ORDER BY logged_at DESC LIMIT 10", [profile.user_id]
    );
    recentSeverities = rows.map(row => row.severity);
  }
  return calculateThresholds({ sensitivities, recentSeverities, learn });
}

module.exports = { calculateThresholds, thresholdsFor };
