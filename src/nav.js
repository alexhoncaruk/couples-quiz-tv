/* Couples Quiz TV - grid navigation (pure logic, no DOM, unit tested).
 *
 * Screens describe their focusable things as a grid: an array of rows, each row an
 * array of items. An item may say where it sits horizontally:
 *   { x: start column (default: its index in the row), w: width in columns (default 1),
 *     disabled: true to skip it }
 * A position is { row, col, prefX }: col is the index inside the row and prefX remembers
 * the horizontal spot while moving up/down, so going down onto a wide key (like Space)
 * and back up lands on the same column you started from.
 *
 * Works as a browser global (CQ.Nav) and as a Node module (for tests). */
(function (root) {
  'use strict';

  function usable(item) {
    return !!item && !item.disabled;
  }

  function startX(row, i) {
    var it = row[i];
    return it && typeof it.x === 'number' ? it.x : i;
  }

  function width(row, i) {
    var it = row[i];
    return it && typeof it.w === 'number' ? it.w : 1;
  }

  function center(row, i) {
    return startX(row, i) + width(row, i) / 2;
  }

  function isValid(grid, pos) {
    return !!pos && !!grid && !!grid[pos.row] && usable(grid[pos.row][pos.col]);
  }

  function at(grid, r, c, prefX) {
    return { row: r, col: c, prefX: typeof prefX === 'number' ? prefX : center(grid[r], c) };
  }

  /* First usable position, scanning rows top to bottom. */
  function first(grid) {
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[r].length; c++) {
        if (usable(grid[r][c])) { return at(grid, r, c); }
      }
    }
    return null;
  }

  /* Position of the first usable item for which test(item, row, col) is true. */
  function find(grid, test) {
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[r].length; c++) {
        if (usable(grid[r][c]) && test(grid[r][c], r, c)) { return at(grid, r, c); }
      }
    }
    return null;
  }

  /* Index of the usable item in `row` that covers targetX, else the nearest one; -1 if none. */
  function nearestInRow(row, targetX) {
    var best = -1;
    var bestDist = Infinity;
    for (var i = 0; i < row.length; i++) {
      if (!usable(row[i])) { continue; }
      var x = startX(row, i);
      if (targetX >= x && targetX < x + width(row, i)) { return i; }
      var d = Math.abs(center(row, i) - targetX);
      if (d < bestDist) { best = i; bestDist = d; }
    }
    return best;
  }

  /* Move from pos in direction dir ('up' | 'down' | 'left' | 'right').
   * opts.wrapX / opts.wrapY let movement wrap around the edges (off by default).
   * Always returns a position; if nothing is reachable it returns pos unchanged. */
  function move(grid, pos, dir, opts) {
    opts = opts || {};
    if (!isValid(grid, pos)) { return first(grid); }
    var row = grid[pos.row];
    var prefX = typeof pos.prefX === 'number' ? pos.prefX : center(row, pos.col);
    var stay = at(grid, pos.row, pos.col, prefX);
    var step, n, k;

    if (dir === 'left' || dir === 'right') {
      step = dir === 'left' ? -1 : 1;
      n = row.length;
      var c = pos.col;
      for (k = 0; k < n; k++) {
        c += step;
        if (c < 0 || c >= n) {
          if (!opts.wrapX) { return stay; }
          c = (c + n) % n;
        }
        if (c === pos.col) { return stay; }
        if (usable(row[c])) { return at(grid, pos.row, c); }
      }
      return stay;
    }

    if (dir === 'up' || dir === 'down') {
      step = dir === 'up' ? -1 : 1;
      n = grid.length;
      var r = pos.row;
      for (k = 0; k < n; k++) {
        r += step;
        if (r < 0 || r >= n) {
          if (!opts.wrapY) { return stay; }
          r = (r + n) % n;
        }
        if (r === pos.row) { return stay; }
        var col = nearestInRow(grid[r], prefX);
        if (col >= 0) { return at(grid, r, col, prefX); }
      }
      return stay;
    }

    return stay;
  }

  function same(a, b) {
    return !!a && !!b && a.row === b.row && a.col === b.col;
  }

  var Nav = {
    move: move,
    first: first,
    find: find,
    isValid: isValid,
    nearestInRow: nearestInRow,
    center: center,
    same: same
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = Nav;
  } else {
    root.CQ = root.CQ || {};
    root.CQ.Nav = Nav;
  }
})(this);
