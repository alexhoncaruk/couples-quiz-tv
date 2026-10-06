/* "Pass the remote" screen shown before every turn (and between the two halves of a
 * know-me turn), so nobody answers on someone else's turn. */
(function (root) {
  'use strict';
  var CQ = root.CQ;
  var h = CQ.UI.h;
  CQ.Screens = CQ.Screens || {};

  CQ.Screens.interstitial = {
    hints: [['OK', 'Ready'], ['BACK', 'Quit game']],

    mount: function (el, params, ctx) {
      var game = ctx.app.game;
      var t = CQ.Game.turnInfo(game);
      var names = [game.players[0].name, game.players[1].name];
      var who;
      var line;
      var counter = 'Question ' + t.number + ' of ' + t.total;

      if (game.phase === 'secret') {
        who = t.subject;
        line = [names[t.subject] + ' answers about themselves. ', h('b', null, names[t.guesser] + ', look away!')];
      } else if (game.phase === 'guess') {
        who = t.guesser;
        line = names[t.guesser] + ', guess what ' + names[t.subject] + ' picked.';
        counter = 'Answer locked in. Your turn to guess!';
      } else {
        who = t.actor;
        line = t.comeback ? 'Comeback question for ' + names[who] + '!' : 'Your question is coming up.';
      }

      el.appendChild(h('div', { class: 'topbar' }, [
        h('div', { class: 'topbar-left' }, counter),
        CQ.UI.scoreboard(game, who)
      ]));
      var ready = CQ.UI.button('I\'m ready', 'primary');
      el.appendChild(h('div', { class: 'pass' }, [
        h('div', { class: 'pass-label' }, 'Pass the remote to'),
        h('div', { class: 'pass-name ' + CQ.UI.playerClass(who) }, names[who]),
        h('div', { class: 'pass-line' }, line),
        ready
      ]));

      CQ.Sound.play('pass');
      ctx.setGrid([[{ el: ready, onSelect: function () { ctx.go('question'); } }]]);
      return { back: function () { CQ.UI.confirmQuit(ctx); } };
    }
  };
})(this);
