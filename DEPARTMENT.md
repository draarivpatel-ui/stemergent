# The Department Module

This document explains the Department module: what it manages, where its boundary sits, how it
stays isolated, and how the tests prove it. It exists because the project requires one clearly
isolated module of newly written code, distinct from any other repository this author maintains.

## Provenance

Everything in this repository was written from scratch for STEMergent during the local pre-build
window. The Department module in particular shares no code, naming, data shapes, or logic with
CrossSafe, GridPulse, Flag Call, or any other prior project. It was not ported, adapted, or
copied from anything.

## What it manages

The module (js/department.js) manages three things and nothing else:

1. **Departments.** Named groups such as Athletics or Marching Band, each with an optional
   description. Department names are unique case insensitively. Departments own members and
   season calendars.
2. **Roles.** Named permission sets. Three roles are seeded on every fresh registry:
   Coordinator (approve, manage calendar, manage members, review, view), Reviewer (review,
   view), and Viewer (view). Custom roles can be created with any permission list. Role checks
   answer one question: can this member do this thing?
3. **Season calendars.** A named date range per department (for example, a fall season from
   August 3 to November 20) with optional blackout dates on which the calendar counts as
   inactive. A department may not hold two overlapping calendars; different departments may.

## Module boundary

| Side of the boundary | Rule |
| --- | --- |
| js/department.js | Imports nothing. No require, no import, no reference to any other module in this repository. |
| js/forecast-engine.js and js/policy-tracker.js | Never reference the Department module. They are complete without it. |
| js/app.js | The only place integration happens, at the UI layer. It renders the module's lists and feeds forms to it. |
| Persisted state | The module's snapshot lives in its own key inside the app's local storage blob. The policy tracker stores department names as plain strings on decisions; it holds no shared objects with this module. |

The practical contract: the rest of the app may ask the registry questions (list departments,
check a permission, is this date active) and hand it form submissions. The module never reaches
back into weather math, tiers, or the DOM.

## Isolated test file group

The module's tests form their own group and load only this module plus Node builtins:

- tests/department.test.js covers behavior: registry seeding, unique names, role permissions,
  reassignment, calendar validation, overlap rejection, blackout handling, sorting, and the
  snapshot and restore round trip.
- tests/department-isolation.test.js covers the boundary itself, asserting that the module
  source contains no require calls, no import statements, no references to the other modules or
  their identifiers, exposes exactly its documented API surface, and that no test file in the
  group reaches outside the group.

## API reference

All functions return plain data. Mutating calls return { ok: true, ... } or
{ ok: false, error } rather than throwing.

| Call | Purpose |
| --- | --- |
| addDepartment(name, description) | Create a department with a case insensitive unique name. |
| listDepartments() | Departments with live member counts. |
| addRole(name, permissions) | Create a custom role; duplicates and empty permission lists are rejected. |
| listRoles() | All roles with their permission lists. |
| addMember(name, departmentId, roleId) | Add a person to a department through a role. |
| assignRole(memberId, roleId) | Move a member to a different role. |
| can(memberId, permission) | True when the member's role holds the permission. |
| listMembers(departmentId) | Members with resolved department and role names; filterable by department. |
| addSeason({ name, departmentId, startDate, endDate, blackoutDates }) | Create a calendar; validates real dates, ordering, department existence, and per department overlap. |
| listSeasons(departmentId) | Calendars sorted by start date with department names. |
| isDateActive(seasonId, date) | True inside the range and not a blackout date; false for anything unrecognized. |
| snapshot() / restore(data) | Plain data round trip for persistence; restore skips malformed rows. |

## What it does not do

It does not compute anything about weather, hold policy tiers, store decisions, talk to the
network, or touch the DOM. Dates are plain YYYY-MM-DD strings compared lexically, so behavior
never depends on the machine time zone.
