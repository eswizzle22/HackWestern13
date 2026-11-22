// Default thresholds, used for anyone who has not saved the environment section of the survey. They follow the dashboard
// prototype's README (air and harsh light warn at 700 of 1023, dim light at 300), with light scaled to this sensor's 0 to 625
// range. Air: 0 is best. Light: 0 is darkest. See thresholds.js for the per-user version.
const DEFAULT_THRESHOLDS = { calibrated: false, source: "default", airCaution: 450, airPoor: 700, lightDim: 183, lightHarsh: 428 };

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const number = value => (value === null || value === undefined ? null : Number(value));

function airBand(air, thresholds = DEFAULT_THRESHOLDS) {
  air = number(air);
  if (air === null) return null;
  return air >= thresholds.airPoor ? "poor" : air >= thresholds.airCaution ? "caution" : "good";
}

function lightBand(light, thresholds = DEFAULT_THRESHOLDS) {
  light = number(light);
  if (light === null) return null;
  return light < thresholds.lightDim ? "dim" : light > thresholds.lightHarsh ? "harsh" : "good";
}

// PROVISIONAL 0 to 100 comfort score: up to 60 points lost for stale air and up to 40 for dim or harsh light.
// Replace this with the team's real circadian-alignment formula when it exists.
function comfortScore(air, light, thresholds = DEFAULT_THRESHOLDS) {
  air = number(air);
  light = number(light);
  if (air === null || light === null) return null;
  const airPenalty = 60 * clamp((air - 200) / (thresholds.airPoor - 100), 0, 1);
  const { lightDim, lightHarsh } = thresholds;
  const lightGap = light < lightDim ? (lightDim - light) / lightDim : light > lightHarsh ? (light - lightHarsh) / (625 - lightHarsh) : 0;
  return Math.round(100 - airPenalty - 40 * clamp(lightGap, 0, 1));
}

module.exports = {
  DEFAULT_THRESHOLDS,
  // Kept for the sample-data generator, which writes symptoms around the default levels.
  AIR_CAUTION: DEFAULT_THRESHOLDS.airCaution, AIR_POOR: DEFAULT_THRESHOLDS.airPoor,
  LIGHT_DIM_BELOW: DEFAULT_THRESHOLDS.lightDim, LIGHT_HARSH_ABOVE: DEFAULT_THRESHOLDS.lightHarsh,
  airBand, lightBand, comfortScore,
};
