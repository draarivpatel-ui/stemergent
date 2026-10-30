'use strict';

/*
 * Wind chill tests against the National Weather Service formula:
 * 35.74 + 0.6215 T - 35.75 V^0.16 + 0.4275 T V^0.16, valid at or below 50 F
 * and wind speeds of 3 mph or more. Expected values were computed by hand
 * from the formula; the 20 F at 20 mph case matches the published NWS chart
 * value of 4 degrees.
 */
const test = require('node:test');
const assert = require('node:assert');
const engine = require('../js/forecast-engine.js');

test('wind chill matches the published chart case of 20 F at 20 mph', () => {
  assert.strictEqual(engine.windChill(20, 20), 4.2);
});

test('wind chill at 0 F and 10 mph', () => {
  assert.strictEqual(engine.windChill(0, 10), -15.9);
});

test('wind chill at the warm edge of the validity window, 50 F and 3 mph', () => {
  assert.strictEqual(engine.windChill(50, 3), 49.7);
});

test('wind chill at 3 mph near freezing', () => {
  assert.strictEqual(engine.windChill(3, 3), -3.5);
});

test('wind chill at negative temperature with a 25 mph wind', () => {
  assert.strictEqual(engine.windChill(-5, 25), -30.8);
});

test('wind chill at 30 F with a 60 mph wind', () => {
  assert.strictEqual(engine.windChill(30, 60), 10.2);
});

test('wind chill is undefined above 50 F', () => {
  assert.strictEqual(engine.windChill(51, 10), null);
  assert.strictEqual(engine.windChill(80, 15), null);
});

test('wind chill is undefined below 3 mph', () => {
  assert.strictEqual(engine.windChill(30, 2.5), null);
  assert.strictEqual(engine.windChill(0, 0), null);
});

test('wind chill returns null for invalid input', () => {
  assert.strictEqual(engine.windChill('cold', 10), null);
  assert.strictEqual(engine.windChill(20, undefined), null);
  assert.strictEqual(engine.windChill(NaN, 10), null);
});

test('wind chill falls as wind rises at a fixed temperature', () => {
  assert.ok(engine.windChill(30, 20) > engine.windChill(30, 40));
  assert.ok(engine.windChill(10, 15) > engine.windChill(10, 30));
});

test('wind chill falls as temperature drops at a fixed wind', () => {
  assert.ok(engine.windChill(20, 15) > engine.windChill(0, 15));
  assert.ok(engine.windChill(0, 15) > engine.windChill(-10, 15));
});

test('wind chill keeps one decimal place of precision', () => {
  const value = engine.windChill(15, 12);
  assert.strictEqual(Math.round(value * 10) / 10, value);
});
