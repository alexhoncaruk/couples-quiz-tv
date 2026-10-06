/* Category select, with the number of questions on top. Built from data/manifest.json,
 * so a new category shows up here as soon as it is in the manifest. */
(function (root) {
  'use strict';
  var CQ = root.CQ;
  var h = CQ.UI.h;
  CQ.Screens = CQ.Screens || {};

  var ROUND_OPTIONS = [5, 10, 15, 20];
  var PER_ROW = 4;
  var ROW_H = 238; // must match .cat-row height in main.css
  var VIEW_H = 612; // visible height of the scrolling card area

  CQ.Screens.category = {
    hints: [['← → ↑ ↓', 'Move'], ['OK', 'Play'], ['BACK', 'Players']],

    mount: function (el, params, ctx) {
      var app = ctx.app;
      var loading = false;

      el.appendChild(h('div', { class: 'h1 center' }, 'Pick a category'));
      el.appendChild(h('div', { class: 'sub center' }, [
        h('span', { class: 'p1' }, app.players[0]), '  vs  ', h('span', { class: 'p2' }, app.players[1])
      ]));

      // Number of questions.
      var roundsRow = h('div', { class: 'rounds-row' }, h('span', { class: 'rounds-label' }, 'Questions:'));
      el.appendChild(roundsRow);
      var w = PER_ROW / (ROUND_OPTIONS.length + 1);
      var backPill = h('div', { class: 'pill back-pill focusable' }, '\u2039 Back');
      roundsRow.insertBefore(backPill, roundsRow.firstChild);
      var pills = ROUND_OPTIONS.map(function (n, i) {
        var pill = h('div', { class: 'pill focusable' }, String(n));
        roundsRow.appendChild(pill);
        return {
          el: pill,
          x: (i + 1) * w,
          w: w,
          value: n,
          sound: 'toggle',
          onSelect: function () { app.rounds = n; paintPills(); }
        };
      });
      function paintPills() {
        pills.forEach(function (p) {
          if (!p.value) { return; }
          p.el.className = p.el.className.replace(/(^|\s)selected(?=\s|$)/g, '') + (p.value === app.rounds ? ' selected' : '');
        });
      }
      paintPills();

      // Category cards, PER_ROW per row, in a window that scrolls to follow the focus.
      var cats = h('div', { class: 'cats' });
      var catsView = h('div', { class: 'cats-view', style: 'height:' + VIEW_H + 'px' }, cats);
      el.appendChild(catsView);
      var scrollY = 0;
      function scrollToRow(r) {
        var top = r * ROW_H;
        if (top < scrollY) { scrollY = top; }
        if (top + ROW_H > scrollY + VIEW_H) { scrollY = top + ROW_H - VIEW_H; }
        var t = 'translateY(' + (-scrollY) + 'px)';
        cats.style.webkitTransform = t;
        cats.style.transform = t;
      }
      var rows = [[{ el: backPill, x: 0, w: w, sound: 'back', onSelect: function () { ctx.go('setup'); } }].concat(pills)];
      var focus = null;
      var rowEl = null;
      app.manifest.categories.forEach(function (cat, i) {
        if (i % PER_ROW === 0) {
          rowEl = h('div', { class: 'cat-row' });
          cats.appendChild(rowEl);
          rows.push([]);
        }
        var badge = cat.mix ? 'Mix' : '';
        badge += (badge ? ' · ' : '') + (cat.mode === 'knowme' ? 'About each other' : 'Trivia');
        var card = h('div', { class: 'cat-card focusable' + (cat.mode === 'knowme' ? ' knowme' : '') }, [
          h('div', { class: 'cat-name' }, cat.name),
          h('div', { class: 'cat-desc' }, cat.description || ''),
          h('div', { class: 'badge' }, badge)
        ]);
        rowEl.appendChild(card);
        var cardRow = rows.length - 2; // 0-based row inside the scrolling area
        var item = {
          el: card,
          sound: 'start',
          onFocus: function () { scrollToRow(cardRow); },
          onSelect: function () { start(cat); }
        };
        rows[rows.length - 1].push(item);
        if (cat.id === app.categoryId || (!focus && i === 0)) { focus = item; }
      });

      function start(cat) {
        if (loading) { return; }
        loading = true;
        var slow = root.setTimeout(function () { ctx.toast('Loading ' + cat.name + '…', 10000); }, 400);
        app.startGame(cat.id).then(function (game) {
          root.clearTimeout(slow);
          ctx.go('interstitial');
          if (game.total < app.rounds) {
            ctx.toast('Only ' + game.total + ' questions in ' + cat.name + ', so this game has ' + game.total, 3500);
          }
        }, function (err) {
          root.clearTimeout(slow);
          loading = false;
          ctx.toast('Could not load questions: ' + err.message, 5000);
        });
      }

      ctx.setGrid(rows, { focus: focus });
      if (!focus || rows[0].indexOf(focus) >= 0) { scrollToRow(0); }
      return { back: function () { ctx.go('setup'); } };
    }
  };
})(this);
