/* Tests for src/nav.js: D-pad movement over grids. */
(function (root) {
  'use strict';
  var inNode = typeof module === 'object' && module.exports;
  var T = inNode ? require('./harness') : root.T;
  var Nav = inNode ? require('../src/nav') : root.CQ.Nav;
  var test = T.test, eq = T.eq;

  function item(props) { return props || {}; }
  function row(n) { var r = []; for (var i = 0; i < n; i++) { r.push(item()); } return r; }
  function rc(pos) { return pos ? [pos.row, pos.col] : null; }

  // A vertical menu like the title screen.
  var menu = [[item()], [item()], [item()]];

  test('nav: down moves through a vertical menu', function () {
    var p = Nav.first(menu);
    eq(rc(p), [0, 0]);
    p = Nav.move(menu, p, 'down');
    eq(rc(p), [1, 0]);
    p = Nav.move(menu, p, 'down');
    eq(rc(p), [2, 0]);
  });

  test('nav: edges stop movement without wrap', function () {
    eq(rc(Nav.move(menu, { row: 2, col: 0 }, 'down')), [2, 0]);
    eq(rc(Nav.move(menu, { row: 0, col: 0 }, 'up')), [0, 0]);
    eq(rc(Nav.move(menu, { row: 0, col: 0 }, 'left')), [0, 0]);
  });

  test('nav: wrapY wraps around a menu', function () {
    eq(rc(Nav.move(menu, { row: 2, col: 0 }, 'down', { wrapY: true })), [0, 0]);
    eq(rc(Nav.move(menu, { row: 0, col: 0 }, 'up', { wrapY: true })), [2, 0]);
  });

  // The 2x2 answer grid.
  var answers = [row(2), row(2)];

  test('nav: 2x2 answer grid moves in all four directions', function () {
    var p = { row: 0, col: 0 };
    p = Nav.move(answers, p, 'right'); eq(rc(p), [0, 1]);
    p = Nav.move(answers, p, 'down'); eq(rc(p), [1, 1]);
    p = Nav.move(answers, p, 'left'); eq(rc(p), [1, 0]);
    p = Nav.move(answers, p, 'up'); eq(rc(p), [0, 0]);
  });

  test('nav: wrapX wraps inside a row', function () {
    eq(rc(Nav.move(answers, { row: 0, col: 1 }, 'right', { wrapX: true })), [0, 0]);
    eq(rc(Nav.move(answers, { row: 0, col: 0 }, 'left', { wrapX: true })), [0, 1]);
  });

  test('nav: disabled items are skipped horizontally and vertically', function () {
    var g = [[item(), item({ disabled: true }), item()], [item({ disabled: true })], [item()]];
    eq(rc(Nav.move(g, { row: 0, col: 0 }, 'right')), [0, 2]);
    eq(rc(Nav.move(g, { row: 0, col: 0 }, 'down')), [2, 0], 'skips a row with nothing usable');
  });

  test('nav: first() and find() skip disabled items', function () {
    var g = [[item({ disabled: true }), item({ id: 'b' })], [item({ id: 'c' })]];
    eq(rc(Nav.first(g)), [0, 1]);
    eq(rc(Nav.find(g, function (it) { return it.id === 'c'; })), [1, 0]);
    eq(Nav.find(g, function (it) { return it.id === 'zzz'; }), null);
  });

  test('nav: empty grid gives no position', function () {
    eq(Nav.first([]), null);
    eq(Nav.first([[], [item({ disabled: true })]]), null);
  });

  test('nav: an invalid position snaps to the first item', function () {
    eq(rc(Nav.move(answers, { row: 9, col: 9 }, 'down')), [0, 0]);
    eq(rc(Nav.move(answers, null, 'left')), [0, 0]);
  });

  test('nav: rows of different length pick the nearest column', function () {
    // Setup screen: two player cards, then Swap + Continue below.
    var g = [row(3), row(1)];
    eq(rc(Nav.move(g, { row: 0, col: 2 }, 'down')), [1, 0]);
    eq(rc(Nav.move(g, { row: 1, col: 0 }, 'up')), [0, 0], 'single item at x 0..1 maps to column 0');
  });

  // On-screen keyboard: 10 letters, then Shift(2) Space(3) Delete(3) Done(2).
  var kb = [
    row(10),
    [item({ x: 0, w: 2 }), item({ x: 2, w: 3 }), item({ x: 5, w: 3 }), item({ x: 8, w: 2 })]
  ];

  test('nav: keyboard letter goes down onto the wide key that covers it', function () {
    eq(rc(Nav.move(kb, { row: 0, col: 3 }, 'down')), [1, 1], 'D is under Space');
    eq(rc(Nav.move(kb, { row: 0, col: 9 }, 'down')), [1, 3], 'J is under Done');
    eq(rc(Nav.move(kb, { row: 0, col: 0 }, 'down')), [1, 0], 'A is under Shift');
  });

  test('nav: going down and back up returns to the same letter (sticky column)', function () {
    var p = Nav.first(kb);
    p = Nav.move(kb, p, 'right');
    p = Nav.move(kb, p, 'right');
    p = Nav.move(kb, p, 'right');
    p = Nav.move(kb, p, 'right'); // E (col 4)
    p = Nav.move(kb, p, 'down'); // Space
    eq(rc(p), [1, 1]);
    p = Nav.move(kb, p, 'up');
    eq(rc(p), [0, 4], 'back to E, not to the centre of Space');
  });

  test('nav: moving sideways resets the remembered column', function () {
    var p = Nav.move(kb, { row: 0, col: 4 }, 'down'); // Space, prefX 4.5
    p = Nav.move(kb, p, 'right'); // Delete, x 5..8
    p = Nav.move(kb, p, 'up');
    eq(rc(p), [0, 6], 'centre of Delete is 6.5, so G');
  });

  test('nav: unknown directions keep the position', function () {
    eq(rc(Nav.move(answers, { row: 1, col: 1 }, 'enter')), [1, 1]);
  });

  test('nav: same() compares positions', function () {
    T.ok(Nav.same({ row: 1, col: 2 }, { row: 1, col: 2, prefX: 9 }));
    T.ok(!Nav.same({ row: 1, col: 2 }, { row: 2, col: 2 }));
  });
})(this);
