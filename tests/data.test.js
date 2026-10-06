/* Node-only: every content file listed in the manifest is valid and big enough. */
(function () {
  'use strict';
  if (typeof module !== 'object' || !module.exports) { return; }
  var fs = require('fs');
  var path = require('path');
  var T = require('./harness');
  var Q = require('../src/questions');
  var DATA = path.join(__dirname, '..', 'data');
  var manifest = JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8'));

  function load(cat) {
    return JSON.parse(fs.readFileSync(path.join(DATA, cat.file), 'utf8'));
  }

  T.test('data: manifest is valid', function () {
    T.eq(Q.validateManifest(manifest), []);
  });

  manifest.categories.forEach(function (cat) {
    T.test('data: ' + cat.file + ' is valid', function () {
      T.eq(Q.validateFile(load(cat), cat.mode), []);
    });
  });

  T.test('data: 30 questions per built-in trivia category, 25 know-me prompts', function () {
    var minimum = { mixed: 30, 'movies-tv': 30, geography: 30, 'know-me': 25 };
    manifest.categories.forEach(function (cat) {
      if (minimum[cat.id]) { T.ok(load(cat).questions.length >= minimum[cat.id], cat.id + ' has too few questions'); }
    });
  });

  T.test('data: every know-me prompt mentions {name}', function () {
    manifest.categories.filter(function (c) { return c.mode === 'knowme'; }).forEach(function (cat) {
      load(cat).questions.forEach(function (q) { T.ok(q.question.indexOf('{name}') >= 0, q.id); });
    });
  });
})();
