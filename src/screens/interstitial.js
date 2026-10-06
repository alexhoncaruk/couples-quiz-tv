/* "Pass the remote" screen shown whenever the remote changes hands: before every trivia
 * question, and before each know-me block of secret answers and of guesses. */
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
        line = [names[t.subject] + ' answers ' + t.blockSize + (t.blockSize === 1 ? ' question' : ' questions') +
          ' about themselves. ', h('b', null, names[t.guesser] + ', look away!')];
        counter = 'Questions ' + t.number + '-' + (t.number + t.blockSize - 1) + ' of ' + t.total;
      } else if (game.phase === 'guess') {
        who = t.guesser;
        line = names[t.guesser] + ', guess ' + names[t.subject] + '\'s ' + t.blockSize + (t.blockSize === 1 ? ' answer.' : ' answers, one by one.');
        counter = 'Answers locked in. Your turn to guess!';
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

      var toggles = CQ.UI.soundToggles(ctx.app);
      var quit = CQ.UI.button('Quit game', 'toggle');
      toggles.el.appendChild(quit);
      el.appendChild(toggles.el);

      CQ.Sound.play('pass');
      ctx.setGrid([
        [{ el: ready, x: 0.5, w: 2, onSelect: function () { ctx.go('question'); } }],
        toggles.items.concat([{ el: quit, onSelect: function () { CQ.UI.confirmQuit(ctx); } }])
      ]);
      return { back: function () { CQ.UI.confirmQuit(ctx); } };
    }
  };
})(this);
