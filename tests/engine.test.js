'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../js/forecast-engine.js');
const policy = require('../js/policy-tracker.js');
const fixtures = require('../data/fixtures.js');

test('engine pipeline: summer forecast peak heat index feeds into policy tracker Danger tier', () => {
  const forecast = engine.buildHourlyForecast(fixtures.summer.observations, { hours: 12 });
  assert.ok(forecast);
  const peakHi = forecast.hours
    .map((h) => h.heatIndexF)
    .filter((v) => v !== null)
    .reduce((a, b) => Math.max(a, b), -Infinity);
  assert.ok(peakHi >= 103 && peakHi < 125, 'summer peak heat index should fall in Danger band');

  const tracker = policy.createTracker();
  const flagged = tracker.addDecision({
    date: '2026-06-02',
    department: 'Athletics',
    activity: 'Afternoon Scrimmage',
    heatIndexF: peakHi,
    decision: 'Full Outdoor Activity',
    notes: 'Checked against summer fixture peak'
  });
  assert.equal(flagged.tier, 'Danger');
  assert.equal(flagged.compliance, 'Needs Review');

  const compliant = tracker.addDecision({
    date: '2026-06-02',
    department: 'Athletics',
    activity: 'Evening Walk-Through',
    heatIndexF: peakHi,
    decision: 'Moved Indoors',
    notes: 'Shifted to gym'
  });
  assert.equal(compliant.tier, 'Danger');
  assert.equal(compliant.compliance, 'Compliant');
});

test('engine pipeline: winter forecast keeps heat index null and computes wind chill', () => {
  const forecast = engine.buildHourlyForecast(fixtures.winter.observations, { hours: 12 });
  assert.ok(forecast);
  assert.equal(forecast.hours.every((h) => h.heatIndexF === null), true);
  const minWc = forecast.hours
    .map((h) => h.windChillF)
    .filter((v) => v !== null)
    .reduce((a, b) => Math.min(a, b), Infinity);
  assert.ok(minWc < 20, 'winter wind chill should drop below 20 F');
  const discussion = engine.buildDiscussion(forecast);
  assert.match(discussion.headline, /Cold|Bitter/i);
});
