/*
 * Labeled synthetic observation fixtures for the STEMergent forecast engine.
 *
 * Every value below is invented. Nothing comes from the National Weather
 * Service or any real observation station. The fixtures exist so the engine,
 * the discussion templates, and the policy tracker can run and be tested
 * fully offline.
 *
 * Each fixture carries hourly observations with temperature, dew point, wind
 * speed, wind direction, and cloud cover. Times use a fixed UTC offset that
 * matches the fixture label; the engine parses these strings directly so
 * results never depend on the machine time zone.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.StemergentFixtures = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function observe(time, temperatureF, dewPointF, windSpeedMph, windDirection, cloudCoverPercent) {
    return {
      time: time,
      temperatureF: temperatureF,
      dewPointF: dewPointF,
      windSpeedMph: windSpeedMph,
      windDirection: windDirection,
      cloudCoverPercent: cloudCoverPercent
    };
  }

  var summer = {
    key: 'summer',
    label: 'Synthetic Summer Heat Wave',
    metadata: {
      synthetic: true,
      notice: 'All values in this fixture are invented for offline testing. No observations come from the National Weather Service or any real station.',
      units: { temperatureF: 'deg F', dewPointF: 'deg F', windSpeedMph: 'mph', cloudCoverPercent: 'percent' },
      periodStart: '2026-06-01T05:00:00-05:00',
      periodHours: 30
    },
    observations: [
      observe('2026-06-01T05:00:00-05:00', 82, 72, 6, 'S', 55),
      observe('2026-06-01T06:00:00-05:00', 85, 73, 7, 'S', 50),
      observe('2026-06-01T07:00:00-05:00', 88, 74, 8, 'S', 40),
      observe('2026-06-01T08:00:00-05:00', 91, 74, 9, 'S', 30),
      observe('2026-06-01T09:00:00-05:00', 94, 75, 10, 'S', 20),
      observe('2026-06-01T10:00:00-05:00', 97, 75, 11, 'S', 10),
      observe('2026-06-01T11:00:00-05:00', 99, 76, 12, 'S', 5),
      observe('2026-06-01T12:00:00-05:00', 101, 76, 12, 'S', 5),
      observe('2026-06-01T13:00:00-05:00', 102, 76, 11, 'S', 5),
      observe('2026-06-01T14:00:00-05:00', 103, 76, 11, 'S', 10),
      observe('2026-06-01T15:00:00-05:00', 102, 75, 10, 'S', 15),
      observe('2026-06-01T16:00:00-05:00', 100, 75, 9, 'S', 20),
      observe('2026-06-01T17:00:00-05:00', 97, 74, 9, 'S', 30),
      observe('2026-06-01T18:00:00-05:00', 93, 73, 8, 'S', 40),
      observe('2026-06-01T19:00:00-05:00', 90, 73, 8, 'S', 50),
      observe('2026-06-01T20:00:00-05:00', 87, 72, 7, 'S', 55),
      observe('2026-06-01T21:00:00-05:00', 85, 72, 7, 'S', 60),
      observe('2026-06-01T22:00:00-05:00', 84, 71, 6, 'S', 60),
      observe('2026-06-01T23:00:00-05:00', 82, 71, 6, 'S', 65),
      observe('2026-06-02T00:00:00-05:00', 81, 71, 5, 'S', 65),
      observe('2026-06-02T01:00:00-05:00', 80, 71, 5, 'S', 70),
      observe('2026-06-02T02:00:00-05:00', 79, 70, 5, 'S', 70),
      observe('2026-06-02T03:00:00-05:00', 79, 70, 5, 'S', 65),
      observe('2026-06-02T04:00:00-05:00', 80, 70, 5, 'S', 65),
      observe('2026-06-02T05:00:00-05:00', 81, 71, 5, 'S', 60),
      observe('2026-06-02T06:00:00-05:00', 84, 72, 6, 'S', 55),
      observe('2026-06-02T07:00:00-05:00', 87, 73, 7, 'S', 45),
      observe('2026-06-02T08:00:00-05:00', 90, 74, 8, 'S', 35),
      observe('2026-06-02T09:00:00-05:00', 93, 74, 9, 'S', 25),
      observe('2026-06-02T10:00:00-05:00', 97, 75, 11, 'S', 15)
    ]
  };

  var winter = {
    key: 'winter',
    label: 'Synthetic Winter Cold Snap',
    metadata: {
      synthetic: true,
      notice: 'All values in this fixture are invented for offline testing. No observations come from the National Weather Service or any real station.',
      units: { temperatureF: 'deg F', dewPointF: 'deg F', windSpeedMph: 'mph', cloudCoverPercent: 'percent' },
      periodStart: '2026-01-15T05:00:00-06:00',
      periodHours: 30
    },
    observations: [
      observe('2026-01-15T05:00:00-06:00', 24, 12, 14, 'N', 85),
      observe('2026-01-15T06:00:00-06:00', 22, 11, 15, 'N', 85),
      observe('2026-01-15T07:00:00-06:00', 21, 10, 16, 'N', 80),
      observe('2026-01-15T08:00:00-06:00', 20, 10, 16, 'N', 75),
      observe('2026-01-15T09:00:00-06:00', 22, 11, 14, 'N', 70),
      observe('2026-01-15T10:00:00-06:00', 26, 13, 12, 'N', 60),
      observe('2026-01-15T11:00:00-06:00', 30, 15, 10, 'N', 50),
      observe('2026-01-15T12:00:00-06:00', 33, 16, 9, 'N', 40),
      observe('2026-01-15T13:00:00-06:00', 35, 17, 8, 'N', 35),
      observe('2026-01-15T14:00:00-06:00', 36, 18, 8, 'N', 30),
      observe('2026-01-15T15:00:00-06:00', 37, 18, 9, 'N', 30),
      observe('2026-01-15T16:00:00-06:00', 35, 19, 10, 'N', 35),
      observe('2026-01-15T17:00:00-06:00', 32, 19, 12, 'N', 40),
      observe('2026-01-15T18:00:00-06:00', 29, 18, 13, 'N', 45),
      observe('2026-01-15T19:00:00-06:00', 27, 17, 14, 'N', 50),
      observe('2026-01-15T20:00:00-06:00', 25, 16, 15, 'N', 55),
      observe('2026-01-15T21:00:00-06:00', 24, 15, 16, 'N', 60),
      observe('2026-01-15T22:00:00-06:00', 23, 14, 16, 'N', 60),
      observe('2026-01-15T23:00:00-06:00', 22, 13, 15, 'N', 65),
      observe('2026-01-16T00:00:00-06:00', 21, 12, 14, 'N', 70),
      observe('2026-01-16T01:00:00-06:00', 20, 11, 14, 'N', 70),
      observe('2026-01-16T02:00:00-06:00', 19, 10, 13, 'N', 75),
      observe('2026-01-16T03:00:00-06:00', 18, 9, 12, 'N', 75),
      observe('2026-01-16T04:00:00-06:00', 18, 9, 12, 'N', 75),
      observe('2026-01-16T05:00:00-06:00', 19, 10, 11, 'N', 70),
      observe('2026-01-16T06:00:00-06:00', 22, 11, 10, 'N', 65),
      observe('2026-01-16T07:00:00-06:00', 25, 12, 10, 'N', 60),
      observe('2026-01-16T08:00:00-06:00', 28, 13, 9, 'N', 55),
      observe('2026-01-16T09:00:00-06:00', 31, 14, 8, 'N', 50),
      observe('2026-01-16T10:00:00-06:00', 34, 15, 8, 'N', 45)
    ]
  };

  return { summer: summer, winter: winter };
});
