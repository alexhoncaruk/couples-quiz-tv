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

  var fileCats = manifest.categories.filter(function (c) { return !c.mix; });

  fileCats.forEach(function (cat) {
    T.test('data: ' + cat.file + ' is valid', function () {
      T.eq(Q.validateFile(load(cat), cat.mode), []);
    });
  });

  T.test('data: big categories - 60+ per trivia category, 40+ per know-me set', function () {
    fileCats.forEach(function (cat) {
      if (cat.id === 'custom') { return; }
      var min = cat.mode === 'knowme' ? 40 : 60;
      T.ok(load(cat).questions.length >= min, cat.id + ' has only ' + load(cat).questions.length + ' questions');
    });
  });

  T.test('data: question ids are unique across all categories (the played-history is shared)', function () {
    var seen = {};
    fileCats.forEach(function (cat) {
      load(cat).questions.forEach(function (q) {
        T.ok(!seen[q.id], q.id + ' is used in ' + seen[q.id] + ' and ' + cat.id);
        seen[q.id] = cat.id;
      });
    });
  });

  T.test('data: mix categories mix a mode that has categories', function () {
    manifest.categories.filter(function (c) { return c.mix; }).forEach(function (mix) {
      T.ok(fileCats.some(function (c) { return c.mode === mix.mix; }), mix.id);
    });
  });

  T.test('data: every know-me prompt mentions {name}', function () {
    fileCats.filter(function (c) { return c.mode === 'knowme'; }).forEach(function (cat) {
      load(cat).questions.forEach(function (q) { T.ok(q.question.indexOf('{name}') >= 0, q.id); });
    });
  });
})();
