const { test } = require("node:test");
const assert = require("node:assert/strict");
const { calculateThresholds: calc } = require("../src/thresholds");
const { DEFAULT_THRESHOLDS, airBand, lightBand, comfortScore } = require("../src/bands");

const MEDIUM = { light: "medium", dim: "medium", air: "medium", voc: "medium" };
const levels = ["low", "medium", "high"];

test("without a saved environment survey the defaults apply", () => {
  assert.deepEqual(calc({}), DEFAULT_THRESHOLDS);
  assert.deepEqual(calc({ sensitivities: null, recentSeverities: [9, 9, 9] }), DEFAULT_THRESHOLDS);
  assert.equal(DEFAULT_THRESHOLDS.calibrated, false);
});

test("medium sensitivity everywhere and no symptoms matches the defaults", () => {
  const result = calc({ sensitivities: MEDIUM });
  assert.equal(result.calibrated, true);
  assert.equal(result.source, "survey");
  for (const key of ["airCaution", "airPoor", "lightDim", "lightHarsh"]) assert.equal(result[key], DEFAULT_THRESHOLDS[key], key);
});

test("sensitive to stuffy air or odors makes air count as poor sooner", () => {
  assert.equal(calc({ sensitivities: { ...MEDIUM, air: "high" } }).airPoor, 670);
  assert.equal(calc({ sensitivities: { ...MEDIUM, air: "low" } }).airPoor, 730);
  assert.equal(calc({ sensitivities: { ...MEDIUM, voc: "high" } }).airPoor, 685);
  assert.equal(calc({ sensitivities: { ...MEDIUM, air: "high", voc: "high" } }).airPoor, 655);
  assert.equal(calc({ sensitivities: { ...MEDIUM, air: "high" } }).airCaution, 431, "caution keeps its share of the poor level");
});

test("sensitive to bright or dim light moves those limits", () => {
  assert.equal(calc({ sensitivities: { ...MEDIUM, light: "high" } }).lightHarsh, 342);
  assert.equal(calc({ sensitivities: { ...MEDIUM, light: "low" } }).lightHarsh, 570);
  assert.equal(calc({ sensitivities: { ...MEDIUM, dim: "high" } }).lightDim, 229);
  assert.equal(calc({ sensitivities: { ...MEDIUM, dim: "low" } }).lightDim, 137);
});

test("recent symptom ratings (1 to 10) lower the thresholds, up to 25 percent", () => {
  const severe = calc({ sensitivities: MEDIUM, recentSeverities: [10, 10, 10] }); // 5 out of 5 in the prototype's scale
  assert.equal(severe.source, "survey-and-symptoms");
  assert.equal(severe.airPoor, 670);
  assert.equal(severe.lightHarsh, 321);
  assert.equal(severe.lightDim, 137);
  const middling = calc({ sensitivities: MEDIUM, recentSeverities: [5, 5] }); // 2.5 out of 5
  assert.equal(middling.airPoor, 700, "a middling rating leaves air unchanged");
  assert.equal(middling.lightHarsh, 374);
});

test("Manual mode ignores symptoms, and no ratings means no adjustment", () => {
  assert.deepEqual(calc({ sensitivities: MEDIUM, recentSeverities: [10, 10], learn: false }), calc({ sensitivities: MEDIUM }));
  assert.deepEqual(calc({ sensitivities: MEDIUM, recentSeverities: [] }), calc({ sensitivities: MEDIUM }));
});

test("every combination stays sensible", () => {
  for (const light of levels) for (const dim of levels) for (const air of levels) for (const voc of levels) {
    for (const recentSeverities of [[], [1], [5], [10], [1, 10]]) for (const learn of [true, false]) {
      const result = calc({ sensitivities: { light, dim, air, voc }, recentSeverities, learn });
      const where = JSON.stringify({ light, dim, air, voc, recentSeverities, learn, result });
      assert.ok(result.airCaution < result.airPoor, where);
      assert.ok(result.lightDim < result.lightHarsh, where);
      assert.ok(result.airPoor >= 300 && result.airPoor <= 900, where);
      assert.ok(result.lightHarsh >= 60 && result.lightHarsh <= 600, where);
      assert.ok(result.lightDim >= 20, where);
    }
  }
});

test("bands and the score use the thresholds they are given", () => {
  assert.equal(airBand(690), "caution");
  assert.equal(airBand(690, { ...DEFAULT_THRESHOLDS, airPoor: 670 }), "poor");
  assert.equal(airBand(449), "good");
  assert.equal(airBand(450), "caution");
  assert.equal(airBand(null), null);
  assert.equal(lightBand(400), "good");
  assert.equal(lightBand(400, { ...DEFAULT_THRESHOLDS, lightHarsh: 342 }), "harsh");
  assert.equal(lightBand(100), "dim");
  assert.equal(lightBand(200, { ...DEFAULT_THRESHOLDS, lightDim: 229 }), "dim");
  assert.equal(comfortScore(200, 300), 100);
  assert.equal(comfortScore(800, 300), 40);
  assert.ok(comfortScore(690, 300, { ...DEFAULT_THRESHOLDS, airPoor: 670 }) < comfortScore(690, 300), "a stricter limit lowers the score");
  assert.equal(comfortScore(null, 300), null);
});
