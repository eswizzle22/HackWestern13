// Thresholds follow the dashboard prototype's README (air and harsh light warn at 700 of 1023), with
// light scaled to the sensor's 0 to 625 range. Air: 0 is best. Light: 0 is darkest.
const AIR_CAUTION = 450;
const AIR_POOR = 700;
const LIGHT_DIM_BELOW = 180;
const LIGHT_HARSH_ABOVE = 430;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const number = value => (value === null || value === undefined ? null : Number(value));

function airBand(air) {
  air = number(air);
  if (air === null) return null;
  return air >= AIR_POOR ? "poor" : air >= AIR_CAUTION ? "caution" : "good";
}

function lightBand(light) {
  light = number(light);
  if (light === null) return null;
  return light < LIGHT_DIM_BELOW ? "dim" : light > LIGHT_HARSH_ABOVE ? "harsh" : "good";
}

// PROVISIONAL 0 to 100 comfort score: up to 60 points lost for stale air and up to 40 for dim or harsh light.
// Replace this with the team's real circadian-alignment formula when it exists.
function comfortScore(air, light) {
  air = number(air);
  light = number(light);
  if (air === null || light === null) return null;
  const airPenalty = 60 * clamp((air - 200) / 600, 0, 1);
  const lightGap = light < LIGHT_DIM_BELOW ? (LIGHT_DIM_BELOW - light) / LIGHT_DIM_BELOW : light > LIGHT_HARSH_ABOVE ? (light - LIGHT_HARSH_ABOVE) / (625 - LIGHT_HARSH_ABOVE) : 0;
  return Math.round(100 - airPenalty - 40 * clamp(lightGap, 0, 1));
}

module.exports = { AIR_CAUTION, AIR_POOR, LIGHT_DIM_BELOW, LIGHT_HARSH_ABOVE, airBand, lightBand, comfortScore };
