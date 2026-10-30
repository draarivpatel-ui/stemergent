'use strict';

/*
 * Department module behavior tests. This file and
 * tests/department-isolation.test.js form the department module's own
 * isolated test file group: they load only js/department.js.
 */
const test = require('node:test');
const assert = require('node:assert');
const { createRegistry } = require('../js/department.js');

test('a fresh registry seeds three default roles and no departments', () => {
  const registry = createRegistry();
  assert.strictEqual(registry.listDepartments().length, 0);
  const roles = registry.listRoles();
  assert.strictEqual(roles.length, 3);
  assert.deepStrictEqual(roles.map((r) => r.name), ['Coordinator', 'Reviewer', 'Viewer']);
  assert.deepStrictEqual(roles.find((r) => r.name === 'Viewer').permissions, ['view']);
});

test('departments are added with unique names', () => {
  const registry = createRegistry();
  const first = registry.addDepartment('Athletics', 'Varsity and practice programs');
  assert.strictEqual(first.ok, true);
  assert.strictEqual(first.department.id, 'd1');
  const second = registry.addDepartment('Marching Band');
  assert.strictEqual(second.ok, true);
  assert.strictEqual(second.department.id, 'd2');
  const duplicate = registry.addDepartment('athletics');
  assert.strictEqual(duplicate.ok, false);
  assert.ok(/already exists/.test(duplicate.error));
  const blank = registry.addDepartment('   ');
  assert.strictEqual(blank.ok, false);
  assert.strictEqual(registry.listDepartments().length, 2);
});

test('members join departments through roles and permissions follow', () => {
  const registry = createRegistry();
  registry.addDepartment('Athletics');
  const roles = registry.listRoles();
  const coordinator = roles.find((r) => r.name === 'Coordinator');
  const viewer = roles.find((r) => r.name === 'Viewer');

  const member = registry.addMember('Casey', 'd1', coordinator.id);
  assert.strictEqual(member.ok, true);
  assert.strictEqual(member.member.id, 'm1');

  const viewerMember = registry.addMember('Riley', 'd1', viewer.id);
  assert.strictEqual(viewerMember.ok, true);

  assert.strictEqual(registry.can('m1', 'approve'), true);
  assert.strictEqual(registry.can('m1', 'manage_calendar'), true);
  assert.strictEqual(registry.can('m2', 'approve'), false);
  assert.strictEqual(registry.can('m2', 'view'), true);
  assert.strictEqual(registry.can('nobody', 'view'), false);

  const badDepartment = registry.addMember('Sam', 'd99', viewer.id);
  assert.strictEqual(badDepartment.ok, false);
  const badRole = registry.addMember('Sam', 'd1', 'r999');
  assert.strictEqual(badRole.ok, false);
  const blankName = registry.addMember('', 'd1', viewer.id);
  assert.strictEqual(blankName.ok, false);
});

test('roles can be reassigned and custom roles can be created', () => {
  const registry = createRegistry();
  registry.addDepartment('Athletics');
  registry.addMember('Casey', 'd1', 'r3');

  assert.strictEqual(registry.can('m1', 'review'), false);
  const reassigned = registry.assignRole('m1', 'r2');
  assert.strictEqual(reassigned.ok, true);
  assert.strictEqual(registry.can('m1', 'review'), true);

  const custom = registry.addRole('Field Lead', ['view', 'review']);
  assert.strictEqual(custom.ok, true);
  assert.strictEqual(custom.role.id, 'r4');
  const duplicate = registry.addRole('viewer');
  assert.strictEqual(duplicate.ok, false);
  const noPermissions = registry.addRole('Empty', []);
  assert.strictEqual(noPermissions.ok, false);
  const unknownAssign = registry.assignRole('m1', 'r999');
  assert.strictEqual(unknownAssign.ok, false);
});

test('member listings carry department and role names', () => {
  const registry = createRegistry();
  registry.addDepartment('Athletics');
  registry.addDepartment('Marching Band');
  registry.addMember('Casey', 'd1', 'r1');
  registry.addMember('Riley', 'd2', 'r3');
  const all = registry.listMembers();
  assert.strictEqual(all.length, 2);
  assert.strictEqual(all[0].departmentName, 'Athletics');
  assert.strictEqual(all[0].roleName, 'Coordinator');
  const athleticsOnly = registry.listMembers('d1');
  assert.strictEqual(athleticsOnly.length, 1);
  assert.strictEqual(athleticsOnly[0].name, 'Casey');
});

test('season calendars reject invalid ranges and cross department overlaps', () => {
  const registry = createRegistry();
  registry.addDepartment('Athletics');
  registry.addDepartment('Marching Band');

  const good = registry.addSeason({
    name: 'Fall Season',
    departmentId: 'd1',
    startDate: '2026-08-03',
    endDate: '2026-11-20',
    blackoutDates: ['2026-09-07']
  });
  assert.strictEqual(good.ok, true);
  assert.strictEqual(good.season.id, 's1');

  assert.strictEqual(registry.addSeason({
    name: 'Bad Order', departmentId: 'd1', startDate: '2026-11-01', endDate: '2026-10-01'
  }).ok, false);
  assert.strictEqual(registry.addSeason({
    name: 'Bad Format', departmentId: 'd1', startDate: '08/03/2026', endDate: '2026-11-20'
  }).ok, false);
  assert.strictEqual(registry.addSeason({
    name: 'Bad Day', departmentId: 'd1', startDate: '2026-02-30', endDate: '2026-11-20'
  }).ok, false);
  assert.strictEqual(registry.addSeason({
    name: 'Overlap', departmentId: 'd1', startDate: '2026-10-01', endDate: '2026-12-15'
  }).ok, false);
  assert.strictEqual(registry.addSeason({
    name: 'Unknown Dept', departmentId: 'd9', startDate: '2026-12-01', endDate: '2026-12-20'
  }).ok, false);
  const otherDepartment = registry.addSeason({
    name: 'Band Season', departmentId: 'd2', startDate: '2026-10-01', endDate: '2026-12-15'
  });
  assert.strictEqual(otherDepartment.ok, true, 'a different department may overlap');
  assert.strictEqual(registry.addSeason({
    name: 'Blackout Typo', departmentId: 'd2', startDate: '2027-01-01', endDate: '2027-02-01', blackoutDates: ['2027-1-1']
  }).ok, false);
});

test('isDateActive respects the range and blackout dates', () => {
  const registry = createRegistry();
  registry.addDepartment('Athletics');
  registry.addSeason({
    name: 'Fall Season',
    departmentId: 'd1',
    startDate: '2026-08-03',
    endDate: '2026-11-20',
    blackoutDates: ['2026-09-07']
  });
  assert.strictEqual(registry.isDateActive('s1', '2026-08-03'), true);
  assert.strictEqual(registry.isDateActive('s1', '2026-11-20'), true);
  assert.strictEqual(registry.isDateActive('s1', '2026-10-15'), true);
  assert.strictEqual(registry.isDateActive('s1', '2026-09-07'), false);
  assert.strictEqual(registry.isDateActive('s1', '2026-08-02'), false);
  assert.strictEqual(registry.isDateActive('s1', '2026-11-21'), false);
  assert.strictEqual(registry.isDateActive('s1', 'junk'), false);
  assert.strictEqual(registry.isDateActive('s999', '2026-10-15'), false);
});

test('seasons list sorted by start date with department names', () => {
  const registry = createRegistry();
  registry.addDepartment('Athletics');
  registry.addSeason({ name: 'Fall', departmentId: 'd1', startDate: '2026-08-03', endDate: '2026-11-20' });
  registry.addSeason({ name: 'Spring', departmentId: 'd1', startDate: '2027-02-15', endDate: '2027-05-20' });
  const seasons = registry.listSeasons();
  assert.strictEqual(seasons.length, 2);
  assert.strictEqual(seasons[0].name, 'Fall');
  assert.strictEqual(seasons[1].name, 'Spring');
  assert.strictEqual(seasons[0].departmentName, 'Athletics');
});

test('snapshot and restore round trip the registry', () => {
  const registry = createRegistry();
  registry.addDepartment('Athletics');
  registry.addMember('Casey', 'd1', 'r1');
  registry.addSeason({ name: 'Fall', departmentId: 'd1', startDate: '2026-08-03', endDate: '2026-11-20' });
  const data = registry.snapshot();

  const second = createRegistry();
  const restored = second.restore(JSON.parse(JSON.stringify(data)));
  assert.ok(restored >= 3, 'departments, members, and seasons all restore');
  assert.strictEqual(second.listDepartments().length, 1);
  assert.strictEqual(second.listMembers().length, 1);
  assert.strictEqual(second.listSeasons().length, 1);
  assert.strictEqual(second.can('m1', 'approve'), true);

  const fresh = createRegistry();
  assert.strictEqual(fresh.restore(null), 0);
  assert.strictEqual(fresh.restore({ departments: 'nope' }), 0);
});
