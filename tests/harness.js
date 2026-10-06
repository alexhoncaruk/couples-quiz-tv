/* A tiny test harness that runs in Node (node tests/run.js) and in any browser,
 * including the TV itself (open /tests/ there). No dependencies. */
(function (root) {
  'use strict';

  var tests = [];

  function test(name, fn) {
    tests.push({ name: name, fn: fn });
  }

  function show(v) {
    return JSON.stringify(v);
  }

  function eq(actual, expected, msg) {
    if (show(actual) !== show(expected)) {
      throw new Error((msg ? msg + ': ' : '') + 'expected ' + show(expected) + ', got ' + show(actual));
    }
  }

  function ok(value, msg) {
    if (!value) { throw new Error(msg || 'expected a truthy value'); }
  }

  function throws(fn, msg) {
    try { fn(); } catch (e) { return; }
    throw new Error(msg || 'expected an error');
  }

  /* report(passed, name, error) is called once per test. */
  function run(report) {
    var passed = 0;
    var failed = 0;
    for (var i = 0; i < tests.length; i++) {
      try {
        tests[i].fn();
        passed++;
        report(true, tests[i].name);
      } catch (e) {
        failed++;
        report(false, tests[i].name, e);
      }
    }
    return { passed: passed, failed: failed };
  }

  var T = { test: test, eq: eq, ok: ok, throws: throws, run: run, tests: tests };

  if (typeof module === 'object' && module.exports) {
    module.exports = T;
  } else {
    root.T = T;
  }
})(this);
