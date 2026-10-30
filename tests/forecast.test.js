'use strict';

/*
 * Forecast engine tests: humidity math, fixture integrity, the hourly
 * forecast builder, categories, and the discussion templates.
 */
const test = require('node:test');
const assert = require('node:assert');
const engine = require('../js/forecast-engine.js');
const fixtures = require('../data/fixtures.js');

function close(actual, expected, tolerance) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    'expected ' + actual + ' to be within ' + tolerance + ' of ' + expected
  );
}

test('relative humidity is 100 percent when air and dew point match', () => {
  assert.strictEqual(engine.relativeHumidity(70, 70), 100);
  assert.strictEqual(engine.relativeHumidity(45, 45), 100);
});

test('relative humidity clamps to 100 when the dew point exceeds the air temperature', () => {
  assert.strictEqual(engine.relativeHumidity(50, 70), 100);
});

test('relative humidity matches the Magnus form reference value', () => {
  // 100 F air with a 75 F dew point is about 45 percent by hand calculation.
  close(engine.relativeHumidity(100, 75), 45.1, 1.0);
  // 80 F air with a 60 F dew point is about 50.5 percent by hand calculation.
  close(engine.relativeHumidity(80, 60), 50.5, 1.0);
});

test('relative humidity returns null for invalid input', () => {
  assert.strictEqual(engine.relativeHumidity('x', 5), null);
  assert.strictEqual(engine.relativeHumidity(80, undefined), null);
});

test('both fixtures are labeled synthetic with a clear notice', () => {
  ['summer', 'winter'].forEach((key) => {
    const fixture = fixtures[key];
    assert.strictEqual(fixture.metadata.synthetic, true, key + ' must be labeled synthetic');
    assert.ok(/invented/i.test(fixture.metadata.notice), key + ' notice must say values are invented');
    assert.ok(/National Weather Service/i.test(fixture.metadata.notice));
    assert.ok(fixture.label.indexOf('Synthetic') === 0, key + ' label must lead with Synthetic');
  });
});

test('fixtures carry complete hourly observations in ascending order', () => {
  ['summer', 'winter'].forEach((key) => {
    const obs = fixtures[key].observations;
    assert.ok(obs.length >= 24, key + ' needs at least a day of observations');
    for (let i = 0; i < obs.length; i++) {
      assert.strictEqual(typeof obs[i].temperatureF, 'number');
      assert.strictEqual(typeof obs[i].dewPointF, 'number');
      assert.strictEqual(typeof obs[i].windSpeedMph, 'number');
      assert.ok(obs[i].temperatureF > -40 && obs[i].temperatureF < 130);
      assert.ok(obs[i].windSpeedMph >= 0 && obs[i].windSpeedMph < 80);
      assert.ok(obs[i].cloudCoverPercent >= 0 && obs[i].cloudCoverPercent <= 100);
      if (i > 0) {
        assert.ok(obs[i].time > obs[i - 1].time, key + ' observation times must ascend');
      }
    }
  });
});

test('buildHourlyForecast returns the requested number of hours', () => {
  const result = engine.buildHourlyForecast(fixtures.summer.observations, { hours: 12 });
  assert.strictEqual(result.hours.length, 12);
  const short = engine.buildHourlyForecast(fixtures.summer.observations, { hours: 5 });
  assert.strictEqual(short.hours.length, 5);
});

test('buildHourlyForecast is deterministic for identical input', () => {
  const a = engine.buildHourlyForecast(fixtures.summer.observations, { hours: 12 });
  const b = engine.buildHourlyForecast(fixtures.summer.observations, { hours: 12 });
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
});

test('buildHourlyForecast starts one hour after the anchor observation', () => {
  const obs = fixtures.summer.observations;
  const result = engine.buildHourlyForecast(obs, { hours: 3 });
  assert.strictEqual(result.hours[0].time, '2026-06-02T11:00:00-05:00');
  assert.strictEqual(result.anchor, obs[obs.length - 1]);
});

test('forecast temperature peaks in the afternoon on the summer fixture', () => {
  const result = engine.buildHourlyForecast(fixtures.summer.observations, { hours: 12 });
  const peak = result.hours.reduce((a, b) => (b.temperatureF > a.temperatureF ? b : a));
  const hour = engine.hourOf(peak.time);
  assert.ok(hour >= 12 && hour <= 16, 'peak hour ' + hour + ' should fall in the afternoon');
});

test('forecast wind eases toward the floor across the window', () => {
  const result = engine.buildHourlyForecast(fixtures.summer.observations, { hours: 12 });
  assert.ok(result.hours[result.hours.length - 1].windSpeedMph < result.hours[0].windSpeedMph);
});

test('summer forecast activates heat index and keeps wind chill off', () => {
  const result = engine.buildHourlyForecast(fixtures.summer.observations, { hours: 12 });
  const warmest = result.hours.reduce((a, b) => (b.temperatureF > a.temperatureF ? b : a));
  assert.strictEqual(warmest.windChillF, null, 'wind chill must stay off above 50 F');
  assert.ok(result.hours.some((h) => h.heatIndexF !== null), 'some hours should carry a heat index');
  result.hours.forEach((h) => {
    if (h.heatIndexF !== null) {
      assert.ok(h.heatIndexF >= h.temperatureF, 'heat index should not sit below the air temperature here');
    }
  });
});

test('winter forecast activates wind chill and keeps heat index off', () => {
  const result = engine.buildHourlyForecast(fixtures.winter.observations, { hours: 12 });
  assert.ok(result.hours.every((h) => h.heatIndexF === null), 'no winter hour should reach 80 F');
  assert.ok(result.hours.some((h) => h.windChillF !== null), 'some hours should carry a wind chill');
});

test('buildHourlyForecast rejects empty or invalid requests', () => {
  assert.strictEqual(engine.buildHourlyForecast([], { hours: 12 }), null);
  assert.strictEqual(engine.buildHourlyForecast(null), null);
  assert.strictEqual(engine.buildHourlyForecast(fixtures.summer.observations, { hours: 0 }), null);
  assert.strictEqual(engine.buildHourlyForecast(fixtures.summer.observations, { hours: 500 }), null);
});

test('cloud cover categories span the full range', () => {
  assert.strictEqual(engine.cloudCategory(0), 'Clear');
  assert.strictEqual(engine.cloudCategory(10), 'Clear');
  assert.strictEqual(engine.cloudCategory(25), 'Mostly Clear');
  assert.strictEqual(engine.cloudCategory(45), 'Partly Cloudy');
  assert.strictEqual(engine.cloudCategory(75), 'Mostly Cloudy');
  assert.strictEqual(engine.cloudCategory(95), 'Cloudy');
  assert.strictEqual(engine.cloudCategory(100), 'Cloudy');
});

test('wind categories span the full range', () => {
  assert.strictEqual(engine.windCategory(2), 'Calm');
  assert.strictEqual(engine.windCategory(6), 'Light Wind');
  assert.strictEqual(engine.windCategory(12), 'Breezy');
  assert.strictEqual(engine.windCategory(20), 'Windy');
  assert.strictEqual(engine.windCategory(35), 'Very Windy');
});

test('hour labels read like a forecast clock', () => {
  assert.strictEqual(engine.hourLabel('2026-06-01T14:00:00-05:00'), '2 PM');
  assert.strictEqual(engine.hourLabel('2026-06-01T00:00:00-05:00'), '12 AM');
  assert.strictEqual(engine.hourLabel('2026-06-01T12:00:00-05:00'), '12 PM');
  assert.strictEqual(engine.hourLabel('2026-06-01T09:00:00-05:00'), '9 AM');
});

test('summer discussion names the heat index and gives heat advice', () => {
  const forecast = engine.buildHourlyForecast(fixtures.summer.observations, { hours: 12 });
  const discussion = engine.buildDiscussion(forecast);
  assert.ok(discussion.text.indexOf('heat index') !== -1);
  assert.ok(/water breaks|exertion|indoors/i.test(discussion.text));
  assert.ok(discussion.sentences.length >= 4);
});

test('winter discussion names the wind chill and gives cold advice', () => {
  const forecast = engine.buildHourlyForecast(fixtures.winter.observations, { hours: 12 });
  const discussion = engine.buildDiscussion(forecast);
  assert.ok(discussion.text.indexOf('wind chill') !== -1);
  assert.ok(/layers|gear|skin/i.test(discussion.text));
});

test('discussion text is deterministic and dash free', () => {
  const a = engine.buildDiscussion(engine.buildHourlyForecast(fixtures.summer.observations, { hours: 12 }));
  const b = engine.buildDiscussion(engine.buildHourlyForecast(fixtures.summer.observations, { hours: 12 }));
  assert.strictEqual(a.text, b.text);
  assert.strictEqual(/[\u2013\u2014]/.test(a.text), false, 'no en or em dashes allowed');
  assert.ok(a.text.endsWith('.'));
  assert.ok(a.headline.length > 0);
});

test('buildDiscussion handles a missing forecast gracefully', () => {
  assert.strictEqual(engine.buildDiscussion(null), null);
  assert.strictEqual(engine.buildDiscussion({ hours: [] }), null);
});
