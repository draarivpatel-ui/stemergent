/*
 * STEMergent app layer.
 *
 * Wires the three modules into the page: the forecast engine renders the
 * outlook and discussion, the policy tracker logs and validates decisions,
 * and the department registry manages departments, roles, and season
 * calendars. This file is the only place the modules meet; neither module
 * imports another. Decisions, departments, and calendars persist to local
 * storage in this browser.
 */
(function () {
  'use strict';

  var engine = window.StemergentForecast;
  var policy = window.StemergentPolicy;
  var departmentModule = window.StemergentDepartment;
  var fixtures = window.StemergentFixtures;

  if (!engine || !policy || !departmentModule || !fixtures) {
    return;
  }

  var STORAGE_KEY = 'stemergent.v1';

  var state = {
    fixtureKey: 'summer',
    forecast: null,
    discussion: null,
    tracker: policy.createTracker(),
    registry: departmentModule.createRegistry()
  };

  /* ---------------------------------------------------------------------
     Small helpers
     --------------------------------------------------------------------- */

  function $(id) {
    return document.getElementById(id);
  }

  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (key === 'class') {
          node.className = value;
        } else if (key === 'text') {
          node.textContent = value;
        } else if (key === 'style') {
          node.setAttribute('style', value);
        } else if (key.slice(0, 2) === 'on') {
          node.addEventListener(key.slice(2), value);
        } else {
          node.setAttribute(key, value);
        }
      });
    }
    (children || []).forEach(function (child) {
      if (child) {
        node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
      }
    });
    return node;
  }

  function announce(message) {
    var live = $('live-status');
    live.textContent = '';
    window.setTimeout(function () {
      live.textContent = message;
    }, 60);
  }

  function showFormError(id, message) {
    var node = $(id);
    node.textContent = message;
    node.hidden = false;
  }

  function clearFormError(id) {
    var node = $(id);
    node.textContent = '';
    node.hidden = true;
  }

  function todayLocal() {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function tempColor(tempF) {
    var clamped = Math.max(10, Math.min(115, tempF));
    var frac = (clamped - 10) / 105;
    var hue = 210 - 190 * frac;
    return 'hsl(' + hue.toFixed(1) + ', 62%, 52%)';
  }

  function tierChip(tierName, colorKey) {
    return h('span', { class: 'tier-chip', 'data-key': colorKey || '', text: tierName });
  }

  function colorKeyFor(tierName) {
    var tier = policy.listTiers().filter(function (t) { return t.name === tierName; })[0];
    return tier ? tier.colorKey : '';
  }

  function downloadFile(name, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var link = h('a', { href: url, download: name });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 500);
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        fixtureKey: state.fixtureKey,
        decisions: state.tracker.getDecisions(),
        department: state.registry.snapshot()
      }));
    } catch (err) {
      /* Storage may be unavailable in private browsing; the session still works. */
    }
  }

  function loadState() {
    var saved;
    try {
      saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (err) {
      saved = null;
    }
    if (!saved) {
      return;
    }
    if (saved.fixtureKey === 'winter' || saved.fixtureKey === 'summer') {
      state.fixtureKey = saved.fixtureKey;
    }
    if (Array.isArray(saved.decisions)) {
      state.tracker.replaceDecisions(saved.decisions);
    }
    if (saved.department) {
      state.registry.restore(saved.department);
    }
  }

  /* ---------------------------------------------------------------------
     Tabs
     --------------------------------------------------------------------- */

  var TAB_IDS = ['forecast', 'policy', 'departments'];

  function activateTab(key) {
    TAB_IDS.forEach(function (id) {
      var tab = $('tab-' + id);
      var panel = $('panel-' + id);
      var selected = id === key;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
      panel.hidden = !selected;
      if (selected) {
        panel.classList.remove('panel-enter');
        void panel.offsetWidth;
        panel.classList.add('panel-enter');
      }
    });
  }

  function setupTabs() {
    var tabs = TAB_IDS.map(function (id) { return $('tab-' + id); });

    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () {
        activateTab(TAB_IDS[index]);
      });
      tab.addEventListener('keydown', function (event) {
        var target = null;
        if (event.key === 'ArrowRight') {
          target = (index + 1) % tabs.length;
        } else if (event.key === 'ArrowLeft') {
          target = (index - 1 + tabs.length) % tabs.length;
        } else if (event.key === 'Home') {
          target = 0;
        } else if (event.key === 'End') {
          target = tabs.length - 1;
        }
        if (target !== null) {
          event.preventDefault();
          activateTab(TAB_IDS[target]);
          tabs[target].focus();
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
     Forecast panel
     --------------------------------------------------------------------- */

  function getSelectedFixture() {
    var checked = document.querySelector('input[name="fixture"]:checked');
    return checked ? checked.value : 'summer';
  }

  function forecastPeakHeatIndex(hours) {
    var values = hours
      .map(function (h2) { return h2.heatIndexF; })
      .filter(function (v) { return v !== null; });
    return values.length ? values.reduce(function (a, b) { return Math.max(a, b); }) : null;
  }

  function forecastLowestWindChill(hours) {
    var values = hours
      .map(function (h2) { return h2.windChillF; })
      .filter(function (v) { return v !== null; });
    return values.length ? values.reduce(function (a, b) { return Math.min(a, b); }) : null;
  }

  function renderForecast() {
    var fixture = fixtures[state.fixtureKey];
    var observations = fixture.observations;
    state.forecast = engine.buildHourlyForecast(observations, { hours: 12 });
    state.discussion = engine.buildDiscussion(state.forecast);
    var hours = state.forecast.hours;
    var anchor = state.forecast.anchor;

    var peak = hours.reduce(function (a, b) { return b.temperatureF > a.temperatureF ? b : a; });
    var peakHi = forecastPeakHeatIndex(hours);
    var minWc = forecastLowestWindChill(hours);
    var peakHiHour = peakHi === null ? null : hours.filter(function (h2) { return h2.heatIndexF === peakHi; })[0];
    var minWcHour = minWc === null ? null : hours.filter(function (h2) { return h2.windChillF === minWc; })[0];

    $('stat-peak-temp').textContent = Math.round(peak.temperatureF) + '\u00B0F';
    $('stat-peak-temp-sub').textContent = 'around ' + engine.hourLabel(peak.time);

    $('stat-peak-hi').textContent = peakHi === null ? 'None' : Math.round(peakHi) + '\u00B0F';
    $('stat-peak-hi-sub').textContent = peakHi === null
      ? 'not reached in this window'
      : 'around ' + engine.hourLabel(peakHiHour.time);

    $('stat-min-wc').textContent = minWc === null ? 'None' : Math.round(minWc) + '\u00B0F';
    $('stat-min-wc-sub').textContent = minWc === null
      ? 'not reached in this window'
      : 'around ' + engine.hourLabel(minWcHour.time);

    $('stat-sky').textContent = engine.cloudCategory(anchor.cloudCoverPercent);
    $('stat-sky-sub').textContent = anchor.cloudCoverPercent + ' percent cover at the anchor';

    var ribbon = $('heat-ribbon');
    var scale = $('ribbon-scale');
    ribbon.textContent = '';
    scale.textContent = '';
    hours.forEach(function (hour, index) {
      ribbon.appendChild(h('div', {
        class: 'ribbon-cell',
        style: 'background:' + tempColor(hour.temperatureF) + ';animation-delay:' + (index * 35) + 'ms',
        title: engine.hourLabel(hour.time) + ', ' + hour.temperatureF + '\u00B0F'
      }));
      scale.appendChild(h('span', { text: engine.hourLabel(hour.time) }));
    });

    var coldest = hours.reduce(function (a, b) { return b.temperatureF < a.temperatureF ? b : a; });
    $('ribbon-note').textContent = 'Ribbon of 12 forecast hours from ' + engine.hourLabel(hours[0].time)
      + ' to ' + engine.hourLabel(hours[hours.length - 1].time) + '. Temperatures range from '
      + Math.round(coldest.temperatureF) + ' to ' + Math.round(peak.temperatureF) + ' degrees Fahrenheit.';

    var body = $('forecast-table-body');
    body.textContent = '';
    hours.forEach(function (hour) {
      body.appendChild(h('tr', null, [
        h('td', { text: engine.hourLabel(hour.time) }),
        h('td', { class: 'num', text: hour.temperatureF + '\u00B0' }),
        h('td', { class: 'num', text: hour.dewPointF + '\u00B0' }),
        h('td', { class: 'num', text: hour.windSpeedMph + ' mph' + (hour.windDirection ? ' ' + hour.windDirection : '') }),
        h('td', { class: 'num', text: hour.cloudCoverPercent + '%' }),
        h('td', { class: 'num', text: hour.relativeHumidity + '%' }),
        hour.heatIndexF === null
          ? h('td', { class: 'num none', text: 'None' })
          : h('td', { class: 'num', text: hour.heatIndexF + '\u00B0' }),
        hour.windChillF === null
          ? h('td', { class: 'num none', text: 'None' })
          : h('td', { class: 'num', text: hour.windChillF + '\u00B0' })
      ]));
    });
    $('forecast-caption').textContent = fixture.label + ' fixture, 12 forecast hours from an anchor at '
      + engine.hourLabel(anchor.time) + '. Synthetic data.';

    $('discussion-headline').textContent = state.discussion.headline;
    var sentences = $('discussion-sentences');
    sentences.textContent = '';
    state.discussion.sentences.forEach(function (sentence) {
      sentences.appendChild(h('p', { text: sentence }));
    });
    $('forecast-method').textContent = 'Method: ' + state.forecast.method
      + ', computed locally from the labeled synthetic fixture.';

    $('forecast-meta').textContent = fixture.label + ', ' + observations.length
      + ' observations, anchor at ' + engine.hourLabel(anchor.time) + '.';

    $('forecast-results').hidden = false;
    announce('Forecast ready for ' + fixture.label + '.');
  }

  function runForecast() {
    state.fixtureKey = getSelectedFixture();
    saveState();
    renderForecast();
  }

  function setupForecast() {
    var radios = document.querySelectorAll('input[name="fixture"]');
    radios.forEach(function (radio) {
      radio.addEventListener('change', runForecast);
      if (radio.value === state.fixtureKey) {
        radio.checked = true;
      }
    });
    $('run-forecast').addEventListener('click', runForecast);
    renderForecast();
  }

  /* ---------------------------------------------------------------------
     Policy panel
     --------------------------------------------------------------------- */

  function renderTierLegend() {
    var list = $('tier-legend');
    list.textContent = '';
    policy.listTiers().forEach(function (tier) {
      var range = tier.min === null
        ? 'Below ' + tier.max
        : (tier.max === null ? tier.min + ' and above' : tier.min + ' up to ' + tier.max);
      list.appendChild(h('li', null, [
        tierChip(tier.name, tier.colorKey),
        h('span', { class: 'tier-range', text: 'Heat index ' + range + ' F' }),
        h('span', { class: 'tier-actions', text: tier.requiredActions[0] + '. Total actions: ' + tier.requiredActions.length + '.' })
      ]));
    });
  }

  function renderDecisionTypeOptions() {
    var select = $('decision-type');
    select.textContent = '';
    policy.listDecisions().forEach(function (decision) {
      select.appendChild(h('option', { value: decision, text: decision }));
    });
  }

  function renderFeedback(record) {
    $('feedback-empty').hidden = true;
    var body = $('feedback-body');
    body.hidden = false;
    body.textContent = '';

    var actions = policy.listTiers().filter(function (t) { return t.name === record.tier; })[0].requiredActions;
    var actionList = h('ul', { class: 'required-list' });
    actions.forEach(function (action) {
      actionList.appendChild(h('li', { text: action }));
    });

    body.appendChild(h('div', { class: 'verdict-body' }, [
      h('p', { class: 'record-line' }, [
        document.createTextNode(record.date + ' | ' + record.activity + ' | heat index ' + record.heatIndexF + '\u00B0F | '),
        tierChip(record.tier, colorKeyFor(record.tier))
      ]),
      h('p', { class: 'verdict-line' + (record.compliance === 'Needs Review' ? ' flag' : ''), text: record.message }),
      h('p', { class: 'record-line', text: 'Required actions at this tier:' }),
      actionList,
      h('p', { class: 'record-line', text: 'Status recorded as ' + record.compliance + '. ' + (record.notes ? 'Notes: ' + record.notes + '.' : '') })
    ]));
  }

  function renderDecisionTable() {
    var body = $('decision-table-body');
    body.textContent = '';
    var decisions = state.tracker.getDecisions().slice().reverse();
    $('decision-empty').hidden = decisions.length > 0;
    decisions.forEach(function (record) {
      body.appendChild(h('tr', null, [
        h('td', { text: record.date }),
        h('td', { text: record.department }),
        h('td', { text: record.activity }),
        h('td', { class: 'num', text: record.heatIndexF + '\u00B0' }),
        h('td', null, [tierChip(record.tier, colorKeyFor(record.tier))]),
        h('td', { text: record.decision }),
        h('td', { text: record.compliance }),
        h('td', { text: record.notes || '' })
      ]));
    });
  }

  function renderEscalations() {
    var list = $('escalation-list');
    list.textContent = '';
    var escalations = state.tracker.getEscalations();
    if (!escalations.length) {
      list.appendChild(h('li', { text: 'No escalations recorded yet. When conditions climb a tier between decisions, the jump is recorded here.' }));
      return;
    }
    escalations.forEach(function (escalation) {
      list.appendChild(h('li', {
        text: escalation.date + ': ' + escalation.from + ' rose to ' + escalation.to
          + ' during ' + escalation.activity + ' (' + escalation.department + ').'
      }));
    });
  }

  function renderPolicyStats() {
    var summary = state.tracker.getSummary();
    $('stat-decisions').textContent = String(summary.decisionCount);
    $('stat-flagged').textContent = String(summary.flaggedCount);
    $('stat-escalations').textContent = String(summary.escalationCount);
    $('stat-span').textContent = summary.firstDate
      ? 'From ' + summary.firstDate + ' to ' + summary.lastDate
      : 'Across the season';
  }

  function refreshDepartmentSelects() {
    var departments = state.registry.listDepartments();

    var decisionSelect = $('decision-department');
    decisionSelect.textContent = '';
    decisionSelect.appendChild(h('option', { value: 'Unassigned', text: 'Unassigned' }));
    departments.forEach(function (department) {
      decisionSelect.appendChild(h('option', { value: department.name, text: department.name }));
    });

    [['member-department', 'Add a department first'], ['season-department', 'Add a department first']]
      .forEach(function (pair) {
        var select = $(pair[0]);
        select.textContent = '';
        if (!departments.length) {
          select.appendChild(h('option', { value: '', text: pair[1] }));
        } else {
          departments.forEach(function (department) {
            select.appendChild(h('option', { value: department.id, text: department.name }));
          });
        }
      });
  }

  function setupPolicy() {
    renderTierLegend();
    renderDecisionTypeOptions();
    renderDecisionTable();
    renderEscalations();
    renderPolicyStats();

    $('use-forecast-peak').addEventListener('change', function (event) {
      $('decision-hi').disabled = event.target.checked;
    });

    $('decision-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var heatIndexF;
      if ($('use-forecast-peak').checked) {
        if (!state.forecast) {
          showFeedbackError('Run the forecast once, then log the decision.');
          return;
        }
        heatIndexF = forecastPeakHeatIndex(state.forecast.hours);
        if (heatIndexF === null) {
          showFeedbackError('The current forecast window never reaches a heat index. Enter a reading instead.');
          return;
        }
      } else {
        heatIndexF = parseFloat($('decision-hi').value, 10);
        if (!isFinite(heatIndexF)) {
          showFeedbackError('Enter a heat index reading, or check the forecast peak box.');
          return;
        }
      }

      var input = {
        date: $('decision-date').value,
        department: $('decision-department').value,
        activity: $('decision-activity').value,
        heatIndexF: heatIndexF,
        decision: $('decision-type').value,
        notes: $('decision-notes').value
      };

      try {
        var record = state.tracker.addDecision(input);
        renderFeedback(record);
        renderDecisionTable();
        renderEscalations();
        renderPolicyStats();
        saveState();
        announce('Decision logged at ' + record.tier + '. ' + record.message);
      } catch (err) {
        showFeedbackError(err.message);
      }
    });

    function showFeedbackError(message) {
      $('feedback-empty').hidden = true;
      var body = $('feedback-body');
      body.hidden = false;
      body.textContent = '';
      body.appendChild(h('p', { class: 'verdict-line flag', text: message }));
    }

    $('export-csv').addEventListener('click', function () {
      downloadFile('stemergent-heat-policy-summary.csv', state.tracker.exportCsv(), 'text/csv');
      announce('CSV summary downloaded.');
    });

    $('export-json').addEventListener('click', function () {
      downloadFile('stemergent-heat-policy-summary.json', state.tracker.exportJson(), 'application/json');
      announce('JSON summary downloaded.');
    });

    $('clear-data').addEventListener('click', function () {
      var sure = window.confirm('Clear all stored decisions, departments, and calendars from this browser?');
      if (!sure) {
        return;
      }
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        /* Nothing stored in the first place. */
      }
      state.tracker = policy.createTracker();
      state.registry = departmentModule.createRegistry();
      renderDecisionTable();
      renderEscalations();
      renderPolicyStats();
      renderDepartments();
      refreshDepartmentSelects();
      $('feedback-empty').hidden = false;
      $('feedback-body').hidden = true;
      announce('Stored data cleared.');
    });
  }

  /* ---------------------------------------------------------------------
     Departments panel
     --------------------------------------------------------------------- */

  function renderDepartments() {
    var list = $('department-list');
    list.textContent = '';
    var departments = state.registry.listDepartments();
    if (!departments.length) {
      list.appendChild(h('li', { text: 'No departments yet. Add the first one above.' }));
      return;
    }
    departments.forEach(function (department) {
      list.appendChild(h('li', null, [
        h('span', { class: 'dept-name', text: department.name }),
        h('span', { class: 'dept-meta', text: department.memberCount + (department.memberCount === 1 ? ' member' : ' members') }),
        department.description ? h('span', { class: 'dept-desc', text: department.description }) : null
      ]));
    });
  }

  function renderMembers() {
    var list = $('member-list');
    list.textContent = '';
    var members = state.registry.listMembers();
    if (!members.length) {
      list.appendChild(h('li', { text: 'No members yet. Add one with a department and role.' }));
      return;
    }
    members.forEach(function (member) {
      list.appendChild(h('li', null, [
        h('span', { class: 'dept-name', text: member.name }),
        tierChip(member.roleName, ''),
        h('span', { class: 'dept-meta', text: member.departmentName + ' | ' + member.permissions.join(', ') })
      ]));
    });
  }

  function renderSeasons() {
    var list = $('season-list');
    list.textContent = '';
    var seasons = state.registry.listSeasons();
    if (!seasons.length) {
      list.appendChild(h('li', { text: 'No season calendars yet. Add one with a start and end date.' }));
      return;
    }
    var today = todayLocal();
    seasons.forEach(function (season) {
      var active = state.registry.isDateActive(season.id, today);
      list.appendChild(h('li', null, [
        h('span', { class: 'dept-name', text: season.name }),
        h('span', { class: 'dept-meta', text: season.departmentName + ' | ' + season.startDate + ' to ' + season.endDate }),
        h('span', { class: 'dept-meta', text: season.blackoutDates.length + ' blackout dates' }),
        active ? tierChip('Active today', 'moss') : null
      ]));
    });
  }

  function renderRoleOptions() {
    var select = $('member-role');
    select.textContent = '';
    state.registry.listRoles().forEach(function (role) {
      select.appendChild(h('option', { value: role.id, text: role.name }));
    });
  }

  function setupDepartments() {
    $('department-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var result = state.registry.addDepartment(
        $('department-name').value,
        $('department-description').value
      );
      if (!result.ok) {
        showFormError('department-error', result.error);
        return;
      }
      clearFormError('department-error');
      $('department-name').value = '';
      $('department-description').value = '';
      renderDepartments();
      refreshDepartmentSelects();
      saveState();
      announce('Department ' + result.department.name + ' added.');
    });

    $('member-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var result = state.registry.addMember(
        $('member-name').value,
        $('member-department').value,
        $('member-role').value
      );
      if (!result.ok) {
        showFormError('member-error', result.error);
        return;
      }
      clearFormError('member-error');
      $('member-name').value = '';
      renderMembers();
      renderDepartments();
      saveState();
      announce('Member ' + result.member.name + ' added.');
    });

    $('season-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var blackouts = $('season-blackouts').value
        .split(',')
        .map(function (s) { return s.trim(); })
        .filter(Boolean);
      var result = state.registry.addSeason({
        name: $('season-name').value,
        departmentId: $('season-department').value,
        startDate: $('season-start').value,
        endDate: $('season-end').value,
        blackoutDates: blackouts
      });
      if (!result.ok) {
        showFormError('season-error', result.error);
        return;
      }
      clearFormError('season-error');
      $('season-name').value = '';
      $('season-blackouts').value = '';
      renderSeasons();
      saveState();
      announce('Season calendar ' + result.season.name + ' added.');
    });

    renderDepartments();
    renderMembers();
    renderSeasons();
    renderRoleOptions();
  }

  /* ---------------------------------------------------------------------
     Init
     --------------------------------------------------------------------- */

  loadState();
  setupTabs();
  setupForecast();
  refreshDepartmentSelects();
  setupPolicy();
  setupDepartments();
  $('decision-date').value = todayLocal();
})();
