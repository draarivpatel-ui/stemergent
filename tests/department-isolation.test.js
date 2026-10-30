'use strict';

/*
 * Department module isolation tests. These prove the module boundary
 * described in DEPARTMENT.md: the file imports nothing, references none of
 * the other modules, and exposes only its own API.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const department = require('../js/department.js');

const SOURCE_PATH = path.join(__dirname, '..', 'js', 'department.js');
const source = fs.readFileSync(SOURCE_PATH, 'utf8');

test('department.js contains no require calls at all', () => {
  assert.strictEqual(/require\s*\(/.test(source), false, 'the module must not require anything');
  assert.strictEqual(/import\s+/.test(source), false, 'the module must not use import statements');
});

test('department.js references no other module or domain concept', () => {
  ['StemergentForecast', 'StemergentPolicy', 'StemergentFixtures', 'heatIndex', 'windChill', 'heatIndexF', 'forecast', 'policy']
    .forEach((forbidden) => {
      assert.strictEqual(
        source.indexOf(forbidden) !== -1,
        false,
        'department.js must not reference ' + forbidden
      );
    });
});

test('department.js exposes exactly its own API surface', () => {
  const keys = Object.keys(department).sort();
  assert.deepStrictEqual(keys, ['createRegistry']);
  const registry = department.createRegistry();
  assert.deepStrictEqual(
    Object.keys(registry).sort(),
    [
      'addDepartment', 'addMember', 'addRole', 'addSeason', 'assignRole', 'can',
      'isDateActive', 'listDepartments', 'listMembers', 'listRoles', 'listSeasons',
      'restore', 'snapshot'
    ].sort()
  );
});

test('the department test group loads only the department module', () => {
  const groupFiles = ['department.test.js', 'department-isolation.test.js'];
  groupFiles.forEach((file) => {
    const text = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const requires = [...text.matchAll(/require\(([^)]+)\)/g)].map((m) => m[1]);
    requires.forEach((spec) => {
      assert.ok(
        /node:|'\.\.\/js\/department\.js'/.test(spec),
        file + ' required ' + spec + ' which is outside the department group'
      );
    });
  });
});
