# Build Notes

Local pre-build for STEMergent Hacks 2026, prepared before the submission window opens.
Nothing here has been pushed anywhere. Written by Aariv Patel.

## What Was Built

A zero dependency, single page app in vanilla HTML, CSS, and JavaScript with three tabs:

1. **Forecast Engine.** Ingests one of two labeled synthetic hourly fixtures (summer heat wave
   and winter cold snap, 30 observations each with temperature, dew point, wind, and cloud
   cover) and produces a 12 hour outlook. Includes the National Weather Service heat index
   algorithm (simple form, Rothfusz regression, low and high humidity adjustments), the NWS wind
   chill formula with its validity window, relative humidity from the Magnus form, a color
   temperature ribbon, an hourly table, and a forecast discussion generated from fixed
   templates and computed values. Fully deterministic.
2. **Heat Policy Tracker.** Five policy tiers modeled on NWS heat risk categories, a decision
   log with compliance validation (full outdoor activity is flagged at Extreme Caution and
   above, modified activity at Extreme Danger), escalation history when conditions climb a tier
   between decisions, season summary counts, and CSV and JSON export via browser downloads.
   Decisions persist to localStorage.
3. **Departments.** An isolated module managing departments, roles with permissions, and season
   calendars with blackout dates and overlap rejection. Boundary document in DEPARTMENT.md; its
   own test file group proves the isolation textually and behaviorally.

Design: a field office weather logbook look. Warm ruled paper background, storm navy ink,
Georgia serif headings, tabular numerals, system font stack only. Responsive to phone widths,
keyboard navigable tabs with arrow key support, visible focus states, ARIA live announcements,
and reduced motion respected. No em dashes, no en dashes, no all-caps kickers, no emoji icons
anywhere in the UI copy (verified by scan).

## Test Results (Real Counts)

`node --test tests/` on Node v26.8.1, zero dependencies, zero network:

| File | Tests |
| --- | --- |
| tests/heat-index.test.js | 10 |
| tests/wind-chill.test.js | 12 |
| tests/forecast.test.js | 21 |
| tests/policy.test.js | 17 |
| tests/department.test.js | 9 |
| tests/department-isolation.test.js | 4 |
| tests/engine.test.js | 2 |
| tests/dom-smoke.test.js | 9 |
| **Total** | **84 tests, 84 pass, 0 fail** |

Runtime: under 100 milliseconds, far under the 30 second limit. Heat index and wind chill
expected values were derived by hand from the published formulas, including the NWS worked
example (96 F at 65 percent gives 121) and the NWS chart case (20 F at 20 mph gives about 4).

## Honest Caveats

- No live weather data. Both fixtures are labeled synthetic inside the data file, and the UI
  states it next to the results. The README documents exactly where api.weather.gov would plug
  in.
- The forecast is persistence with a fixed diurnal table. It does not model fronts,
  precipitation, or advection, and the UI says so.
- The policy tiers are modeled on NWS heat risk categories as an educational planning aid. They
  are not official UIL rule text, and nothing in the repo claims affiliation with any
  athletics body.
- Persistence is localStorage only, per browser, with no backend. The code degrades gracefully
  if storage is unavailable (private browsing), it just does not remember.
- Heat index and wind chill return null outside their NWS validity windows, so some table cells
  legitimately read None rather than a number.

## Devpost Bullets

- A National Weather Service style forecast engine that runs entirely offline: real heat index
  and wind chill math, a 12 hour outlook, and a written forecast discussion, all deterministic
  from labeled synthetic fixtures.
- A heat policy tracker that grades every practice decision against five heat risk tiers,
  records every escalation across the season, and exports the season file as CSV or JSON.
- An isolated Department module with its own boundary document and test group, proving the
  codebase was written fresh for this project: departments, roles, and season calendars in a
  sealed, dependency free file.
- A test suite of 84 passing tests in under a tenth of a second, covering the published NWS
  worked examples, tier boundaries, escalation ordering, interactive DOM rendering, and the
  module isolation boundary itself.
- GitHub Pages ready as-is: one page, zero dependencies, zero network calls, honest labels on
  every synthetic number, and a README that shows exactly where the live api.weather.gov feed
  would plug in.
