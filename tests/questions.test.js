/* Tests for src/questions.js: validation, shuffling, picking unseen questions. */
(function (root) {
  'use strict';
  var inNode = typeof module === 'object' && module.exports;
  var T = inNode ? require('./harness') : root.T;
  var Q = inNode ? require('../src/questions') : root.CQ.Questions;
  var test = T.test, eq = T.eq, ok = T.ok;

  /* Seeded random numbers so the tests always do the same thing. */
  function rng(seed) {
    var s = seed || 1;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  var good = { id: 'x-1', question: 'Q?', options: ['a', 'b', 'c', 'd'], correctIndex: 2, difficulty: 1, tags: ['t'] };
  var prompt = { id: 'k-1', question: '{name} likes?', options: ['a', 'b', 'c', 'd'], tags: [] };

  function copy(o, changes) {
    var c = JSON.parse(JSON.stringify(o));
    for (var k in changes) { c[k] = changes[k]; }
    return c;
  }

  test('questions: a well-formed trivia question passes', function () {
    eq(Q.validateQuestion(good, 'trivia'), []);
  });

  test('questions: broken trivia questions are caught', function () {
    ok(Q.validateQuestion(copy(good, { options: ['a', 'b', 'c'] }), 'trivia').length, '3 options');
    ok(Q.validateQuestion(copy(good, { options: ['a', 'b', 'c', 'A'] }), 'trivia').length, 'duplicate option');
    ok(Q.validateQuestion(copy(good, { correctIndex: 4 }), 'trivia').length, 'correctIndex 4');
    ok(Q.validateQuestion(copy(good, { correctIndex: '1' }), 'trivia').length, 'correctIndex as text');
    ok(Q.validateQuestion(copy(good, { difficulty: 5 }), 'trivia').length, 'difficulty 5');
    ok(Q.validateQuestion(copy(good, { question: '  ' }), 'trivia').length, 'empty question');
    ok(Q.validateQuestion(copy(good, { tags: 'geo' }), 'trivia').length, 'tags not a list');
  });

  test('questions: know-me prompts must not have a correctIndex', function () {
    eq(Q.validateQuestion(prompt, 'knowme'), []);
    ok(Q.validateQuestion(copy(prompt, { correctIndex: 0 }), 'knowme').length);
  });

  test('questions: duplicate ids in a file are caught', function () {
    var errors = Q.validateFile({ questions: [good, good] }, 'trivia');
    ok(errors.join(' ').indexOf('duplicate id') >= 0);
  });

  test('questions: manifest validation', function () {
    eq(Q.validateManifest({ categories: [{ id: 'a', name: 'A', file: 'questions/a.json', mode: 'trivia' }] }), []);
    ok(Q.validateManifest({ categories: [{ id: 'a', name: 'A', file: 'f', mode: 'quiz' }] }).length, 'bad mode');
    ok(Q.validateManifest({ categories: [] }).length, 'empty');
  });

  test('questions: shuffled options keep the right answer', function () {
    var r = rng(7);
    for (var i = 0; i < 50; i++) {
      var p = Q.prepareQuestion(good, 'trivia', r);
      eq(p.options[p.correctIndex], 'c');
      eq(p.options.slice().sort(), ['a', 'b', 'c', 'd']);
    }
    eq(good.options, ['a', 'b', 'c', 'd'], 'original untouched');
  });

  test('questions: keepOrder and know-me prompts are not shuffled', function () {
    eq(Q.prepareQuestion(copy(good, { keepOrder: true }), 'trivia', rng(3)).options, ['a', 'b', 'c', 'd']);
    eq(Q.prepareQuestion(prompt, 'knowme', rng(3)).options, ['a', 'b', 'c', 'd']);
  });

  test('questions: pick prefers unseen questions and remembers them', function () {
    var list = [];
    for (var i = 0; i < 10; i++) { list.push(copy(good, { id: 'q' + i })); }
    var first = Q.pick(list, 4, [], 'trivia', rng(1));
    eq(first.questions.length, 4);
    eq(first.seen.length, 4);
    var second = Q.pick(list, 4, first.seen, 'trivia', rng(2));
    second.questions.forEach(function (q) { ok(first.seen.indexOf(q.id) < 0, q.id + ' was already played'); });
    eq(second.seen.length, 8);
  });

  test('questions: pick starts a new cycle when it runs out of unseen questions', function () {
    var list = [];
    for (var i = 0; i < 5; i++) { list.push(copy(good, { id: 'q' + i })); }
    var res = Q.pick(list, 4, ['q0', 'q1', 'q2'], 'trivia', rng(5));
    eq(res.questions.length, 4);
    var ids = res.questions.map(function (q) { return q.id; });
    ok(ids.indexOf('q3') >= 0 && ids.indexOf('q4') >= 0, 'both unseen questions are used first');
    eq(res.seen.length, 4, 'seen list restarts with this game');
  });

  test('questions: pick never returns more than the list has', function () {
    eq(Q.pick([good], 10, [], 'trivia', rng(1)).questions.length, 1);
  });
})(this);
