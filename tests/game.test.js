/* Tests for src/game.js: turns, scoring, know-me flow, stats. */
(function (root) {
  'use strict';
  var inNode = typeof module === 'object' && module.exports;
  var T = inNode ? require('./harness') : root.T;
  var Game = inNode ? require('../src/game') : root.CQ.Game;
  var test = T.test, eq = T.eq, ok = T.ok;

  function trivia(n) {
    var qs = [];
    for (var i = 0; i < n; i++) { qs.push({ id: 't' + i, question: 'Q' + i, options: ['a', 'b', 'c', 'd'], correctIndex: i % 4 }); }
    return qs;
  }

  function knowme(n) {
    var qs = [];
    for (var i = 0; i < n; i++) { qs.push({ id: 'k' + i, question: '{name} likes?', options: ['a', 'b', 'c', 'd'] }); }
    return qs;
  }

  test('game: speed bonus is 50 at 0 s, 25 halfway, 0 at the end', function () {
    eq(Game.speedBonus(0, 20), 50);
    eq(Game.speedBonus(10000, 20), 25);
    eq(Game.speedBonus(20000, 20), 0);
    eq(Game.speedBonus(30000, 20), 0, 'never negative');
  });

  test('game: right answers score 100 + speed, wrong answers 0', function () {
    eq(Game.scoreTrivia(true, 5000, 20), { base: 100, bonus: 38, total: 138 });
    eq(Game.scoreTrivia(false, 1000, 20), { base: 0, bonus: 0, total: 0 });
  });

  test('game: trivia players alternate turns', function () {
    var g = Game.create({ mode: 'trivia', players: ['Ana', 'Ben'], questions: trivia(4), total: 4 });
    var order = [];
    while (!Game.isOver(g)) {
      order.push(Game.turnInfo(g).actor);
      Game.answer(g, 0, 1000);
      Game.next(g);
    }
    eq(order, [0, 1, 0, 1]);
  });

  test('game: a correct trivia answer updates score, accuracy and fastest time', function () {
    var g = Game.create({ mode: 'trivia', players: ['Ana', 'Ben'], questions: trivia(2), total: 2, timerSeconds: 20 });
    var r = Game.answer(g, 0, 4000); // question 0: correctIndex 0
    ok(r.correct);
    eq(r.points.total, 140);
    eq(g.players[0].score, 140);
    eq(g.phase, 'reveal');
    Game.next(g);
    r = Game.answer(g, 3, 2000); // question 1: correctIndex 1
    ok(!r.correct);
    eq(g.players[1].score, 0);
    var s = Game.summary(g);
    eq(s.players[0].accuracy, 100);
    eq(s.players[1].accuracy, 0);
    eq(s.players[0].fastestMs, 4000);
    eq(s.players[1].fastestMs, null, 'fastest only counts right answers');
    eq(s.winner, 0);
  });

  test('game: timing out counts as wrong', function () {
    var g = Game.create({ mode: 'trivia', players: ['Ana', 'Ben'], questions: trivia(2), total: 2, timerSeconds: 20 });
    var r = Game.answer(g, -1, 20000);
    ok(r.timedOut);
    ok(!r.correct);
    eq(g.players[0].answered, 1);
  });

  test('game: total is capped by the number of questions available', function () {
    var g = Game.create({ mode: 'trivia', players: ['Ana', 'Ben'], questions: trivia(3), total: 10 });
    eq(g.total, 3);
  });

  test('game: with an odd count the last question goes to whoever is behind', function () {
    var g = Game.create({ mode: 'trivia', players: ['Ana', 'Ben'], questions: trivia(5), total: 5 });
    // Ana answers 0 and 2 wrong, Ben answers 1 and 3 right.
    Game.answer(g, 3, 1000); Game.next(g); // q0 correct 0: wrong
    Game.answer(g, 1, 1000); Game.next(g); // q1 correct 1: right
    Game.answer(g, 3, 1000); Game.next(g); // q2 correct 2: wrong
    Game.answer(g, 3, 1000); Game.next(g); // q3 correct 3: right
    var t = Game.turnInfo(g);
    ok(t.comeback);
    eq(t.actor, 0, 'Ana is behind, so the comeback question is hers');
  });

  test('game: comeback question on a tie keeps the normal order', function () {
    var g = Game.create({ mode: 'trivia', players: ['Ana', 'Ben'], questions: trivia(3), total: 3 });
    Game.answer(g, 3, 1000); Game.next(g);
    Game.answer(g, 3, 1000); Game.next(g);
    eq(Game.turnInfo(g).actor, 0);
  });

  test('game: know-me blocks - 10 questions are 5 + 5, always an even number of blocks', function () {
    function sizes(n) { return Game.knowmeBlocks(n).map(function (b) { return b.count; }); }
    eq(sizes(10), [5, 5]);
    eq(sizes(5), [3, 2]);
    eq(sizes(15), [4, 4, 4, 3]);
    eq(sizes(20), [5, 5, 5, 5]);
    eq(Game.knowmeBlocks(20).map(function (b) { return b.subject; }), [0, 1, 0, 1]);
  });

  test('game: know-me - one player answers a whole block, then the other guesses it in a row', function () {
    var g = Game.create({ mode: 'knowme', players: ['Ana', 'Ben'], questions: knowme(10), total: 10 });
    var log = [];
    var secrets = [2, 0, 1, 3, 2];
    // Ana answers 5 questions about herself, without anyone guessing in between.
    for (var i = 0; i < 5; i++) {
      eq(g.phase, 'secret');
      var t = Game.turnInfo(g);
      eq([t.subject, t.blockPos, t.blockSize], [0, i + 1, 5]);
      var done = Game.lockSecret(g, secrets[i]);
      eq(done, i === 4, 'block is done only after the 5th answer');
    }
    // Ben guesses those 5 answers, with a reveal after each.
    eq(g.phase, 'guess');
    for (i = 0; i < 5; i++) {
      t = Game.turnInfo(g);
      eq([t.guesser, t.blockPos], [1, i + 1]);
      var r = Game.guess(g, i < 3 ? secrets[i] : (secrets[i] + 1) % 4, 1000);
      log.push(r.match);
      eq(r.secret, secrets[i]);
      Game.next(g);
    }
    eq(log, [true, true, true, false, false]);
    eq(g.players[1].score, 3);
    // Then the roles swap: Ben answers about himself.
    eq(g.phase, 'secret');
    eq(Game.turnInfo(g).subject, 1);
    for (i = 0; i < 5; i++) { Game.lockSecret(g, 1); }
    for (i = 0; i < 5; i++) {
      eq(Game.turnInfo(g).guesser, 0);
      Game.guess(g, 1, 500);
      Game.next(g);
    }
    ok(Game.isOver(g));
    eq(g.players[0].score, 5);
    eq(Game.summary(g).winner, 0);
  });

  test('game: actions in the wrong phase throw', function () {
    var g = Game.create({ mode: 'knowme', players: ['Ana', 'Ben'], questions: knowme(1), total: 1 });
    T.throws(function () { Game.guess(g, 1, 0); }, 'cannot guess before the secret');
    T.throws(function () { Game.answer(g, 1, 0); }, 'no trivia answers in know-me');
    T.throws(function () { Game.next(g); }, 'cannot skip the turn');
    T.throws(function () { Game.lockSecret(g, 7); }, 'secret must be 0-3');
  });

  test('game: tie gives winner -1', function () {
    var g = Game.create({ mode: 'trivia', players: ['Ana', 'Ben'], questions: trivia(2), total: 2 });
    Game.answer(g, 0, 1000); Game.next(g);
    Game.answer(g, 1, 1000); Game.next(g);
    eq(Game.summary(g).winner, -1);
  });

  test('game: best streak is tracked', function () {
    var g = Game.create({ mode: 'trivia', players: ['Ana', 'Ben'], questions: trivia(8), total: 8 });
    var answersForAna = [true, true, false, true];
    for (var i = 0; i < 8; i++) {
      var q = Game.currentQuestion(g);
      var right = i % 2 === 0 ? answersForAna[i / 2] : false;
      Game.answer(g, right ? q.correctIndex : (q.correctIndex + 1) % 4, 1000);
      Game.next(g);
    }
    eq(g.players[0].bestStreak, 2);
  });

  test('game: stopwatch leaves out paused time', function () {
    var t = 1000;
    var sw = new Game.Stopwatch(function () { return t; });
    t = 3000;
    sw.pause();
    t = 10000;
    eq(sw.elapsed(), 2000, 'frozen while paused');
    sw.resume();
    t = 11000;
    eq(sw.elapsed(), 3000);
  });
})(this);
