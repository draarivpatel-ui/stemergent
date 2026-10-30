# STEMergent

An offline forecast engine and heat safety policy tracker for planning practices and events
around dangerous heat and cold. It runs entirely in the browser as a static page, computes
everything locally with fixed formulas, and ships with labeled synthetic fixtures so it works
with no network and no keys.

Built by Aariv Patel for STEMergent Hacks 2026. This is a local pre-build prepared before the
submission window opens.

## What it does

The page has three modules, switched by tabs.

**Forecast Engine.** Pick a labeled synthetic fixture (a summer heat wave or a winter cold snap,
30 invented hourly observations each) and the engine produces a 12 hour outlook with a color
temperature ribbon, an hourly table, and a written forecast discussion assembled from fixed
templates and computed values. Same input in, same output out, every time.

**Heat Policy Tracker.** Log practice and event decisions against five heat safety tiers modeled
on National Weather Service heat risk categories. Each decision is checked for compliance, the
tracker records escalations when conditions climb a tier between decisions, and the season file
exports as CSV or JSON straight from the browser. Decisions persist to local storage in your
browser; nothing is sent anywhere.

**Departments.** A small registry of departments, roles with permissions, and season calendars
with blackout dates. The module behind this panel is deliberately isolated, with its own test
file group and a boundary document in DEPARTMENT.md.

## Weather math implemented

- Heat index: the National Weather Service algorithm, the simple Steadman form first, then the
  Rothfusz regression with the published low humidity and high humidity adjustments. Undefined
  below 80 F, matching NWS practice.
- Wind chill: the National Weather Service formula, valid at or below 50 F and winds of 3 mph
  or more, returning null outside that window.
- Relative humidity from temperature and dew point using the Magnus form, clamped to 0 to 100
  percent.
- Forecast method: persistence with a fixed diurnal adjustment. The last observation anchors the
  outlook; temperature follows a fixed hour of day offset table, wind eases toward a floor, and
  sky cover persists. This is an educational model, not numerical weather prediction.

## Honest limits

- No live weather data is fetched, ever. Both fixtures are labeled synthetic inside the data
  itself, and the UI says so next to the results.
- The forecast is persistence based. It does not model fronts, precipitation, or advection.
- The policy tiers are a planning aid modeled on NWS heat risk categories. They are not official
  UIL rule text and this tool is not affiliated with any athletics body.
- All data lives in your browser's local storage. Clearing site data or using private browsing
  skips persistence. There is no backend, account, or sync.
- No geolocation and no unit switching; fixtures and readings are Fahrenheit and mph.

## Where the live NWS API would plug in

The engine consumes a plain array of hourly observations shaped like this (see
`data/fixtures.js`):

```json
{ "time": "2026-06-01T14:00:00-05:00", "temperatureF": 103, "dewPointF": 76,
  "windSpeedMph": 11, "windDirection": "S", "cloudCoverPercent": 10 }
```

To go live, replace the fixture loader in `js/app.js` with a fetch of the National Weather
Service hourly forecast endpoint for a gridpoint, for example
`https://api.weather.gov/gridpoints/{office}/{x},{y}/forecast/hourly`, map each period's
temperature, dewpoint, windSpeed, and skyCover values into the shape above, and pass the array
to the same `buildHourlyForecast` call. The api.weather.gov API needs no key, but it does ask
for a descriptive User-Agent header identifying the app. Nothing else in the pipeline would
change: the math, tiers, discussion templates, and tracker all consume the computed values.

## Running and testing

Deploy the folder as-is to any static host (GitHub Pages included); there is no build step.
Open `index.html` locally and it works offline too.

Tests use the Node.js built in test runner (Node 18 or newer), with zero dependencies and zero
network access:

```
node --test tests/
```

Coverage: heat index vectors (including the published 96 F at 65 percent worked example), wind
chill vectors (including the published 20 F at 20 mph chart case), humidity references, fixture
integrity, forecast determinism, discussion template checks, policy tier boundaries and
escalation history, and the department module with its own isolated test file group.

## Project layout

```
index.html              Single page app
css/styles.css          All styling, no framework
js/forecast-engine.js   Heat index, wind chill, humidity, forecast, discussion
js/policy-tracker.js    Tiers, decisions, escalations, exports
js/department.js        Isolated departments, roles, season calendars module
js/app.js               UI wiring; the only place modules meet
data/fixtures.js        Labeled synthetic fixtures
tests/                  node:test suite, six files
DEPARTMENT.md           Department module boundary document
NOTES.md                Build notes, test counts, honest caveats
```

## License

MIT. See LICENSE. Fixture data is synthetic and free of any real observations.
