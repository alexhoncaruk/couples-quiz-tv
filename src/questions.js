/* Couples Quiz TV - loading, checking and picking questions.
 *
 * data/manifest.json lists the categories (one line each). Every category points to a
 * JSON file in data/questions/ with this shape:
 *   { "category": "mixed", "mode": "trivia", "questions": [ ... ] }
 * Trivia question: { id, question, options[4], correctIndex (0-3), difficulty (1-3), tags[] }
 *   optional: "keepOrder": true to stop the options being shuffled (e.g. years in order)
 * Know-me prompt:  { id, question, options[4], tags[] } with no correctIndex. Write
 *   {name} where the subject's name goes: "{name}'s perfect Sunday is..."
 *
 * A manifest entry with "mix": "trivia" (or "knowme") instead of "file" is a mix of
 * every category of that mode.
 *
 * The validators are shared with tools/questions.js and the tests (Node module). */
(function (root) {
  'use strict';

  var MODES = { trivia: true, knowme: true };

  function isArray(v) {
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  function isText(v) {
    return typeof v === 'string' && v.replace(/\s+/g, '') !== '';
  }

  function isInt(v) {
    return typeof v === 'number' && isFinite(v) && Math.floor(v) === v;
  }

  /* Returns a list of problems with one question (empty list = valid). */
  function validateQuestion(q, mode) {
    var errors = [];
    if (!q || typeof q !== 'object') { return ['not an object']; }
    if (!isText(q.id)) { errors.push('missing id'); }
    if (!isText(q.question)) { errors.push('missing question text'); }
    if (!isArray(q.options) || q.options.length !== 4) {
      errors.push('needs exactly 4 options');
    } else {
      var seen = {};
      for (var i = 0; i < 4; i++) {
        if (!isText(q.options[i])) { errors.push('option ' + (i + 1) + ' is empty'); continue; }
        var k = q.options[i].toLowerCase();
        if (seen[k]) { errors.push('duplicate option "' + q.options[i] + '"'); }
        seen[k] = true;
      }
    }
    if (!isArray(q.tags)) {
      errors.push('tags must be a list');
    } else {
      for (var t = 0; t < q.tags.length; t++) {
        if (!isText(q.tags[t])) { errors.push('tags must be text'); break; }
      }
    }
    if (mode === 'knowme') {
      if (q.hasOwnProperty('correctIndex')) { errors.push('know-me prompts have no correctIndex'); }
      if (q.hasOwnProperty('difficulty') && !(isInt(q.difficulty) && q.difficulty >= 1 && q.difficulty <= 3)) {
        errors.push('difficulty must be 1, 2 or 3');
      }
    } else {
      if (!(isInt(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex <= 3)) {
        errors.push('correctIndex must be 0, 1, 2 or 3');
      }
      if (!(isInt(q.difficulty) && q.difficulty >= 1 && q.difficulty <= 3)) {
        errors.push('difficulty must be 1, 2 or 3');
      }
    }
    return errors;
  }

  /* Checks a whole category file. Returns a list of "id: problem" strings. */
  function validateFile(data, mode) {
    if (!data || !isArray(data.questions)) { return ['file must have a "questions" list']; }
    var errors = [];
    if (data.mode && data.mode !== mode) { errors.push('file mode "' + data.mode + '" does not match manifest mode "' + mode + '"'); }
    var ids = {};
    for (var i = 0; i < data.questions.length; i++) {
      var q = data.questions[i];
      var label = (q && q.id) || ('#' + (i + 1));
      var problems = validateQuestion(q, mode);
      for (var p = 0; p < problems.length; p++) { errors.push(label + ': ' + problems[p]); }
      if (q && q.id) {
        if (ids[q.id]) { errors.push(label + ': duplicate id'); }
        ids[q.id] = true;
      }
    }
    return errors;
  }

  function validateManifest(m) {
    if (!m || !isArray(m.categories) || !m.categories.length) { return ['manifest needs a non-empty "categories" list']; }
    var errors = [];
    var ids = {};
    for (var i = 0; i < m.categories.length; i++) {
      var c = m.categories[i] || {};
      var label = c.id || ('category #' + (i + 1));
      if (!isText(c.id)) { errors.push(label + ': missing id'); }
      if (!isText(c.name)) { errors.push(label + ': missing name'); }
      if (c.mix) {
        if (!MODES[c.mix]) { errors.push(label + ': mix must be "trivia" or "knowme"'); }
      } else if (!isText(c.file)) {
        errors.push(label + ': missing file');
      }
      if (!MODES[c.mode]) { errors.push(label + ': mode must be "trivia" or "knowme"'); }
      if (c.id && ids[c.id]) { errors.push(label + ': duplicate id'); }
      ids[c.id] = true;
    }
    return errors;
  }

  /* Fisher-Yates on a copy. rng() returns [0, 1). */
  function shuffle(list, rng) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /* A copy of the question with its options shuffled (trivia only, unless keepOrder). */
  function prepareQuestion(q, mode, rng) {
    var copy = {};
    for (var k in q) { if (q.hasOwnProperty(k)) { copy[k] = q[k]; } }
    if (mode === 'knowme' || q.keepOrder) {
      copy.options = q.options.slice();
      return copy;
    }
    var order = shuffle([0, 1, 2, 3], rng);
    copy.options = order.map(function (i) { return q.options[i]; });
    copy.correctIndex = order.indexOf(q.correctIndex);
    return copy;
  }

  /* Pick `count` questions, preferring ones not seen in earlier games.
   * seenIds is one list for all categories (ids are unique across files), so a question
   * played in a mix also counts as played in its own category and the other way round.
   * Returns { questions, seen } where `seen` is the updated list to save. When this list
   * of questions runs out of unseen ones, only its own ids start over. */
  function pick(list, count, seenIds, mode, rng) {
    rng = rng || Math.random;
    seenIds = seenIds || [];
    var seenMap = {};
    for (var i = 0; i < seenIds.length; i++) { seenMap[seenIds[i]] = true; }
    var fresh = shuffle(list.filter(function (q) { return !seenMap[q.id]; }), rng);
    var old = shuffle(list.filter(function (q) { return seenMap[q.id]; }), rng);
    var chosen = fresh.slice(0, count);
    var ids = function (qs) { return qs.map(function (q) { return q.id; }); };
    var seen;
    if (chosen.length < count) {
      chosen = chosen.concat(old.slice(0, count - chosen.length));
      var inList = {};
      list.forEach(function (q) { inList[q.id] = true; });
      seen = seenIds.filter(function (id) { return !inList[id]; }).concat(ids(chosen));
    } else {
      seen = seenIds.concat(ids(chosen));
    }
    return {
      questions: chosen.map(function (q) { return prepareQuestion(q, mode, rng); }),
      seen: seen
    };
  }

  /* XMLHttpRequest instead of fetch: works on every old TV browser. */
  function getJSON(url) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) { return; }
        var okStatus = (xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.responseText);
        if (!okStatus) { reject(new Error('Could not load ' + url + ' (HTTP ' + xhr.status + ')')); return; }
        try { resolve(JSON.parse(xhr.responseText)); } catch (e) { reject(new Error('Bad JSON in ' + url + ': ' + e.message)); }
      };
      xhr.send();
    });
  }

  var DATA_DIR = 'data/';
  var cache = {};

  function loadManifest() {
    return getJSON(DATA_DIR + 'manifest.json').then(function (m) {
      var errors = validateManifest(m);
      if (errors.length) { throw new Error('manifest.json: ' + errors.join('; ')); }
      return m;
    });
  }

  /* Loads a category's questions, dropping (and logging) any invalid ones.
   * A mix category loads every file-based category of its mode from the manifest. */
  function loadCategory(cat, manifest) {
    if (cache[cat.id]) { return Promise.resolve(cache[cat.id]); }
    if (cat.mix) {
      var parts = (manifest ? manifest.categories : []).filter(function (c) { return !c.mix && c.mode === cat.mix; });
      return Promise.all(parts.map(function (c) { return loadCategory(c); })).then(function (lists) {
        var all = [].concat.apply([], lists);
        if (!all.length) { throw new Error('No questions to mix'); }
        cache[cat.id] = all;
        return all;
      });
    }
    return getJSON(DATA_DIR + cat.file).then(function (data) {
      if (!data || !isArray(data.questions)) { throw new Error(cat.file + ' has no "questions" list'); }
      var valid = data.questions.filter(function (q) {
        var problems = validateQuestion(q, cat.mode);
        if (problems.length && root.console) { root.console.warn(cat.file, (q && q.id) || '?', problems.join(', ')); }
        return !problems.length;
      });
      if (!valid.length) { throw new Error(cat.file + ' has no valid questions'); }
      cache[cat.id] = valid;
      return valid;
    });
  }

  var Questions = {
    validateQuestion: validateQuestion,
    validateFile: validateFile,
    validateManifest: validateManifest,
    shuffle: shuffle,
    prepareQuestion: prepareQuestion,
    pick: pick,
    loadManifest: loadManifest,
    loadCategory: loadCategory
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = Questions;
  } else {
    root.CQ = root.CQ || {};
    root.CQ.Questions = Questions;
  }
})(this);
