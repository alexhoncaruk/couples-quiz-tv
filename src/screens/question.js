/* Question screen: the question, four answers in a 2x2 grid and the timer bar.
 * In know-me mode this is used twice per turn: first the subject secretly locks in
 * their answer (then the answers disappear behind "Answer locked in"), then the
 * guesser guesses. */
(function (root) {
  'use strict';
  var CQ = root.CQ;
  var h = CQ.UI.h;
  CQ.Screens = CQ.Screens || {};

  var TICK_MS = 250;

  CQ.Screens.question = {
    hints: [['← → ↑ ↓', 'Move'], ['OK', 'Answer'], ['BACK', 'Quit game']],

    mount: function (el, params, ctx) {
      var app = ctx.app;
      var game = app.game;
      var Game = CQ.Game;
      var t = Game.turnInfo(game);
      var q = Game.currentQuestion(game);
      var phase = game.phase;
      var names = [game.players[0].name, game.players[1].name];
      var subjectName = names[t.subject];
      var answered = false;

      // Header: counter + scores.
      var label = 'Question ' + t.number + ' / ' + t.total + (t.comeback ? '  ·  Comeback question' : '');
      el.appendChild(h('div', { class: 'topbar' }, [
        h('div', { class: 'topbar-left' }, label),
        CQ.UI.scoreboard(game, phase === 'secret' ? t.subject : t.actor)
      ]));

      // Timer (never while the subject picks their secret answer).
      var useTimer = game.timerSeconds > 0 && phase !== 'secret';
      var fill = null;
      if (useTimer) {
        fill = h('div', { class: 'timer-fill' });
        el.appendChild(h('div', { class: 'timer' }, fill));
      }

      // Who answers.
      var prompt;
      if (phase === 'secret') {
        prompt = [h('span', { class: CQ.UI.playerClass(t.subject) }, subjectName), ', answer about yourself. ',
          h('span', { class: CQ.UI.playerClass(t.guesser) }, names[t.guesser]), ', no peeking!'];
      } else if (phase === 'guess') {
        prompt = [h('span', { class: CQ.UI.playerClass(t.guesser) }, names[t.guesser]), ', what did ' + subjectName + ' pick?'];
      } else {
        prompt = [h('span', { class: CQ.UI.playerClass(t.actor) }, names[t.actor]), ', your question:'];
      }
      el.appendChild(h('div', { class: 'prompt' }, prompt));

      var text = game.mode === 'knowme' ? CQ.UI.fillName(q.question, subjectName) : q.question;
      el.appendChild(h('div', { class: 'question' }, text));

      var body = h('div', { class: 'options' });
      el.appendChild(body);
      var items = q.options.map(function (opt, i) {
        var o = h('div', { class: 'option focusable' }, [
          h('span', { class: 'letter' }, CQ.UI.LETTERS[i]),
          h('span', { class: 'option-text' }, opt)
        ]);
        body.appendChild(o);
        return { el: o, onSelect: function () { choose(i); } };
      });
      ctx.setGrid([[items[0], items[1]], [items[2], items[3]]]);

      // Timing.
      var watch = new Game.Stopwatch();
      var interval = null;
      var paused = false;

      function tick() {
        if (paused || answered) { return; }
        var left = game.timerSeconds * 1000 - watch.elapsed();
        var frac = Math.max(0, left / (game.timerSeconds * 1000));
        var tr = 'scaleX(' + frac.toFixed(3) + ')';
        fill.style.webkitTransform = tr;
        fill.style.transform = tr;
        if (left < 5000 && fill.className.indexOf('low') < 0) { fill.className += ' low'; }
        if (left <= 0) { choose(-1); }
      }

      function stopTimer() {
        if (interval) { root.clearInterval(interval); interval = null; }
      }

      if (useTimer) {
        interval = root.setInterval(tick, TICK_MS);
        tick();
      }

      function choose(i) {
        if (answered) { return; }
        answered = true;
        stopTimer();
        var elapsed = watch.elapsed();
        if (phase === 'secret') {
          Game.lockSecret(game, i);
          showLocked();
          return;
        }
        var result = phase === 'guess' ? Game.guess(game, i, elapsed) : Game.answer(game, i, elapsed);
        if (result.correct || result.match) { CQ.Sound.correct(); } else { CQ.Sound.wrong(); }
        ctx.go('reveal');
      }

      // Hide the secret answer straight away and hand over to the guesser.
      function showLocked() {
        CQ.UI.clear(body);
        var pass = CQ.UI.button('Pass the remote to ' + names[t.guesser], 'primary');
        body.appendChild(h('div', { class: 'locked' }, [
          h('div', { class: 'lock-icon' }),
          h('div', { class: 'h1' }, 'Answer locked in'),
          h('div', { class: 'sub' }, names[t.guesser] + ' can look now.'),
          h('div', { class: 'btn-row' }, pass)
        ]));
        ctx.setHints([['OK', 'Continue'], ['BACK', 'Quit game']]);
        ctx.setGrid([[{ el: pass, onSelect: function () { ctx.go('interstitial'); } }]]);
      }

      return {
        back: function () { CQ.UI.confirmQuit(ctx); },
        pause: function () { paused = true; watch.pause(); },
        resume: function () { paused = false; watch.resume(); },
        unmount: stopTimer
      };
    }
  };
})(this);
