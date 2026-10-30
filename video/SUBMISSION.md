# STEMergent | STEMergent Hacks 2026

## Project name

STEMergent Forecast and Heat Policy Planner

## Elevator pitch

An offline National Weather Service style hourly forecast engine, five tier heat safety policy tracker, and isolated department calendar registry for planning practices and outdoor events around dangerous heat and cold.

## Track

STEM / Health, Safety, and Environmental Operations

## Story / Description

### Inspiration

Coaches, band directors, and outdoor program coordinators constantly have to turn raw temperature, dew point, and wind readings into concrete schedule calls: run full outdoor practice, add mandatory water and shade breaks, or move indoors. Worse, those calls are rarely logged in a single season file that tracks when conditions escalated from Caution to Danger. STEMergent pairs deterministic weather math with a policy compliance tracker and department registry in a fast, zero dependency web workbook.

### What it does

- **Forecast Engine**: Choose between two clearly labeled synthetic observation fixtures (`Synthetic Summer Heat Wave` and `Synthetic Winter Cold Snap`, 30 hourly observations each) to compute a deterministic 12 hour outlook. It implements the National Weather Service Steadman and Rothfusz heat index regression (with low and high humidity adjustments), the NWS wind chill formula within its validity window, Magnus relative humidity, a 12 hour temperature ribbon, an hourly table, and a deterministic written forecast discussion.
- **Heat Policy Tracker**: Log practice and event decisions against five heat safety tiers modeled on National Weather Service heat risk categories (`Normal Operations`, `Caution`, `Extreme Caution`, `Danger`, and `Extreme Danger`). The tracker checks whether the action taken satisfies the tier requirements, flags unsafe calls (such as `Full Outdoor Activity` in `Danger`), records every date ordered tier escalation across the season, and exports the full season log to CSV or JSON straight from the browser.
- **Isolated Departments Registry**: Manage departments, role permissions (`Coordinator`, `Reviewer`, `Viewer`), and season calendars with blackout date and overlap validation. As documented in `DEPARTMENT.md`, `js/department.js` is strictly isolated with zero imports or cross references, verified by dedicated textual and behavioral isolation tests.

### Honest Scope and Data Disclosure

All observation data shipped in the repository is labeled synthetic fixture data for deterministic offline testing; no live weather API is called. The README documents the exact data shape where a live `api.weather.gov` gridpoint hourly feed plugs into `buildHourlyForecast`. Policy tiers are an educational planning aid modeled on NWS categories, not official athletics rule text.

### How we built it

STEMergent is written in vanilla HTML5, CSS3, and modular JavaScript (`js/forecast-engine.js`, `js/policy-tracker.js`, `js/department.js`, and `js/app.js`) styled after a field office weather logbook with warm ruled paper, storm navy ink, Georgia serif display headings, and tabular numerals. A suite of 84 `node:test` tests runs in under 100 milliseconds with zero dependencies, verifying published NWS worked examples, tier boundaries, escalation ordering, DOM interactions, and module isolation.

## Built with

- JavaScript (UMD / CommonJS + Browser Globals)
- HTML5 (Accessible ARIA Tabs, Live Status Regions)
- CSS3 (Custom Properties, Responsive Grid, Tabular Numerals)
- Node.js (`node:test` zero dependency test suite)

## Try it out

- Live Demo: https://aariv.me/stemergent/
- Source Code: https://github.com/draarivpatel-ui/stemergent
