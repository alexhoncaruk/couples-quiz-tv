/* Couples Quiz TV - game logic and scoring (pure, no DOM, unit tested).
 *
 * Trivia: players alternate questions. A right answer scores 100 points plus up to 50
 * for speed (full bonus at 0 s, none at the end of the timer window). With an odd number
 * of questions, the last one is a "comeback question" for whoever is behind (on a tie
 * the normal turn order decides).
 *
 * How well do you know me: played in blocks of up to 5 questions. One player (the
 * subject) secretly answers the whole block about themselves, then the other (the
 * guesser) guesses those answers one by one, each followed by a reveal. A match scores
 * 1 point for the guesser. Then the roles swap for the next block.
 *
 * Phases of a game: 'answer' (trivia), or 'secret' (x block) then 'guess' (know me),
 * then 'reveal' after every answer or guess, and finally 'over'. */
(function (root) {
  'use strict';

  var BASE_POINTS = 100;
  var MAX_SPEED_BONUS = 50;
  var DEFAULT_SPEED_WINDOW_S = 20;
  var KNOWME_BLOCK = 5;

  /* Splits a know-me game into blocks of at most 5 questions, always an even number of
   * blocks so both players get a turn as the subject: 5 -> 3+2, 10 -> 5+5,
   * 15 -> 4+4+4+3, 20 -> 5+5+5+5. Block k is about player k % 2. */
  function knowmeBlocks(total) {
    var n = 2 * Math.ceil(total / (2 * KNOWME_BLOCK));
    var base = Math.floor(total / n);
    var extra = total % n;
    var blocks = [];
    var start = 0;
    for (var k = 0; k < n; k++) {
      var count = base + (k < extra ? 1 : 0);
      if (count > 0) { blocks.push({ start: start, count: count, subject: k % 2 }); }
      start += count;
    }
    return blocks;
  }

  function blockAt(game, i) {
    for (var k = 0; k < game.blocks.length; k++) {
      var b = game.blocks[k];
      if (i >= b.start && i < b.start + b.count) { return b; }
    }
    return null;
  }

  function newPlayer(name) {
    return { name: name, score: 0, answered: 0, correct: 0, fastestMs: null, streak: 0, bestStreak: 0 };
  }

  /* opts: { mode: 'trivia' | 'knowme', players: [name, name], questions: [...],
   *         total: number of turns, timerSeconds: 0 for no timer,
   *         categoryId, categoryName } */
  function create(opts) {
    var mode = opts.mode === 'knowme' ? 'knowme' : 'trivia';
    var total = Math.min(opts.total || opts.questions.length, opts.questions.length);
    return {
      mode: mode,
      categoryId: opts.categoryId || null,
      categoryName: opts.categoryName || '',
      players: [newPlayer(opts.players[0]), newPlayer(opts.players[1])],
      questions: opts.questions.slice(0, total),
      total: total,
      index: 0,
      phase: mode === 'knowme' ? 'secret' : 'answer',
      timerSeconds: opts.timerSeconds || 0,
      speedWindow: opts.timerSeconds || DEFAULT_SPEED_WINDOW_S,
      blocks: mode === 'knowme' ? knowmeBlocks(total) : [],
      secrets: {},
      last: null,
      history: []
    };
  }

  function speedBonus(elapsedMs, windowSeconds) {
    var f = 1 - elapsedMs / (windowSeconds * 1000);
    if (f < 0) { f = 0; }
    if (f > 1) { f = 1; }
    return Math.round(MAX_SPEED_BONUS * f);
  }

  function scoreTrivia(correct, elapsedMs, windowSeconds) {
    if (!correct) { return { base: 0, bonus: 0, total: 0 }; }
    var bonus = speedBonus(elapsedMs, windowSeconds || DEFAULT_SPEED_WINDOW_S);
    return { base: BASE_POINTS, bonus: bonus, total: BASE_POINTS + bonus };
  }

  function isComeback(game, i) {
    return game.mode === 'trivia' && game.total > 1 && game.total % 2 === 1 && i === game.total - 1;
  }

  /* Index of the player who can score on turn i (trivia: the answerer, know me: the guesser). */
  function actorIndex(game, i) {
    if (game.mode === 'knowme') { return 1 - blockAt(game, i).subject; }
    var normal = i % 2;
    if (isComeback(game, i)) {
      var a = game.players[0].score;
      var b = game.players[1].score;
      if (a < b) { return 0; }
      if (b < a) { return 1; }
    }
    return normal;
  }

  /* Who does what on the current turn. */
  function turnInfo(game) {
    var i = game.index;
    var actor = actorIndex(game, i);
    var block = game.mode === 'knowme' ? blockAt(game, i) : null;
    return {
      index: i,
      number: i + 1,
      total: game.total,
      actor: actor,
      guesser: actor,
      subject: game.mode === 'knowme' ? 1 - actor : actor,
      comeback: isComeback(game, i),
      blockPos: block ? i - block.start + 1 : 1, // 1-based position inside the block
      blockSize: block ? block.count : 1,
      blockStart: block ? i === block.start : true
    };
  }

  function currentQuestion(game) {
    return game.questions[game.index] || null;
  }

  function expectPhase(game, phase) {
    if (game.phase !== phase) { throw new Error('Expected phase ' + phase + ' but game is in ' + game.phase); }
  }

  function recordFastest(p, elapsedMs) {
    if (p.fastestMs === null || elapsedMs < p.fastestMs) { p.fastestMs = elapsedMs; }
  }

  function award(p, hit, points, elapsedMs) {
    p.answered++;
    if (hit) {
      p.correct++;
      p.score += points;
      p.streak++;
      if (p.streak > p.bestStreak) { p.bestStreak = p.streak; }
      recordFastest(p, elapsedMs);
    } else {
      p.streak = 0;
    }
  }

  /* Trivia answer. choice = 0..3, or -1 when the timer ran out. */
  function answer(game, choice, elapsedMs) {
    expectPhase(game, 'answer');
    var t = turnInfo(game);
    var q = currentQuestion(game);
    var correct = choice >= 0 && choice === q.correctIndex;
    var points = scoreTrivia(correct, elapsedMs, game.speedWindow);
    award(game.players[t.actor], correct, points.total, elapsedMs);
    var result = {
      type: 'trivia',
      actor: t.actor,
      questionId: q.id,
      choice: choice,
      correctIndex: q.correctIndex,
      correct: correct,
      timedOut: choice < 0,
      points: points,
      elapsedMs: elapsedMs
    };
    game.history.push(result);
    game.last = result;
    game.phase = 'reveal';
    return result;
  }

  /* Know me, step 1: the subject locks in their own answer, then moves on to the next
   * question of the block. Returns true when the whole block is locked in and it is the
   * guesser's turn. */
  function lockSecret(game, choice) {
    expectPhase(game, 'secret');
    if (!(choice >= 0 && choice <= 3)) { throw new Error('Secret answer must be 0-3'); }
    game.secrets[game.index] = choice;
    var block = blockAt(game, game.index);
    if (game.index < block.start + block.count - 1) {
      game.index++;
      return false;
    }
    game.index = block.start;
    game.phase = 'guess';
    return true;
  }

  /* Know me, step 2: the guesser guesses one answer. choice -1 = timer ran out. */
  function guess(game, choice, elapsedMs) {
    expectPhase(game, 'guess');
    var t = turnInfo(game);
    var q = currentQuestion(game);
    var secret = game.secrets[game.index];
    var match = choice >= 0 && choice === secret;
    award(game.players[t.guesser], match, match ? 1 : 0, elapsedMs);
    var result = {
      type: 'knowme',
      questionId: q.id,
      subject: t.subject,
      guesser: t.guesser,
      actor: t.guesser,
      secret: secret,
      choice: choice,
      match: match,
      timedOut: choice < 0,
      points: { base: match ? 1 : 0, bonus: 0, total: match ? 1 : 0 },
      elapsedMs: elapsedMs
    };
    game.history.push(result);
    game.last = result;
    game.phase = 'reveal';
    return result;
  }

  /* Go to the next turn. Returns false when the game is over. In know-me mode the next
   * turn is the next guess of the block, or the next block's secret answers. */
  function next(game) {
    expectPhase(game, 'reveal');
    game.index++;
    if (game.index >= game.total) {
      game.phase = 'over';
      return false;
    }
    if (game.mode === 'knowme') {
      game.phase = blockAt(game, game.index).start === game.index ? 'secret' : 'guess';
    } else {
      game.phase = 'answer';
    }
    return true;
  }

  function isOver(game) {
    return game.phase === 'over';
  }

  function isLastTurn(game) {
    return game.index >= game.total - 1;
  }

  /* Final standings: winner index (-1 for a tie) and per-player stats. */
  function summary(game) {
    var players = game.players.map(function (p) {
      return {
        name: p.name,
        score: p.score,
        answered: p.answered,
        correct: p.correct,
        accuracy: p.answered ? Math.round(100 * p.correct / p.answered) : 0,
        fastestMs: p.fastestMs,
        bestStreak: p.bestStreak
      };
    });
    var winner = -1;
    if (players[0].score > players[1].score) { winner = 0; }
    if (players[1].score > players[0].score) { winner = 1; }
    return { winner: winner, players: players, mode: game.mode, total: game.total };
  }

  /* Measures answer time, leaving out time spent in the pause ("Quit game?") dialog. */
  function Stopwatch(now) {
    this.now = now || function () { return Date.now(); };
    this.startedAt = this.now();
    this.pausedAt = null;
    this.pausedTotal = 0;
  }
  Stopwatch.prototype.pause = function () {
    if (this.pausedAt === null) { this.pausedAt = this.now(); }
  };
  Stopwatch.prototype.resume = function () {
    if (this.pausedAt !== null) {
      this.pausedTotal += this.now() - this.pausedAt;
      this.pausedAt = null;
    }
  };
  Stopwatch.prototype.elapsed = function () {
    var end = this.pausedAt !== null ? this.pausedAt : this.now();
    return Math.max(0, end - this.startedAt - this.pausedTotal);
  };

  var Game = {
    BASE_POINTS: BASE_POINTS,
    MAX_SPEED_BONUS: MAX_SPEED_BONUS,
    create: create,
    speedBonus: speedBonus,
    scoreTrivia: scoreTrivia,
    turnInfo: turnInfo,
    currentQuestion: currentQuestion,
    answer: answer,
    lockSecret: lockSecret,
    guess: guess,
    next: next,
    isOver: isOver,
    isLastTurn: isLastTurn,
    summary: summary,
    Stopwatch: Stopwatch,
    knowmeBlocks: knowmeBlocks
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = Game;
  } else {
    root.CQ = root.CQ || {};
    root.CQ.Game = Game;
  }
})(this);
