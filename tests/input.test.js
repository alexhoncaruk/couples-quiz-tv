/* Tests for src/input.js: key mapping, repeat handling, Up x5, Back via history. */
(function (root) {
  'use strict';
  var inNode = typeof module === 'object' && module.exports;
  var T = inNode ? require('./harness') : root.T;
  var Input = inNode ? require('../src/input') : root.CQ.Input;
  var test = T.test, eq = T.eq;

  function key(k, code, extra) {
    var e = { key: k, keyCode: code || 0, which: code || 0, prevented: false };
    e.preventDefault = function () { e.prevented = true; };
    if (extra) { for (var p in extra) { e[p] = extra[p]; } }
    return e;
  }

  function controller() {
    var c = new Input.Controller();
    var got = [];
    c.setHandler(function (action, info) { got.push(action + (info.type === 'popstate' ? '@pop' : '')); });
    return { c: c, got: got };
  }

  function fakeWindow() {
    var pushes = 0;
    return { history: { pushState: function () { pushes++; } }, pushes: function () { return pushes; } };
  }

  test('input: modern key names map to actions', function () {
    eq(Input.normalize(key('ArrowUp')), 'up');
    eq(Input.normalize(key('ArrowDown')), 'down');
    eq(Input.normalize(key('ArrowLeft')), 'left');
    eq(Input.normalize(key('ArrowRight')), 'right');
    eq(Input.normalize(key('Enter')), 'enter');
    eq(Input.normalize(key('Escape')), 'back');
    eq(Input.normalize(key('BrowserBack')), 'back');
    eq(Input.normalize(key('Backspace')), 'back');
    eq(Input.normalize(key('GoBack')), 'back');
  });

  test('input: old browsers without key names fall back to keyCode', function () {
    eq(Input.normalize({ keyCode: 38 }), 'up');
    eq(Input.normalize({ keyCode: 40 }), 'down');
    eq(Input.normalize({ keyCode: 37 }), 'left');
    eq(Input.normalize({ keyCode: 39 }), 'right');
    eq(Input.normalize({ keyCode: 13 }), 'enter');
    eq(Input.normalize({ which: 13 }), 'enter');
    eq(Input.normalize({ keyCode: 27 }), 'back');
    eq(Input.normalize({ keyCode: 166 }), 'back');
    eq(Input.normalize({ keyCode: 4 }), 'back');
  });

  test('input: old-style key names (IE/early WebKit) work', function () {
    eq(Input.normalize(key('Up')), 'up');
    eq(Input.normalize(key('Esc')), 'back');
  });

  test('input: "Unidentified" key falls back to keyCode', function () {
    eq(Input.normalize(key('Unidentified', 23)), 'enter', 'DPAD_CENTER');
    eq(Input.normalize(key('Unidentified', 166)), 'back');
  });

  test('input: unrelated keys are ignored', function () {
    eq(Input.normalize(key('a', 65)), null);
    eq(Input.normalize(key('4', 52)), null, 'digit 4 is not Android Back (keyCode 4)');
    eq(Input.normalize(key('MediaPlayPause', 179)), null);
    eq(Input.normalize(null), null);
  });

  test('input: "d" toggles debug', function () {
    eq(Input.normalize(key('d', 68)), 'debug');
    eq(Input.normalize(key('D', 68)), 'debug');
  });

  test('input: handled keys call preventDefault, ignored keys do not', function () {
    var x = controller();
    var down = key('ArrowDown', 40);
    var other = key('a', 65);
    x.c.onKeyDown(down, 1000);
    x.c.onKeyDown(other, 1100);
    T.ok(down.prevented, 'arrow prevented (no page scrolling)');
    T.ok(!other.prevented, 'other key untouched');
    eq(x.got, ['down']);
  });

  test('input: held arrows repeat, held OK/Back do not', function () {
    var x = controller();
    x.c.onKeyDown(key('ArrowRight', 39), 0);
    x.c.onKeyDown(key('ArrowRight', 39, { repeat: true }), 50);
    x.c.onKeyDown(key('Enter', 13), 100);
    x.c.onKeyDown(key('Enter', 13, { repeat: true }), 150);
    x.c.onKeyDown(key('Escape', 27, { repeat: true }), 200);
    eq(x.got, ['right', 'right', 'enter']);
  });

  test('input: Up x5 within 2.5 s toggles debug', function () {
    var x = controller();
    for (var i = 0; i < 5; i++) { x.c.onKeyDown(key('ArrowUp', 38), 1000 + i * 300); }
    eq(x.got, ['up', 'up', 'up', 'up', 'up', 'debug']);
  });

  test('input: Up x5 too slowly or interrupted does not toggle debug', function () {
    var x = controller();
    var t = 0;
    for (var i = 0; i < 5; i++) { x.c.onKeyDown(key('ArrowUp', 38), t); t += 900; }
    eq(x.got.indexOf('debug'), -1, 'too slow');
    var y = controller();
    y.c.onKeyDown(key('ArrowUp', 38), 0);
    y.c.onKeyDown(key('ArrowUp', 38), 100);
    y.c.onKeyDown(key('ArrowDown', 40), 200);
    y.c.onKeyDown(key('ArrowUp', 38), 300);
    y.c.onKeyDown(key('ArrowUp', 38), 400);
    y.c.onKeyDown(key('ArrowUp', 38), 500);
    eq(y.got.indexOf('debug'), -1, 'interrupted by Down');
  });

  test('input: raw listeners see every key, even ignored ones, and can unsubscribe', function () {
    var x = controller();
    var seen = [];
    var off = x.c.onRaw(function (info) { seen.push(info.keyCode + ':' + info.action); });
    x.c.onKeyDown(key('a', 65), 0);
    x.c.onKeyDown(key('Enter', 13), 10);
    off();
    x.c.onKeyDown(key('Enter', 13), 20);
    eq(seen, ['65:null', '13:enter']);
  });

  test('input: history trap turns browser Back (popstate) into a back action', function () {
    var x = controller();
    var w = fakeWindow();
    x.c.win = w;
    x.c.setTrap(true);
    x.c.onKeyDown(key('ArrowDown', 40), 0); // first key press arms the trap
    eq(w.pushes(), 1);
    x.c.onPopState({}, 5000);
    eq(x.got, ['down', 'back@pop']);
    eq(w.pushes(), 2, 're-armed right away');
  });

  test('input: one Back press that arrives as key AND popstate counts once', function () {
    var x = controller();
    x.c.win = fakeWindow();
    x.c.setTrap(true);
    x.c.onKeyDown(key('BrowserBack', 166), 1000);
    x.c.onPopState({}, 1100);
    eq(x.got, ['back']);
  });

  test('input: popstate is ignored when the trap is off or not armed', function () {
    var x = controller();
    x.c.win = fakeWindow();
    x.c.onPopState({}, 0);
    x.c.setTrap(true);
    x.c.onPopState({}, 10); // nothing pushed yet (e.g. popstate on page load)
    eq(x.got, []);
  });
})(this);
