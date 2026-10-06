/* Tests for the screen state machine's allowed transitions (src/router.js). */
(function (root) {
  'use strict';
  var inNode = typeof module === 'object' && module.exports;
  var T = inNode ? require('./harness') : root.T;
  var R = inNode ? require('../src/router') : { canGo: root.CQ.Router.canGo, TRANSITIONS: root.CQ.Router.TRANSITIONS };
  var test = T.test, ok = T.ok;

  test('router: the normal game flow is allowed', function () {
    var flow = ['title', 'setup', 'category', 'interstitial', 'question', 'reveal', 'interstitial',
      'question', 'reveal', 'results', 'title'];
    for (var i = 1; i < flow.length; i++) {
      ok(R.canGo(flow[i - 1], flow[i]), flow[i - 1] + ' -> ' + flow[i]);
    }
  });

  test('router: know-me lock-in goes from question back to the pass-the-remote screen', function () {
    ok(R.canGo('question', 'interstitial'));
  });

  test('router: every in-game screen can quit to the title', function () {
    ['interstitial', 'question', 'reveal', 'results'].forEach(function (s) { ok(R.canGo(s, 'title'), s); });
  });

  test('router: nonsense jumps are blocked', function () {
    ok(!R.canGo('title', 'reveal'));
    ok(!R.canGo('title', 'question'));
    ok(!R.canGo('setup', 'results'));
    ok(!R.canGo('title', 'nowhere'));
  });

  test('router: first screen and re-rendering the same screen are allowed', function () {
    ok(R.canGo(null, 'title'));
    ok(R.canGo('settings', 'settings'));
  });

  test('router: every transition target is a known screen', function () {
    for (var from in R.TRANSITIONS) {
      R.TRANSITIONS[from].forEach(function (to) { ok(R.TRANSITIONS.hasOwnProperty(to), from + ' -> ' + to); });
    }
  });
})(this);
