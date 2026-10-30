/*
 * STEMergent heat policy tracker.
 *
 * Pure logic for heat safety policy tiers, decision logging, compliance
 * checks, escalation history, and exportable summaries. Tier bands are
 * modeled on the National Weather Service heat risk categories. They are an
 * educational planning aid, not official UIL rule text.
 *
 * This module imports nothing. It is used by the UI layer only.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.StemergentPolicy = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TIERS = [
    {
      name: 'Normal Operations',
      min: -Infinity,
      max: 80,
      rank: 0,
      colorKey: 'moss',
      requiredActions: [
        'Water available at all activity areas'
      ]
    },
    {
      name: 'Caution',
      min: 80,
      max: 90,
      rank: 1,
      colorKey: 'gold',
      requiredActions: [
        'Water available at all activity areas',
        'Rest breaks at least every 30 minutes',
        'Watch participants for early heat stress signs'
      ]
    },
    {
      name: 'Extreme Caution',
      min: 90,
      max: 103,
      rank: 2,
      colorKey: 'amber',
      requiredActions: [
        'Water available at all activity areas',
        'Rest breaks at least every 30 minutes',
        'Shorten continuous outdoor exertion',
        'Shade or a cooling area open and staffed'
      ]
    },
    {
      name: 'Danger',
      min: 103,
      max: 125,
      rank: 3,
      colorKey: 'heat',
      requiredActions: [
        'Limit outdoor activity to 30 minutes or move indoors',
        'Schedule heavy exertion before 10 AM or after 7 PM',
        'Water available at all activity areas',
        'Shade or a cooling area open and staffed',
        'Cooling station ready for any heat distress signs'
      ]
    },
    {
      name: 'Extreme Danger',
      min: 125,
      max: Infinity,
      rank: 4,
      colorKey: 'alert',
      requiredActions: [
        'Cancel outdoor activity or move it indoors',
        'Follow the indoor modification plan',
        'Recheck conditions before any rescheduling'
      ]
    }
  ];

  var DECISIONS = [
    'Full Outdoor Activity',
    'Modified Outdoor Activity',
    'Moved Indoors',
    'Postponed',
    'Canceled'
  ];

  var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  function isValidDate(dateString) {
    if (typeof dateString !== 'string' || !DATE_PATTERN.test(dateString)) {
      return false;
    }
    var year = parseInt(dateString.slice(0, 4), 10);
    var month = parseInt(dateString.slice(5, 7), 10);
    var day = parseInt(dateString.slice(8, 10), 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }
    var probe = new Date(Date.UTC(year, month - 1, day));
    return probe.getUTCFullYear() === year
      && probe.getUTCMonth() === month - 1
      && probe.getUTCDate() === day;
  }

  function tierFor(heatIndexF) {
    if (typeof heatIndexF !== 'number' || !isFinite(heatIndexF)) {
      return null;
    }
    for (var i = 0; i < TIERS.length; i++) {
      if (heatIndexF >= TIERS[i].min && heatIndexF < TIERS[i].max) {
        return TIERS[i];
      }
    }
    return TIERS[TIERS.length - 1];
  }

  function tierByName(name) {
    for (var i = 0; i < TIERS.length; i++) {
      if (TIERS[i].name === name) {
        return TIERS[i];
      }
    }
    return null;
  }

  /*
   * Checks a decision against its tier. Full outdoor activity is flagged at
   * Extreme Caution and above; modified outdoor activity is flagged only at
   * Extreme Danger; moving indoors, postponing, and canceling are always
   * compliant. Returns a verdict object with a plain language message.
   */
  function validateDecision(tierName, decision) {
    var tier = tierByName(tierName);
    if (!tier) {
      return { compliant: false, message: 'Unknown tier, so the decision needs review.' };
    }
    if (DECISIONS.indexOf(decision) === -1) {
      return { compliant: false, message: 'Unknown decision type, so the entry needs review.' };
    }
    if (decision === 'Full Outdoor Activity') {
      if (tier.rank <= 1) {
        return { compliant: true, message: 'Full outdoor activity fits the ' + tier.name + ' tier.' };
      }
      return {
        compliant: false,
        message: 'Full outdoor activity is flagged at ' + tier.name + '. Shorten exposure or move indoors.'
      };
    }
    if (decision === 'Modified Outdoor Activity') {
      if (tier.rank <= 3) {
        return { compliant: true, message: 'Modified outdoor activity fits the ' + tier.name + ' tier.' };
      }
      return {
        compliant: false,
        message: 'Modified outdoor activity is flagged at ' + tier.name + '. Cancel or move indoors.'
      };
    }
    return { compliant: true, message: decision + ' satisfies the ' + tier.name + ' tier requirements.' };
  }

  function csvEscape(field) {
    var s = String(field === null || field === undefined ? '' : field);
    if (/[",\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function createTracker() {
    var decisions = [];
    var escalations = [];
    var sequence = 0;

    function recomputeEscalations() {
      escalations = [];
      var ordered = decisions.slice().sort(function (a, b) {
        if (a.date !== b.date) {
          return a.date < b.date ? -1 : 1;
        }
        return a.sequence - b.sequence;
      });
      for (var i = 1; i < ordered.length; i++) {
        var from = tierByName(ordered[i - 1].tier);
        var to = tierByName(ordered[i].tier);
        if (from && to && to.rank > from.rank) {
          escalations.push({
            id: 'e' + escalations.length,
            date: ordered[i].date,
            from: from.name,
            to: to.name,
            activity: ordered[i].activity,
            department: ordered[i].department
          });
        }
      }
    }

    function normalizeDecision(input) {
      if (!input || typeof input !== 'object') {
        throw new Error('A decision requires an object with date, activity, heatIndexF, and decision.');
      }
      if (!isValidDate(input.date)) {
        throw new Error('The date must be a real calendar day formatted as YYYY-MM-DD.');
      }
      if (typeof input.activity !== 'string' || input.activity.trim().length === 0) {
        throw new Error('The activity name is required.');
      }
      if (typeof input.heatIndexF !== 'number' || !isFinite(input.heatIndexF) || input.heatIndexF < -80 || input.heatIndexF > 200) {
        throw new Error('The heat index reading must be a number between -80 and 200.');
      }
      if (DECISIONS.indexOf(input.decision) === -1) {
        throw new Error('Unknown decision type. Choose from the decision list.');
      }
      var tier = tierFor(input.heatIndexF);
      var verdict = validateDecision(tier.name, input.decision);
      return {
        id: 'd' + (++sequence),
        sequence: sequence,
        date: input.date,
        department: typeof input.department === 'string' && input.department.trim() ? input.department.trim() : 'Unassigned',
        activity: input.activity.trim(),
        heatIndexF: input.heatIndexF,
        tier: tier.name,
        decision: input.decision,
        compliance: verdict.compliant ? 'Compliant' : 'Needs Review',
        message: verdict.message,
        notes: typeof input.notes === 'string' ? input.notes.trim() : ''
      };
    }

    function addDecision(input) {
      var record = normalizeDecision(input);
      decisions.push(record);
      recomputeEscalations();
      return record;
    }

    function replaceDecisions(list) {
      if (!Array.isArray(list)) {
        return 0;
      }
      decisions = [];
      sequence = 0;
      var count = 0;
      for (var i = 0; i < list.length; i++) {
        try {
          decisions.push(normalizeDecision(list[i]));
          count++;
        } catch (err) {
          /* Skip malformed persisted rows instead of failing the whole load. */
        }
      }
      recomputeEscalations();
      return count;
    }

    function tierCounts() {
      var counts = {};
      TIERS.forEach(function (t) { counts[t.name] = 0; });
      decisions.forEach(function (d) { counts[d.tier] = (counts[d.tier] || 0) + 1; });
      return counts;
    }

    function getSummary() {
      var flagged = decisions.filter(function (d) { return d.compliance === 'Needs Review'; }).length;
      var dates = decisions.map(function (d) { return d.date; }).sort();
      return {
        decisionCount: decisions.length,
        tierCounts: tierCounts(),
        escalationCount: escalations.length,
        flaggedCount: flagged,
        firstDate: dates.length ? dates[0] : null,
        lastDate: dates.length ? dates[dates.length - 1] : null
      };
    }

    function exportCsv() {
      var header = 'Date,Department,Activity,Heat Index F,Tier,Decision,Status,Notes';
      var rows = decisions.map(function (d) {
        return [
          d.date,
          d.department,
          d.activity,
          d.heatIndexF,
          d.tier,
          d.decision,
          d.compliance,
          d.notes
        ].map(csvEscape).join(',');
      });
      return [header].concat(rows).join('\n');
    }

    function exportJson() {
      return JSON.stringify({
        generatedBy: 'STEMergent heat policy tracker',
        note: 'Tier bands are modeled on National Weather Service heat risk categories.',
        summary: getSummary(),
        escalations: escalations,
        decisions: decisions
      }, null, 2);
    }

    return {
      addDecision: addDecision,
      replaceDecisions: replaceDecisions,
      getDecisions: function () { return decisions.slice(); },
      getEscalations: function () { return escalations.slice(); },
      getSummary: getSummary,
      exportCsv: exportCsv,
      exportJson: exportJson
    };
  }

  return {
    createTracker: createTracker,
    tierFor: tierFor,
    validateDecision: validateDecision,
    listTiers: function () { return TIERS.map(function (t) {
      return {
        name: t.name,
        min: t.min === -Infinity ? null : t.min,
        max: t.max === Infinity ? null : t.max,
        rank: t.rank,
        colorKey: t.colorKey,
        requiredActions: t.requiredActions.slice()
      };
    }); },
    listDecisions: function () { return DECISIONS.slice(); }
  };
});
