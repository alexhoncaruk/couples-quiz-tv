/* Player setup: two player cards (OK to rename), Swap, Continue. */
(function (root) {
  'use strict';
  var CQ = root.CQ;
  var h = CQ.UI.h;
  CQ.Screens = CQ.Screens || {};

  CQ.Screens.setup = {
    hints: [['← → ↑ ↓', 'Move'], ['OK', 'Select'], ['BACK', 'Title']],

    mount: function (el, params, ctx) {
      var app = ctx.app;
      el.appendChild(h('div', { class: 'h1 center' }, 'Who is playing?'));
      el.appendChild(h('div', { class: 'sub center' }, 'Player 1 goes first. Press OK on a name to change it.'));

      var wrap = h('div', { class: 'players' });
      el.appendChild(wrap);
      var cards = [0, 1].map(function (slot) {
        var card = h('div', { class: 'player-card focusable' }, [
          h('div', { class: 'player-label' }, 'Player ' + (slot + 1)),
          h('div', { class: 'player-name ' + CQ.UI.playerClass(slot) }, app.players[slot]),
          h('div', { class: 'small' }, 'OK to change')
        ]);
        wrap.appendChild(card);
        return { el: card, onSelect: function () { ctx.go('names', { slot: slot }); } };
      });

      var back = CQ.UI.button('\u2039 Back');
      var swap = CQ.UI.button('Swap order');
      var go = CQ.UI.button('Continue', 'primary');
      el.appendChild(h('div', { class: 'btn-row' }, [back, swap, go]));
      var backItem = { el: back, sound: 'back', onSelect: function () { ctx.go('title'); } };

      var swapItem = {
        el: swap,
        onSelect: function () {
          app.players = [app.players[1], app.players[0]];
          app.savePlayers();
          ctx.go('setup', { focus: 'swap' });
        }
      };
      var goItem = {
        el: go,
        onSelect: function () {
          var a = app.players[0].replace(/^\s+|\s+$/g, '');
          var b = app.players[1].replace(/^\s+|\s+$/g, '');
          if (!a || !b) { CQ.Sound.play('error'); ctx.toast('Both players need a name'); return; }
          if (a.toLowerCase() === b.toLowerCase()) { CQ.Sound.play('error'); ctx.toast('Pick two different names'); return; }
          ctx.go('category');
        }
      };

      var focus = goItem;
      if (params.focus === 'swap') { focus = swapItem; }
      if (params.focusSlot === 0 || params.focusSlot === 1) { focus = cards[params.focusSlot]; }
      ctx.setGrid([cards, [backItem, swapItem, goItem]], { focus: focus });

      return { back: function () { ctx.go('title'); } };
    }
  };
})(this);
