/* Reveal: right answer (or both know-me answers), points and the running scores. */
(function (root) {
  'use strict';
  var CQ = root.CQ;
  var h = CQ.UI.h;
  CQ.Screens = CQ.Screens || {};

  CQ.Screens.reveal = {
    hints: [['OK', 'Next'], ['BACK', 'Quit game']],

    mount: function (el, params, ctx) {
      var game = ctx.app.game;
      var Game = CQ.Game;
      var r = game.last;
      var q = Game.currentQuestion(game);
      var names = [game.players[0].name, game.players[1].name];
      var headline;
      var good;
      var points;
      var marks = {}; // option index -> { cls, tag }

      if (r.type === 'knowme') {
        good = r.match;
        headline = r.match ? 'It\'s a match!' : (r.timedOut ? 'Time\'s up!' : 'Not quite!');
        points = r.match ? names[r.guesser] + ' gets 1 point' : names[r.guesser] + ' gets no point this time';
        marks[r.secret] = { cls: 'correct', tag: names[r.subject] + '\'s answer' };
        if (r.choice >= 0) {
          if (r.choice === r.secret) {
            marks[r.secret].tag += ' = ' + names[r.guesser] + '\'s guess';
          } else {
            marks[r.choice] = { cls: 'wrong', tag: names[r.guesser] + '\'s guess' };
          }
        }
      } else {
        good = r.correct;
        headline = r.correct ? 'Correct!' : (r.timedOut ? 'Time\'s up!' : 'Not quite!');
        points = r.correct
          ? names[r.actor] + ' +' + r.points.total + ' points  (' + r.points.base + ' + ' + r.points.bonus + ' speed bonus)'
          : names[r.actor] + ' gets 0 points';
        marks[r.correctIndex] = { cls: 'correct', tag: 'Right answer' };
        if (r.choice >= 0 && r.choice !== r.correctIndex) { marks[r.choice] = { cls: 'wrong', tag: names[r.actor] + '\'s answer' }; }
      }

      el.appendChild(h('div', { class: 'topbar' }, [
        h('div', { class: 'topbar-left' }, 'Question ' + (game.index + 1) + ' / ' + game.total),
        CQ.UI.scoreboard(game, r.actor)
      ]));
      el.appendChild(h('div', { class: 'headline ' + (good ? 'good' : 'bad') }, headline));
      el.appendChild(h('div', { class: 'points' }, points));
      var text = game.mode === 'knowme' ? CQ.UI.fillName(q.question, names[r.subject]) : q.question;
      el.appendChild(h('div', { class: 'mini-question' }, text));

      var opts = h('div', { class: 'options compact' });
      el.appendChild(opts);
      q.options.forEach(function (opt, i) {
        var m = marks[i];
        opts.appendChild(h('div', { class: 'option focusable ' + (m ? m.cls : 'dim') }, [
          h('span', { class: 'letter' }, CQ.UI.LETTERS[i]),
          h('span', { class: 'option-text' }, [opt, m ? h('span', { class: 'tag' }, m.tag) : null])
        ]));
      });

      var last = Game.isLastTurn(game);
      var nextIsGuess = !last && game.mode === 'knowme' && Game.turnInfo(game).blockPos < Game.turnInfo(game).blockSize;
      var next = CQ.UI.button(last ? 'See results' : (nextIsGuess ? 'Next guess' : 'Next'), 'primary');
      var quit = CQ.UI.button('Quit game');
      el.appendChild(h('div', { class: 'btn-row' }, [quit, next]));
      var quitItem = { el: quit, onSelect: function () { CQ.UI.confirmQuit(ctx); } };
      var nextItem = {
        el: next,
        onSelect: function () {
          if (!Game.next(game)) { ctx.go('results'); return; }
          // The next guess of the same block keeps the remote with the same person.
          ctx.go(game.phase === 'guess' ? 'question' : 'interstitial');
        }
      };
      ctx.setGrid([[quitItem, nextItem]], { focus: nextItem });

      return { back: function () { CQ.UI.confirmQuit(ctx); } };
    }
  };
})(this);
