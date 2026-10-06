/* Title screen: Start, Settings, How to play. */
(function (root) {
  'use strict';
  var CQ = root.CQ;
  var h = CQ.UI.h;
  CQ.Screens = CQ.Screens || {};

  /* All-time record for this pair of names, e.g. "All-time: Ana 3 · Ben 5 · 1 tie". */
  function recordLine(players) {
    var rec = CQ.Storage.get('records', {})[CQ.Screens.title.pairKey(players)];
    if (!rec || !rec.games) { return null; }
    var ties = rec.ties ? ' · ' + rec.ties + (rec.ties === 1 ? ' tie' : ' ties') : '';
    return 'All-time: ' + players[0] + ' ' + (rec.wins[players[0]] || 0) + ' · ' +
      players[1] + ' ' + (rec.wins[players[1]] || 0) + ties;
  }

  CQ.Screens.title = {
    hints: [['↑ ↓', 'Move'], ['OK', 'Select'], ['↑ x5', 'Key debug']],

    pairKey: function (players) {
      return players.slice().sort().join(' & ').toLowerCase();
    },

    mount: function (el, params, ctx) {
      var app = ctx.app;
      el.appendChild(h('div', { class: 'title-wrap' }, [
        h('div', { class: 'logo' }, [
          h('span', { class: 'p1' }, 'Couples'),
          h('span', { class: 'logo-heart' }, '♥'),
          h('span', { class: 'p2' }, 'Quiz')
        ]),
        h('div', { class: 'tagline' }, 'Who knows more? Who knows who?')
      ]));

      var menu = h('div', { class: 'menu' });
      el.appendChild(menu);
      var entries = [
        ['Start', 'primary', function () { ctx.go('setup'); }],
        ['Settings', '', function () { ctx.go('settings'); }],
        ['How to play', '', function () { ctx.go('howto'); }]
      ];
      var rows = entries.map(function (e) {
        var b = CQ.UI.button(e[0], e[1]);
        menu.appendChild(b);
        return [{ el: b, onSelect: e[2] }];
      });

      var toggles = CQ.UI.soundToggles(app);
      el.appendChild(toggles.el);
      rows.push(toggles.items);

      var rec = recordLine(app.players);
      if (rec) { el.appendChild(h('div', { class: 'record small' }, rec)); }

      ctx.setGrid(rows, { focus: params.focus === 'settings' ? rows[1][0] : null });
      return {
        back: function () { ctx.toast('Press HOME on the remote to leave the game'); }
      };
    }
  };
})(this);
