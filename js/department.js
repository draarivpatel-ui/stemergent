/*
 * STEMergent Department module.
 *
 * An isolated module managing departments, roles, and season calendars.
 * Boundary rules for this file:
 *
 * 1. It imports nothing. There is no require call, no module loading of any
 *    kind, and no reference to any other module in this repository.
 * 2. It owns its own test file group (tests/department.test.js and
 *    tests/department-isolation.test.js) which load only this file.
 * 3. Integration with the rest of the app happens in the UI layer
 *    (js/app.js) only, so the module itself stays self-contained.
 *
 * See DEPARTMENT.md at the repository root for the full boundary document.
 * This module was written from scratch for this repository and shares no
 * code with any prior project.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.StemergentDepartment = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

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

  function nextId(prefix, usedNumbers) {
    var n = 1;
    while (usedNumbers.indexOf(n) !== -1) {
      n++;
    }
    return prefix + n;
  }

  function idNumbers(items) {
    return items.map(function (item) {
      var match = /^([a-z]+)(\d+)$/.exec(item.id);
      return match ? parseInt(match[2], 10) : 0;
    });
  }

  function createRegistry() {
    var departments = [];
    var roles = [
      { id: 'r1', name: 'Coordinator', permissions: ['approve', 'manage_calendar', 'manage_members', 'review', 'view'] },
      { id: 'r2', name: 'Reviewer', permissions: ['review', 'view'] },
      { id: 'r3', name: 'Viewer', permissions: ['view'] }
    ];
    var members = [];
    var seasons = [];

    function findDepartment(id) {
      for (var i = 0; i < departments.length; i++) {
        if (departments[i].id === id) { return departments[i]; }
      }
      return null;
    }

    function findRole(id) {
      for (var i = 0; i < roles.length; i++) {
        if (roles[i].id === id) { return roles[i]; }
      }
      return null;
    }

    function findMember(id) {
      for (var i = 0; i < members.length; i++) {
        if (members[i].id === id) { return members[i]; }
      }
      return null;
    }

    function findSeason(id) {
      for (var i = 0; i < seasons.length; i++) {
        if (seasons[i].id === id) { return seasons[i]; }
      }
      return null;
    }

    function fail(message) {
      return { ok: false, error: message };
    }

    function addDepartment(name, description) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return fail('A department needs a name.');
      }
      var clean = name.trim();
      for (var i = 0; i < departments.length; i++) {
        if (departments[i].name.toLowerCase() === clean.toLowerCase()) {
          return fail('A department named ' + clean + ' already exists.');
        }
      }
      var department = {
        id: nextId('d', idNumbers(departments)),
        name: clean,
        description: typeof description === 'string' ? description.trim() : ''
      };
      departments.push(department);
      return { ok: true, department: department };
    }

    function listDepartments() {
      return departments.map(function (d) {
        var count = members.filter(function (m) { return m.departmentId === d.id; }).length;
        return { id: d.id, name: d.name, description: d.description, memberCount: count };
      });
    }

    function addRole(name, permissions) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return fail('A role needs a name.');
      }
      var clean = name.trim();
      for (var i = 0; i < roles.length; i++) {
        if (roles[i].name.toLowerCase() === clean.toLowerCase()) {
          return fail('A role named ' + clean + ' already exists.');
        }
      }
      if (!Array.isArray(permissions) || permissions.length === 0) {
        return fail('A role needs at least one permission.');
      }
      var role = {
        id: nextId('r', idNumbers(roles)),
        name: clean,
        permissions: permissions.map(function (p) { return String(p).trim(); }).filter(Boolean)
      };
      roles.push(role);
      return { ok: true, role: role };
    }

    function listRoles() {
      return roles.map(function (r) {
        return { id: r.id, name: r.name, permissions: r.permissions.slice() };
      });
    }

    function addMember(name, departmentId, roleId) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return fail('A member needs a name.');
      }
      if (!findDepartment(departmentId)) {
        return fail('Unknown department for this member.');
      }
      if (!findRole(roleId)) {
        return fail('Unknown role for this member.');
      }
      var member = {
        id: nextId('m', idNumbers(members)),
        name: name.trim(),
        departmentId: departmentId,
        roleId: roleId
      };
      members.push(member);
      return { ok: true, member: member };
    }

    function assignRole(memberId, roleId) {
      var member = findMember(memberId);
      if (!member) {
        return fail('Unknown member.');
      }
      if (!findRole(roleId)) {
        return fail('Unknown role.');
      }
      member.roleId = roleId;
      return { ok: true, member: member };
    }

    function can(memberId, permission) {
      var member = findMember(memberId);
      if (!member) {
        return false;
      }
      var role = findRole(member.roleId);
      if (!role) {
        return false;
      }
      return role.permissions.indexOf(permission) !== -1;
    }

    function listMembers(departmentId) {
      return members
        .filter(function (m) { return !departmentId || m.departmentId === departmentId; })
        .map(function (m) {
          var role = findRole(m.roleId);
          var department = findDepartment(m.departmentId);
          return {
            id: m.id,
            name: m.name,
            departmentId: m.departmentId,
            departmentName: department ? department.name : 'Unknown',
            roleId: m.roleId,
            roleName: role ? role.name : 'Unknown',
            permissions: role ? role.permissions.slice() : []
          };
        });
    }

    function addSeason(input) {
      input = input || {};
      if (typeof input.name !== 'string' || input.name.trim().length === 0) {
        return fail('A season needs a name.');
      }
      if (!findDepartment(input.departmentId)) {
        return fail('Unknown department for this season.');
      }
      if (!isValidDate(input.startDate) || !isValidDate(input.endDate)) {
        return fail('Season dates must be real calendar days formatted as YYYY-MM-DD.');
      }
      if (input.startDate > input.endDate) {
        return fail('The season start date must come before or on the end date.');
      }
      var blackouts = Array.isArray(input.blackoutDates) ? input.blackoutDates.slice() : [];
      for (var b = 0; b < blackouts.length; b++) {
        if (!isValidDate(blackouts[b])) {
          return fail('Blackout dates must be real calendar days formatted as YYYY-MM-DD.');
        }
      }
      for (var i = 0; i < seasons.length; i++) {
        var other = seasons[i];
        if (other.departmentId === input.departmentId
          && input.startDate <= other.endDate
          && input.endDate >= other.startDate) {
          return fail('This season overlaps an existing calendar for the department.');
        }
      }
      var season = {
        id: nextId('s', idNumbers(seasons)),
        departmentId: input.departmentId,
        name: input.name.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        blackoutDates: blackouts
      };
      seasons.push(season);
      seasons.sort(function (a, b2) {
        if (a.startDate !== b2.startDate) { return a.startDate < b2.startDate ? -1 : 1; }
        return a.name < b2.name ? -1 : 1;
      });
      return { ok: true, season: season };
    }

    function listSeasons(departmentId) {
      return seasons
        .filter(function (s) { return !departmentId || s.departmentId === departmentId; })
        .map(function (s) {
          var department = findDepartment(s.departmentId);
          return {
            id: s.id,
            name: s.name,
            departmentId: s.departmentId,
            departmentName: department ? department.name : 'Unknown',
            startDate: s.startDate,
            endDate: s.endDate,
            blackoutDates: s.blackoutDates.slice()
          };
        });
    }

    function isDateActive(seasonId, dateString) {
      var season = findSeason(seasonId);
      if (!season || !isValidDate(dateString)) {
        return false;
      }
      if (dateString < season.startDate || dateString > season.endDate) {
        return false;
      }
      return season.blackoutDates.indexOf(dateString) === -1;
    }

    function snapshot() {
      return {
        departments: departments.map(function (d) { return { id: d.id, name: d.name, description: d.description }; }),
        roles: roles.map(function (r) { return { id: r.id, name: r.name, permissions: r.permissions.slice() }; }),
        members: members.map(function (m) { return { id: m.id, name: m.name, departmentId: m.departmentId, roleId: m.roleId }; }),
        seasons: seasons.map(function (s) {
          return {
            id: s.id,
            departmentId: s.departmentId,
            name: s.name,
            startDate: s.startDate,
            endDate: s.endDate,
            blackoutDates: s.blackoutDates.slice()
          };
        })
      };
    }

    function restore(data) {
      if (!data || typeof data !== 'object') {
        return 0;
      }
      var restored = 0;
      var lists = {
        departments: data.departments,
        roles: data.roles,
        members: data.members,
        seasons: data.seasons
      };
      if (Array.isArray(lists.departments)) {
        lists.departments.forEach(function (d) {
          if (d && typeof d.name === 'string') {
            var result = addDepartment(d.name, d.description);
            if (result.ok) { restored++; }
          }
        });
      }
      if (Array.isArray(lists.roles)) {
        lists.roles.forEach(function (r) {
          if (r && typeof r.name === 'string' && r.id !== 'r1' && r.id !== 'r2' && r.id !== 'r3') {
            var result = addRole(r.name, r.permissions);
            if (result.ok) { restored++; }
          }
        });
      }
      if (Array.isArray(lists.members)) {
        lists.members.forEach(function (m) {
          if (m && typeof m.name === 'string') {
            var result = addMember(m.name, m.departmentId, m.roleId);
            if (result.ok) { restored++; }
          }
        });
      }
      if (Array.isArray(lists.seasons)) {
        lists.seasons.forEach(function (s) {
          if (s && typeof s.name === 'string') {
            var result = addSeason(s);
            if (result.ok) { restored++; }
          }
        });
      }
      return restored;
    }

    return {
      addDepartment: addDepartment,
      listDepartments: listDepartments,
      addRole: addRole,
      listRoles: listRoles,
      addMember: addMember,
      assignRole: assignRole,
      can: can,
      listMembers: listMembers,
      addSeason: addSeason,
      listSeasons: listSeasons,
      isDateActive: isDateActive,
      snapshot: snapshot,
      restore: restore
    };
  }

  return { createRegistry: createRegistry };
});
