'use strict';

/*
 * Heat policy tracker tests: tier boundaries, required actions, decision
 * validation, escalation history, and exports.
 */
const test = require('node:test');
const assert = require('node:assert');
const policy = require('../js/policy-tracker.js');

test('tier boundaries split exactly at the band edges', () => {
  assert.strictEqual(policy.tierFor(79).name, 'Normal Operations');
  assert.strictEqual(policy.tierFor(80).name, 'Caution');
  assert.strictEqual(policy.tierFor(89.9).name, 'Caution');
  assert.strictEqual(policy.tierFor(90).name, 'Extreme Caution');
  assert.strictEqual(policy.tierFor(102.9).name, 'Extreme Caution');
  assert.strictEqual(policy.tierFor(103).name, 'Danger');
  assert.strictEqual(policy.tierFor(124.9).name, 'Danger');
  assert.strictEqual(policy.tierFor(125).name, 'Extreme Danger');
  assert.strictEqual(policy.tierFor(140).name, 'Extreme Danger');
});

test('tierFor returns null for invalid readings', () => {
  assert.strictEqual(policy.tierFor(null), null);
  assert.strictEqual(policy.tierFor(undefined), null);
  assert.strictEqual(policy.tierFor(NaN), null);
  assert.strictEqual(policy.tierFor('hot'), null);
});

test('higher tiers list more required actions', () => {
  const tiers = policy.listTiers();
  const normal = tiers.find((t) => t.name === 'Normal Operations');
  const caution = tiers.find((t) => t.name === 'Caution');
  const danger = tiers.find((t) => t.name === 'Danger');
  const extreme = tiers.find((t) => t.name === 'Extreme Danger');
  assert.ok(normal.requiredActions.length >= 1);
  assert.ok(caution.requiredActions.length > normal.requiredActions.length);
  assert.ok(danger.requiredActions.length > caution.requiredActions.length);
  assert.ok(extreme.requiredActions.length >= 2);
  assert.ok(danger.requiredActions.some((a) => /30 minutes/.test(a)));
  assert.ok(extreme.requiredActions.some((a) => /indoor|Cancel/i.test(a)));
});

test('full outdoor activity is valid in the lower tiers and flagged above', () => {
  assert.strictEqual(policy.validateDecision('Normal Operations', 'Full Outdoor Activity').compliant, true);
  assert.strictEqual(policy.validateDecision('Caution', 'Full Outdoor Activity').compliant, true);
  assert.strictEqual(policy.validateDecision('Extreme Caution', 'Full Outdoor Activity').compliant, false);
  assert.strictEqual(policy.validateDecision('Danger', 'Full Outdoor Activity').compliant, false);
  assert.strictEqual(policy.validateDecision('Extreme Danger', 'Full Outdoor Activity').compliant, false);
});

test('modified outdoor activity is valid up to Danger and flagged at Extreme Danger', () => {
  assert.strictEqual(policy.validateDecision('Extreme Caution', 'Modified Outdoor Activity').compliant, true);
  assert.strictEqual(policy.validateDecision('Danger', 'Modified Outdoor Activity').compliant, true);
  assert.strictEqual(policy.validateDecision('Extreme Danger', 'Modified Outdoor Activity').compliant, false);
});

test('moving indoors, postponing, and canceling always satisfy the tier', () => {
  ['Moved Indoors', 'Postponed', 'Canceled'].forEach((decision) => {
    assert.strictEqual(policy.validateDecision('Extreme Danger', decision).compliant, true, decision);
    assert.strictEqual(policy.validateDecision('Normal Operations', decision).compliant, true, decision);
  });
});

test('validation flags unknown inputs', () => {
  assert.strictEqual(policy.validateDecision('Danger', 'Full Moon Hike').compliant, false);
  assert.strictEqual(policy.validateDecision('Mystery Tier', 'Canceled').compliant, false);
});

test('a logged decision records its tier and compliance verdict', () => {
  const tracker = policy.createTracker();
  const record = tracker.addDecision({
    date: '2026-06-01',
    department: 'Athletics',
    activity: 'Morning Practice',
    heatIndexF: 95,
    decision: 'Modified Outdoor Activity',
    notes: 'Shortened drills'
  });
  assert.strictEqual(record.tier, 'Extreme Caution');
  assert.strictEqual(record.compliance, 'Compliant');
  assert.strictEqual(tracker.getDecisions().length, 1);
});

test('addDecision rejects malformed entries', () => {
  const tracker = policy.createTracker();
  assert.throws(() => tracker.addDecision({ date: 'June 1', activity: 'Practice', heatIndexF: 95, decision: 'Canceled' }));
  assert.throws(() => tracker.addDecision({ date: '2026-02-30', activity: 'Practice', heatIndexF: 95, decision: 'Canceled' }));
  assert.throws(() => tracker.addDecision({ date: '2026-06-01', activity: '', heatIndexF: 95, decision: 'Canceled' }));
  assert.throws(() => tracker.addDecision({ date: '2026-06-01', activity: 'Practice', heatIndexF: 'hot', decision: 'Canceled' }));
  assert.throws(() => tracker.addDecision({ date: '2026-06-01', activity: 'Practice', heatIndexF: 95, decision: 'Rope Climbs' }));
});

test('escalation history records tier increases in date order', () => {
  const tracker = policy.createTracker();
  tracker.addDecision({ date: '2026-06-02', activity: 'Two A Day Practice', heatIndexF: 95, decision: 'Modified Outdoor Activity' });
  tracker.addDecision({ date: '2026-06-01', activity: 'Morning Walkthrough', heatIndexF: 84, decision: 'Full Outdoor Activity' });
  tracker.addDecision({ date: '2026-06-03', activity: 'Two A Day Practice', heatIndexF: 108, decision: 'Moved Indoors' });
  tracker.addDecision({ date: '2026-06-04', activity: 'Two A Day Practice', heatIndexF: 84, decision: 'Full Outdoor Activity' });
  tracker.addDecision({ date: '2026-06-05', activity: 'Scrimmage', heatIndexF: 126, decision: 'Canceled' });
  const escalations = tracker.getEscalations();
  assert.strictEqual(escalations.length, 3, 'three increases across the week');
  assert.strictEqual(escalations[0].from, 'Caution');
  assert.strictEqual(escalations[0].to, 'Extreme Caution');
  assert.strictEqual(escalations[0].date, '2026-06-02');
  assert.strictEqual(escalations[1].from, 'Extreme Caution');
  assert.strictEqual(escalations[1].to, 'Danger');
  assert.strictEqual(escalations[1].date, '2026-06-03');
  assert.strictEqual(escalations[2].from, 'Caution');
  assert.strictEqual(escalations[2].to, 'Extreme Danger');
  assert.strictEqual(escalations[2].date, '2026-06-05');
});

test('de-escalations never appear in the escalation list', () => {
  const tracker = policy.createTracker();
  tracker.addDecision({ date: '2026-06-01', activity: 'Practice', heatIndexF: 108, decision: 'Moved Indoors' });
  tracker.addDecision({ date: '2026-06-02', activity: 'Practice', heatIndexF: 82, decision: 'Full Outdoor Activity' });
  assert.strictEqual(tracker.getEscalations().length, 0);
});

test('summary counts decisions, flags, and escalations', () => {
  const tracker = policy.createTracker();
  tracker.addDecision({ date: '2026-06-01', activity: 'Practice', heatIndexF: 95, decision: 'Full Outdoor Activity' });
  tracker.addDecision({ date: '2026-06-02', activity: 'Practice', heatIndexF: 108, decision: 'Full Outdoor Activity' });
  tracker.addDecision({ date: '2026-06-03', activity: 'Meet', heatIndexF: 84, decision: 'Full Outdoor Activity' });
  const summary = tracker.getSummary();
  assert.strictEqual(summary.decisionCount, 3);
  assert.strictEqual(summary.flaggedCount, 2);
  assert.strictEqual(summary.escalationCount, 1);
  assert.strictEqual(summary.firstDate, '2026-06-01');
  assert.strictEqual(summary.lastDate, '2026-06-03');
  assert.strictEqual(summary.tierCounts['Extreme Caution'], 1);
  assert.strictEqual(summary.tierCounts['Danger'], 1);
  assert.strictEqual(summary.tierCounts['Caution'], 1);
});

test('csv export carries a header and one row per decision', () => {
  const tracker = policy.createTracker();
  tracker.addDecision({ date: '2026-06-01', activity: 'Morning Practice', heatIndexF: 108, decision: 'Full Outdoor Activity', notes: 'Hot one' });
  const csv = tracker.exportCsv();
  const lines = csv.split('\n');
  assert.strictEqual(lines.length, 2);
  assert.ok(lines[0].indexOf('Date,Department,Activity,Heat Index F,Tier') === 0);
  assert.ok(lines[1].indexOf('2026-06-01') === 0);
  assert.ok(lines[1].indexOf('Danger') !== -1);
  assert.ok(lines[1].indexOf('Needs Review') !== -1);
});

test('csv export escapes commas and quotes in notes', () => {
  const tracker = policy.createTracker();
  tracker.addDecision({ date: '2026-06-01', activity: 'Practice', heatIndexF: 82, decision: 'Full Outdoor Activity', notes: 'Kept "short" breaks, extra water' });
  const lines = tracker.exportCsv().split('\n');
  assert.ok(lines[1].includes('"Kept ""short"" breaks, extra water"'));
});

test('json export round trips through the summary', () => {
  const tracker = policy.createTracker();
  tracker.addDecision({ date: '2026-06-01', activity: 'Practice', heatIndexF: 95, decision: 'Moved Indoors' });
  const parsed = JSON.parse(tracker.exportJson());
  assert.strictEqual(parsed.summary.decisionCount, 1);
  assert.strictEqual(parsed.decisions.length, 1);
  assert.strictEqual(parsed.escalations.length, 0);
  assert.ok(/synthetic|National Weather Service|National Weather/i.test(parsed.note));
});

test('replaceDecisions restores a persisted season and recomputes escalations', () => {
  const first = policy.createTracker();
  first.addDecision({ date: '2026-06-01', activity: 'Practice', heatIndexF: 84, decision: 'Full Outdoor Activity' });
  first.addDecision({ date: '2026-06-02', activity: 'Practice', heatIndexF: 108, decision: 'Moved Indoors' });
  const snapshot = JSON.parse(first.exportJson());

  const second = policy.createTracker();
  const count = second.replaceDecisions(snapshot.decisions);
  assert.strictEqual(count, 2);
  assert.strictEqual(second.getDecisions().length, 2);
  assert.strictEqual(second.getEscalations().length, 1);
  assert.strictEqual(second.getSummary().decisionCount, 2);
});

test('replaceDecisions skips malformed rows instead of failing', () => {
  const tracker = policy.createTracker();
  const count = tracker.replaceDecisions([
    { date: '2026-06-01', activity: 'Good Row', heatIndexF: 95, decision: 'Moved Indoors' },
    { date: 'not a date', activity: 'Bad Row', heatIndexF: 95, decision: 'Moved Indoors' }
  ]);
  assert.strictEqual(count, 1);
});
