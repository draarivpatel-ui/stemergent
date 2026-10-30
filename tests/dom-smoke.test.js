'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'css', 'styles.css'), 'utf8');
const APP_JS = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
const engine = require('../js/forecast-engine.js');
const policy = require('../js/policy-tracker.js');
const department = require('../js/department.js');
const fixtures = require('../data/fixtures.js');

class FakeEl {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.className = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.tabIndex = 0;
    this._textContent = '';
    this.attrs = {};
    this.listeners = {};
    this.children = [];
    this.classList = {
      _set: new Set(),
      add: (...names) => names.forEach((n) => this.classList._set.add(n)),
      remove: (...names) => names.forEach((n) => this.classList._set.delete(n)),
      contains: (n) => this.classList._set.has(n)
    };
  }
  get textContent() {
    if (this.children.length === 0) return this._textContent;
    return this._textContent + this.children.map((c) => (typeof c === 'string' ? c : c.textContent)).join('');
  }
  set textContent(val) {
    this._textContent = String(val);
    this.children = [];
  }
  get offsetWidth() {
    return 100;
  }
  appendChild(node) {
    this.children.push(node);
    return node;
  }
  removeChild(node) {
    const idx = this.children.indexOf(node);
    if (idx >= 0) this.children.splice(idx, 1);
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  getAttribute(k) {
    return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
  }
  addEventListener(type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  }
  fire(type, extra = {}) {
    for (const fn of this.listeners[type] || []) {
      fn(Object.assign({ target: this, preventDefault() {} }, extra));
    }
  }
  focus() {
    this.focused = true;
  }
  click() {
    this.fire('click');
  }
}

function mountStemergentDom() {
  const els = {};
  const getEl = (id) => {
    if (!els[id]) els[id] = new FakeEl('div', id);
    return els[id];
  };
  for (const m of HTML.matchAll(/\bid="([^"]+)"/g)) {
    getEl(m[1]);
  }
  const radioSummer = new FakeEl('input', 'radio-summer');
  radioSummer.value = 'summer';
  radioSummer.checked = true;
  const radioWinter = new FakeEl('input', 'radio-winter');
  radioWinter.value = 'winter';
  radioWinter.checked = false;
  const radios = [radioSummer, radioWinter];

  const store = {};
  const document = {
    body: new FakeEl('body'),
    getElementById: (id) => getEl(id),
    createElement: (tag) => new FakeEl(tag),
    createTextNode: (str) => ({ textContent: String(str) }),
    querySelector: (sel) => {
      if (sel === 'input[name="fixture"]:checked') {
        return radios.find((r) => r.checked) || radioSummer;
      }
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === 'input[name="fixture"]') return radios;
      return [];
    }
  };

  const window = {
    document,
    StemergentForecast: engine,
    StemergentPolicy: policy,
    StemergentDepartment: department,
    StemergentFixtures: fixtures,
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    setTimeout: (fn) => { fn(); return 1; },
    confirm: () => true,
    Blob: class Blob { constructor(parts) { this.parts = parts; } },
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} }
  };

  const context = vm.createContext({
    window,
    document,
    Blob: window.Blob,
    URL: window.URL,
    Date,
    Math,
    JSON,
    parseFloat,
    parseInt,
    isFinite,
    String,
    Number,
    Array,
    Object
  });
  vm.runInContext(APP_JS, context);
  return { getEl, radios, store };
}

test('DOM shell: doctype, html lang, charset, viewport, and title', function () {
  assert.match(HTML, /^<!DOCTYPE html>/i);
  assert.match(HTML, /<html lang="en">/);
  assert.match(HTML, /<meta charset="utf-8">/i);
  assert.match(HTML, /<meta name="viewport"/);
  assert.match(HTML, /<title>STEMergent Forecast and Heat Policy Planner<\/title>/);
});

test('DOM shell: OpenGraph and Twitter card metadata are complete', function () {
  assert.match(HTML, /property="og:title"/);
  assert.match(HTML, /property="og:description"/);
  assert.match(HTML, /property="og:type" content="website"/);
  assert.match(HTML, /name="twitter:card" content="summary"/);
});

test('DOM shell: skip link, live status region, and noscript fallback exist', function () {
  assert.match(HTML, /<a class="skip-link" href="#main">/);
  assert.ok(HTML.includes('id="live-status"'));
  assert.match(HTML, /<noscript>/);
});

test('DOM shell: three ARIA tabs and matching tabpanels exist', function () {
  assert.ok(HTML.includes('id="tab-forecast"'));
  assert.ok(HTML.includes('id="tab-policy"'));
  assert.ok(HTML.includes('id="tab-departments"'));
  assert.ok(HTML.includes('id="panel-forecast"'));
  assert.ok(HTML.includes('id="panel-policy"'));
  assert.ok(HTML.includes('id="panel-departments"'));
});

test('DOM shell: Forecast Engine fixture form, stats, ribbon, table, and discussion exist', function () {
  assert.ok(HTML.includes('id="fixture-form"'));
  assert.ok(HTML.includes('id="run-forecast"'));
  assert.ok(HTML.includes('id="forecast-results"'));
  assert.ok(HTML.includes('id="stat-peak-temp"'));
  assert.ok(HTML.includes('id="stat-peak-hi"'));
  assert.ok(HTML.includes('id="stat-min-wc"'));
  assert.ok(HTML.includes('id="heat-ribbon"'));
  assert.ok(HTML.includes('id="forecast-table-body"'));
  assert.ok(HTML.includes('id="discussion-headline"'));
});

test('DOM shell: Heat Policy Tracker form, verdict feedback, exports, and tables exist', function () {
  assert.ok(HTML.includes('id="tier-legend"'));
  assert.ok(HTML.includes('id="decision-form"'));
  assert.ok(HTML.includes('id="decision-date"'));
  assert.ok(HTML.includes('id="decision-department"'));
  assert.ok(HTML.includes('id="decision-activity"'));
  assert.ok(HTML.includes('id="decision-hi"'));
  assert.ok(HTML.includes('id="decision-type"'));
  assert.ok(HTML.includes('id="export-csv"'));
  assert.ok(HTML.includes('id="export-json"'));
  assert.ok(HTML.includes('id="decision-table-body"'));
  assert.ok(HTML.includes('id="escalation-list"'));
});

test('DOM shell: Departments, Members, and Season Calendars forms and lists exist', function () {
  assert.ok(HTML.includes('id="department-form"'));
  assert.ok(HTML.includes('id="department-list"'));
  assert.ok(HTML.includes('id="member-form"'));
  assert.ok(HTML.includes('id="member-list"'));
  assert.ok(HTML.includes('id="season-form"'));
  assert.ok(HTML.includes('id="season-list"'));
});

test('CSS and copy hygiene: focus-visible, tabular-nums, reduced-motion, and no banned dashes', function () {
  assert.match(CSS, /:focus-visible/);
  assert.match(CSS, /tabular-nums/);
  assert.match(CSS, /prefers-reduced-motion:\s*reduce/);
  assert.equal(/[\u2013\u2014]/.test(HTML), false);
  assert.equal(/[\u2013\u2014]/.test(CSS), false);
  assert.equal(/[\u2013\u2014]/.test(APP_JS), false);
});

test('Interactive DOM runtime: app.js renders summer and winter fixtures, logs policy decisions, and updates departments', function () {
  const { getEl, radios, store } = mountStemergentDom();

  // 1. Initial summer forecast render
  assert.equal(getEl('forecast-results').hidden, false);
  assert.equal(getEl('heat-ribbon').children.length, 12);
  assert.equal(getEl('forecast-table-body').children.length, 12);
  assert.match(getEl('stat-peak-hi').textContent, /°F$/);
  assert.equal(getEl('stat-min-wc').textContent, 'None');

  // 2. Switch to winter fixture and re-run forecast
  radios[0].checked = false;
  radios[1].checked = true;
  radios[1].fire('change');
  assert.equal(getEl('stat-peak-hi').textContent, 'None');
  assert.match(getEl('stat-min-wc').textContent, /°F$/);

  // Switch back to summer for forecast peak checkbox test
  radios[1].checked = false;
  radios[0].checked = true;
  getEl('run-forecast').fire('click');

  // 3. Tab navigation via click and keyboard
  getEl('tab-policy').fire('click');
  assert.equal(getEl('tab-policy').getAttribute('aria-selected'), 'true');
  assert.equal(getEl('panel-policy').hidden, false);
  assert.equal(getEl('panel-forecast').hidden, true);

  getEl('tab-policy').fire('keydown', { key: 'ArrowRight' });
  assert.equal(getEl('tab-departments').getAttribute('aria-selected'), 'true');
  assert.equal(getEl('panel-departments').hidden, false);

  // 4. Departments, Members, and Season Calendars forms
  getEl('department-name').value = 'Athletics';
  getEl('department-description').value = 'Track and field';
  getEl('department-form').fire('submit');
  assert.equal(getEl('department-list').children.length, 1);

  getEl('member-name').value = 'Coach Rivera';
  getEl('member-department').value = 'd1';
  getEl('member-role').value = 'r1';
  getEl('member-form').fire('submit');
  assert.equal(getEl('member-list').children.length, 1);

  getEl('season-name').value = 'Fall Track';
  getEl('season-department').value = 'd1';
  getEl('season-start').value = '2026-08-15';
  getEl('season-end').value = '2026-11-15';
  getEl('season-blackouts').value = '2026-09-07';
  getEl('season-form').fire('submit');
  assert.equal(getEl('season-list').children.length, 1);

  // 5. Heat Policy Tracker decision logging & escalations
  getEl('decision-date').value = '2026-08-20';
  getEl('decision-department').value = 'Athletics';
  getEl('decision-activity').value = 'Morning Warmup';
  getEl('decision-hi').value = '84';
  getEl('decision-type').value = 'Full Outdoor Activity';
  getEl('decision-notes').value = 'Shade tents ready';
  getEl('decision-form').fire('submit');
  assert.equal(getEl('stat-decisions').textContent, '1');
  assert.equal(getEl('stat-flagged').textContent, '0');

  // Log second decision using forecast peak with Full Outdoor Activity (flagged in Danger tier)
  getEl('decision-date').value = '2026-08-21';
  getEl('decision-activity').value = 'Afternoon Scrimmage';
  getEl('use-forecast-peak').checked = true;
  getEl('use-forecast-peak').fire('change');
  assert.equal(getEl('decision-hi').disabled, true);
  getEl('decision-type').value = 'Full Outdoor Activity';
  getEl('decision-form').fire('submit');
  assert.equal(getEl('stat-decisions').textContent, '2');
  assert.equal(getEl('stat-flagged').textContent, '1');
  assert.equal(getEl('stat-escalations').textContent, '1');
  assert.ok(store['stemergent.v1']);

  // Export CSV / JSON and clear stored data
  getEl('export-csv').fire('click');
  getEl('export-json').fire('click');
  getEl('clear-data').fire('click');
  assert.equal(getEl('stat-decisions').textContent, '0');
});
