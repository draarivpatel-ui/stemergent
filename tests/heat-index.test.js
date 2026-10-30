'use strict';

/*
 * Heat index tests against the National Weather Service algorithm.
 * Anchor values below were derived by hand from the published formula:
 * simple Steadman form first, Rothfusz regression when the average of the
 * air temperature and the simple result reaches 80, then the low humidity
 * and high humidity adjustments.
 */
const test = require('node:test');
const assert = require('node:assert');
const engine = require('../js/forecast-engine.js');

test('heat index is undefined below 80 degrees', () => {
  assert.strictEqual(engine.heatIndex(79, 50), null);
  assert.strictEqual(engine.heatIndex(60, 90), null);
});

test('heat index returns null for invalid input', () => {
  assert.strictEqual(engine.heatIndex('hot', 50), null);
  assert.strictEqual(engine.heatIndex(90, null), null);
  assert.strictEqual(engine.heatIndex(NaN, 50), null);
});

test('heat index uses the simple branch when its average stays under 80', () => {
  // Simple formula at 80 F and 20 percent: 78.64, average 79.32, so the
  // simple value stands and rounds to 79.
  assert.strictEqual(engine.heatIndex(80, 20), 79);
});

test('heat index matches the published worked example at 96 F and 65 percent', () => {
  // Rothfusz regression by hand gives 120.98, which rounds to 121.
  assert.strictEqual(engine.heatIndex(96, 65), 121);
});

test('heat index at the 80 F and 40 percent corner rounds to 80', () => {
  // Simple formula gives 79.58, average 79.79 stays under 80, rounds to 80.
  assert.strictEqual(engine.heatIndex(80, 40), 80);
});

test('heat index applies the high humidity adjustment above 85 percent', () => {
  // At 86 F and 88 percent the regression gives about 104.13 and the humid
  // adjustment adds 0.06, rounding to 104.
  assert.strictEqual(engine.heatIndex(86, 88), 104);
});

test('heat index applies the low humidity adjustment below 13 percent', () => {
  // At 100 F and 10 percent the regression gives about 94.75 and the dry
  // adjustment subtracts about 0.63, rounding to 94.
  assert.strictEqual(engine.heatIndex(100, 10), 94);
});

test('heat index lands in the danger range for the summer fixture peak', () => {
  // 103 F air with roughly 43 percent humidity computed from a 76 F dew point.
  const rh = engine.relativeHumidity(103, 76);
  const hi = engine.heatIndex(103, rh);
  assert.ok(hi >= 110 && hi <= 125, 'expected a danger range value, got ' + hi);
});

test('heat index rises with humidity at a fixed temperature', () => {
  assert.ok(engine.heatIndex(95, 70) > engine.heatIndex(95, 50));
  assert.ok(engine.heatIndex(90, 60) > engine.heatIndex(90, 40));
});

test('heat index always returns a whole number', () => {
  assert.strictEqual(Number.isInteger(engine.heatIndex(92, 55)), true);
  assert.strictEqual(Number.isInteger(engine.heatIndex(105, 45)), true);
});
