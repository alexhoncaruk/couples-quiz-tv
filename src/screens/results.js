/* End screen: winner, final scores, stats, and what to do next. */
(function (root) {
  'use strict';
  var CQ = root.CQ;
  var h = CQ.UI.h;
  CQ.Screens = CQ.Screens || {};

  /* Add this game to the all-time record of this pair of names (once per game). */
  function saveRecord(game, s) {
    if (game.recorded) { return; }
    game.recorded = true;
    var records = CQ.Storage.get('records', {});
    var key = CQ.Screens.title.pairKey([s.players[0].name, s.players[1].name]);
    var rec = records[key] || { games: 0, ties: 0, wins: {} };
    rec.games++;
    if (s.winner < 0) {
      rec.ties++;
    } else {
      var name = s.players[s.winner].name;
      rec.wins[name] = (rec.wins[name] || 0) + 1;
    }
    records[key] = rec;
    CQ.Storage.set('records', records);
  }

  function stat(label, value) {
    return h('div', { class: 'stat' }, [label, h('span', { class: 'stat-val' }, value)]);
  }

  CQ.Screens.results = {
    hints: [['← →', 'Move'], ['OK', 'Select'], ['BACK', 'Title']],

    mount: function (el, params, ctx) {
      var app = ctx.app;
      var game = app.game;
      var s = CQ.Game.summary(game);
      var knowme = s.mode === 'knowme';
      saveRecord(game, s);
      if (s.winner >= 0) { CQ.Sound.correct(); }

      var headline = s.winner < 0
        ? h('span', null, 'It\'s a tie!')
        : h('span', null, [h('span', { class: CQ.UI.playerClass(s.winner) }, s.players[s.winner].name), ' wins!']);
      el.appendChild(h('div', { class: 'headline' }, headline));
      el.appendChild(h('div', { class: 'sub center' }, game.categoryName + ' · ' + game.total + ' questions'));

      var row = h('div', { class: 'final' });
      el.appendChild(row);
      s.players.forEach(function (p, i) {
        row.appendChild(h('div', { class: 'final-card' + (i === s.winner ? ' winner' : '') }, [
          h('div', { class: 'final-name ' + CQ.UI.playerClass(i) }, p.name),
          h('div', { class: 'final-score' }, String(p.score)),
          h('div', { class: 'small center' }, knowme ? (p.score === 1 ? 'match' : 'matches') : 'points'),
          stat(knowme ? 'Guessed right' : 'Accuracy', p.correct + ' / ' + p.answered + '  (' + p.accuracy + '%)'),
          stat(knowme ? 'Fastest right guess' : 'Fastest right answer', CQ.UI.seconds(p.fastestMs)),
          stat('Best streak', String(p.bestStreak))
        ]));
      });

      var again = CQ.UI.button('Play again', 'primary');
      var change = CQ.UI.button('Change category');
      var home = CQ.UI.button('Home');
      el.appendChild(h('div', { class: 'btn-row' }, [again, change, home]));

      var busy = false;
      ctx.setGrid([[
        {
          el: again,
          onSelect: function () {
            if (busy) { return; }
            busy = true;
            app.startGame(game.categoryId).then(function () { ctx.go('interstitial'); }, function (err) {
              busy = false;
              ctx.toast(err.message, 4000);
            });
          }
        },
        { el: change, onSelect: function () { ctx.go('category'); } },
        { el: home, onSelect: function () { ctx.go('title'); } }
      ]]);

      return { back: function () { ctx.go('title'); } };
    }
  };
})(this);
