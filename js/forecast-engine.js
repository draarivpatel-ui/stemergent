/*
 * STEMergent forecast engine.
 *
 * Pure, deterministic meteorology helpers plus a persistence based hourly
 * forecast builder. Everything runs offline on a labeled synthetic fixture.
 * No network calls of any kind happen in this file.
 *
 * Formulas implemented:
 * - Relative humidity from temperature and dew point (Magnus form).
 * - Heat index (National Weather Service algorithm: simple formula, then the
 *   Rothfusz regression with the dry and humid adjustments).
 * - Wind chill (National Weather Service formula, valid at or below 50 F and
 *   wind speeds of 3 mph or more).
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.StemergentForecast = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /*
   * Temperature offsets by hour of day, in degrees Fahrenheit, relative to a
   * neutral point. The forecast applies the difference between the target
   * hour and the anchor hour, damped so the model does not overreach.
   */
  var DIURNAL_OFFSETS_F = [-4, -5, -6, -7, -7, -6, -3, 0, 3, 6, 8, 10, 11, 12, 12, 11, 9, 7, 4, 1, -1, -2, -3, -3];
  var DIURNAL_DAMPING = 0.85;

  /* Wind decays toward this floor across the forecast window. */
  var WIND_FLOOR_MPH = 6;
  var WIND_DECAY = 0.92;

  var FORECAST_METHOD = 'Persistence with a fixed diurnal adjustment';

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function toCelsius(fahrenheit) {
    return (fahrenheit - 32) * 5 / 9;
  }

  /*
   * Magnus form saturation vapor pressure in hectopascals.
   * Valid and smooth for the fixture temperature ranges used here.
   */
  function saturationVaporPressure(celsius) {
    return 6.112 * Math.exp((17.67 * celsius) / (celsius + 243.5));
  }

  /*
   * Relative humidity in percent from air temperature and dew point, both in
   * degrees Fahrenheit. Returns a value clamped to 0 through 100, or null for
   * non numeric input. Dew points above the air temperature clamp to 100.
   */
  function relativeHumidity(tempF, dewPointF) {
    if (!isFiniteNumber(tempF) || !isFiniteNumber(dewPointF)) {
      return null;
    }
    var t = toCelsius(tempF);
    var td = toCelsius(dewPointF);
    var es = saturationVaporPressure(t);
    var e = saturationVaporPressure(td);
    var rh = 100 * (e / es);
    return Math.max(0, Math.min(100, rh));
  }

  /*
   * Heat index in whole degrees Fahrenheit following the National Weather
   * Service algorithm. Returns null below 80 F, where the index is not
   * defined. The simple Steadman style formula runs first; when its average
   * with the air temperature reaches 80, the full Rothfusz regression takes
   * over, with the published low humidity and high humidity adjustments.
   */
  function heatIndex(tempF, rhPercent) {
    if (!isFiniteNumber(tempF) || !isFiniteNumber(rhPercent)) {
      return null;
    }
    if (tempF < 80) {
      return null;
    }
    var simple = 0.5 * (tempF + 61.0 + ((tempF - 68.0) * 1.2) + (rhPercent * 0.094));
    var value;
    if ((tempF + simple) / 2 < 80) {
      value = simple;
    } else {
      var t2 = tempF * tempF;
      var r2 = rhPercent * rhPercent;
      value = -42.379
        + 2.04901523 * tempF
        + 10.14333127 * rhPercent
        - 0.22475541 * tempF * rhPercent
        - 0.00683783 * t2
        - 0.05481717 * r2
        + 0.00122874 * t2 * rhPercent
        + 0.00085282 * tempF * r2
        - 0.00000199 * t2 * r2;
      if (rhPercent < 13 && tempF >= 80 && tempF <= 112) {
        value -= ((13 - rhPercent) / 4) * Math.sqrt((17 - Math.abs(tempF - 95)) / 17);
      }
      if (rhPercent > 85 && tempF >= 80 && tempF <= 87) {
        value += ((rhPercent - 85) / 10) * ((87 - tempF) / 5);
      }
    }
    return Math.round(value);
  }

  /*
   * Wind chill in degrees Fahrenheit to one decimal, National Weather Service
   * formula. Returns null outside the validity window: air temperature above
   * 50 F or wind below 3 mph.
   */
  function windChill(tempF, windMph) {
    if (!isFiniteNumber(tempF) || !isFiniteNumber(windMph)) {
      return null;
    }
    if (tempF > 50 || windMph < 3) {
      return null;
    }
    var v = Math.pow(windMph, 0.16);
    var wc = 35.74 + (0.6215 * tempF) - (35.75 * v) + (0.4275 * tempF * v);
    return Math.round(wc * 10) / 10;
  }

  /* Sky cover categories, in percent cloud cover. */
  function cloudCategory(percent) {
    if (!isFiniteNumber(percent)) {
      return 'Unknown';
    }
    if (percent <= 10) { return 'Clear'; }
    if (percent <= 30) { return 'Mostly Clear'; }
    if (percent <= 60) { return 'Partly Cloudy'; }
    if (percent <= 90) { return 'Mostly Cloudy'; }
    return 'Cloudy';
  }

  /* Wind categories by sustained speed in miles per hour. */
  function windCategory(mph) {
    if (!isFiniteNumber(mph)) {
      return 'Unknown';
    }
    if (mph < 4) { return 'Calm'; }
    if (mph < 10) { return 'Light Wind'; }
    if (mph < 18) { return 'Breezy'; }
    if (mph < 28) { return 'Windy'; }
    return 'Very Windy';
  }

  /* Hour of day, 0 to 23, parsed from an ISO style local time string. */
  function hourOf(isoTime) {
    var match = /T(\d{2})/.exec(String(isoTime));
    return match ? parseInt(match[1], 10) : 0;
  }

  /* Human label like "2 PM" or "12 AM" from an ISO style local time string. */
  function hourLabel(isoTime) {
    var h = hourOf(isoTime);
    var isAm = h < 12;
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ' ' + (isAm ? 'AM' : 'PM');
  }

  /*
   * Shifts an ISO style local time string forward by whole hours, keeping the
   * fixture's fixed UTC offset. Parsing stays on the string itself so results
   * never depend on the machine time zone.
   */
  function shiftIsoHour(isoTime, addHours) {
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(isoTime));
    if (!match) {
      return String(isoTime);
    }
    var ms = Date.UTC(
      parseInt(match[1], 10),
      parseInt(match[2], 10) - 1,
      parseInt(match[3], 10),
      parseInt(match[4], 10) + addHours,
      parseInt(match[5], 10)
    );
    var shifted = new Date(ms).toISOString();
    return shifted.slice(0, 13) + ':00:00-05:00';
  }

  /*
   * Builds a deterministic hourly forecast from an observation series. The
   * last observation anchors the forecast: temperature follows the fixed
   * diurnal offset table, dew point persists, wind eases toward a floor, and
   * sky cover persists. Same input in, same forecast out, every time.
   */
  function buildHourlyForecast(observations, options) {
    options = options || {};
    var hours = options.hours === undefined ? 12 : options.hours;
    if (!Array.isArray(observations) || observations.length === 0) {
      return null;
    }
    if (!isFiniteNumber(hours) || hours < 1 || hours > 72) {
      return null;
    }
    var anchor = observations[observations.length - 1];
    var anchorHour = hourOf(anchor.time);
    var startTemp = anchor.temperatureF;
    var startDew = anchor.dewPointF;
    var startWind = anchor.windSpeedMph;
    var cloud = anchor.cloudCoverPercent;
    var direction = anchor.windDirection || '';

    var out = [];
    for (var i = 1; i <= hours; i++) {
      var targetHour = (anchorHour + i) % 24;
      var temp = startTemp
        + (DIURNAL_OFFSETS_F[targetHour] - DIURNAL_OFFSETS_F[anchorHour]) * DIURNAL_DAMPING;
      temp = Math.round(temp * 10) / 10;
      var wind = WIND_FLOOR_MPH + (startWind - WIND_FLOOR_MPH) * Math.pow(WIND_DECAY, i);
      wind = Math.round(wind * 10) / 10;
      var rh = relativeHumidity(temp, startDew);
      rh = rh === null ? null : Math.round(rh * 10) / 10;
      out.push({
        time: shiftIsoHour(anchor.time, i),
        temperatureF: temp,
        dewPointF: startDew,
        windSpeedMph: wind,
        windDirection: direction,
        cloudCoverPercent: cloud,
        relativeHumidity: rh,
        heatIndexF: heatIndex(temp, rh),
        windChillF: windChill(temp, wind),
        cloudCategory: cloudCategory(cloud),
        windCategory: windCategory(wind)
      });
    }

    return {
      method: FORECAST_METHOD,
      source: 'Labeled synthetic fixture',
      anchor: anchor,
      hours: out
    };
  }

  /* Phrase describing where a heat index value sits on the risk scale. */
  function heatPhrase(hi) {
    if (hi >= 125) { return 'deep in the extreme danger range.'; }
    if (hi >= 103) { return 'which crosses the danger threshold for outdoor exertion.'; }
    if (hi >= 90) { return 'inside the extreme caution band.'; }
    if (hi >= 80) { return 'in the caution band.'; }
    return 'which stays in the normal range.';
  }

  /*
   * Writes a forecast discussion from computed values using fixed templates.
   * Every sentence is deterministic: the same forecast always produces the
   * same discussion text.
   */
  function buildDiscussion(forecast) {
    if (!forecast || !Array.isArray(forecast.hours) || forecast.hours.length === 0) {
      return null;
    }
    var hours = forecast.hours;
    var peak = hours.reduce(function (a, b) { return b.temperatureF > a.temperatureF ? b : a; }, hours[0]);

    var withHi = hours.filter(function (h) { return h.heatIndexF !== null; });
    var peakHi = withHi.length
      ? withHi.reduce(function (a, b) { return b.heatIndexF > a.heatIndexF ? b : a; })
      : null;

    var withWc = hours.filter(function (h) { return h.windChillF !== null; });
    var minWc = withWc.length
      ? withWc.reduce(function (a, b) { return b.windChillF < a.windChillF ? b : a; })
      : null;

    var anchor = forecast.anchor;
    var first = hours[0];
    var last = hours[hours.length - 1];
    var direction = anchor.windDirection || '';
    var directionPhrase = direction ? ' out of the ' + direction : '';

    var headline;
    if (peakHi && peakHi.heatIndexF >= 103) {
      headline = 'Dangerous heat builds this afternoon.';
    } else if (peakHi && peakHi.heatIndexF >= 90) {
      headline = 'Heat builds with caution level indexes.';
    } else if (minWc && minWc.windChillF <= 0) {
      headline = 'Bitter cold settles in with biting winds.';
    } else if (minWc) {
      headline = 'Cold holds on with noticeable wind chills.';
    } else {
      headline = 'Quiet weather holds through the period.';
    }

    var sentences = [];
    sentences.push('Peak temperature lands near ' + Math.round(peak.temperatureF)
      + ' degrees around ' + hourLabel(peak.time) + '.');

    if (peakHi) {
      sentences.push('The heat index peaks near ' + peakHi.heatIndexF
        + ' at ' + hourLabel(peakHi.time) + ', ' + heatPhrase(peakHi.heatIndexF));
    }
    if (minWc) {
      sentences.push('Wind chill bottoms out near ' + Math.round(minWc.windChillF)
        + ' degrees at ' + hourLabel(minWc.time) + ', so plan layers for anyone standing outside.');
    }

    sentences.push('Winds run' + directionPhrase + ' near ' + Math.round(first.windSpeedMph)
      + ' mph early, easing toward ' + Math.round(last.windSpeedMph) + ' mph by '
      + hourLabel(last.time) + '.');

    sentences.push('Sky cover holds near ' + anchor.cloudCoverPercent + ' percent through the period, '
      + cloudCategory(anchor.cloudCoverPercent).toLowerCase() + '.');

    if (peakHi && peakHi.heatIndexF >= 103) {
      sentences.push('Shift outdoor exertion to early morning and move the rest indoors during the afternoon.');
    } else if (peakHi && peakHi.heatIndexF >= 90) {
      sentences.push('Build in water breaks and shade through the warmest hours.');
    } else if (peakHi) {
      sentences.push('Comfortable heat levels allow a normal outdoor schedule.');
    } else if (minWc && minWc.windChillF <= 0) {
      sentences.push('Cover exposed skin and keep outdoor stands short during the coldest hours.');
    } else if (minWc) {
      sentences.push('Cold is noticeable but manageable with standard winter gear.');
    } else {
      sentences.push('Mild conditions support a normal schedule.');
    }

    return {
      headline: headline,
      sentences: sentences,
      text: headline + ' ' + sentences.join(' ')
    };
  }

  return {
    relativeHumidity: relativeHumidity,
    heatIndex: heatIndex,
    windChill: windChill,
    cloudCategory: cloudCategory,
    windCategory: windCategory,
    hourOf: hourOf,
    hourLabel: hourLabel,
    buildHourlyForecast: buildHourlyForecast,
    buildDiscussion: buildDiscussion,
    DIURNAL_OFFSETS_F: DIURNAL_OFFSETS_F,
    FORECAST_METHOD: FORECAST_METHOD
  };
});
