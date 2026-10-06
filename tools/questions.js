#!/usr/bin/env node
/* Couples Quiz TV - question tool (plain Node, no dependencies).
 *
 *   node tools/questions.js validate                  check the manifest and every question file
 *   node tools/questions.js list                      show categories and question counts
 *   node tools/questions.js add <category-id>         add a question by answering prompts
 *   node tools/questions.js new-category <id> "<Name>" [trivia|knowme] ["description"]
 *                                                     create a question file + manifest line
 *   node tools/questions.js format                    rewrite files in the standard layout
 *
 * The validation rules are the same ones the game uses (src/questions.js). */
'use strict';

var fs = require('fs');
var path = require('path');
var readline = require('readline');
var Q = require('../src/questions');

var ROOT = path.join(__dirname, '..');
var DATA = path.join(ROOT, 'data');
var MANIFEST = path.join(DATA, 'manifest.json');
var KEY_ORDER = ['id', 'question', 'options', 'correctIndex', 'difficulty', 'tags', 'keepOrder'];

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function ordered(obj, keys) {
  var out = {};
  keys.forEach(function (k) { if (obj.hasOwnProperty(k)) { out[k] = obj[k]; } });
  Object.keys(obj).forEach(function (k) { if (!out.hasOwnProperty(k)) { out[k] = obj[k]; } });
  return out;
}

/* One question per line keeps diffs small and files easy to scan. */
function serializeFile(data) {
  var qs = data.questions || [];
  var lines = ['{'];
  lines.push('  "category": ' + JSON.stringify(data.category) + ',');
  lines.push('  "mode": ' + JSON.stringify(data.mode) + ',');
  lines.push('  "questions": [');
  qs.forEach(function (q, i) {
    lines.push('    ' + JSON.stringify(ordered(q, KEY_ORDER)) + (i < qs.length - 1 ? ',' : ''));
  });
  lines.push('  ]');
  lines.push('}');
  return lines.join('\n') + '\n';
}

/* One category per line, so adding a category is adding one line. */
function serializeManifest(m) {
  var cats = m.categories;
  var lines = ['{', '  "categories": ['];
  cats.forEach(function (c, i) {
    lines.push('    ' + JSON.stringify(ordered(c, ['id', 'name', 'mode', 'file', 'mix', 'description'])) + (i < cats.length - 1 ? ',' : ''));
  });
  lines.push('  ]', '}');
  return lines.join('\n') + '\n';
}

function loadManifest() {
  return readJSON(MANIFEST);
}

function findCategory(m, id) {
  var c = m.categories.filter(function (x) { return x.id === id && !x.mix; })[0];
  if (!c) {
    console.error('No category "' + id + '". Known: ' + m.categories.map(function (x) { return x.id; }).join(', '));
    process.exit(1);
  }
  return c;
}

function validate() {
  var m = loadManifest();
  var errors = Q.validateManifest(m).map(function (e) { return 'manifest.json: ' + e; });
  var counts = [];
  (m.categories || []).forEach(function (c) {
    if (c.mix) { counts.push(c.id + ' (mix of every ' + c.mix + ' category)'); return; }
    var file = path.join(DATA, c.file || '');
    if (!c.file || !fs.existsSync(file)) { errors.push(c.id + ': file not found: data/' + c.file); return; }
    var data;
    try { data = readJSON(file); } catch (e) { errors.push(c.file + ': invalid JSON: ' + e.message); return; }
    Q.validateFile(data, c.mode).forEach(function (e) { errors.push(c.file + ': ' + e); });
    counts.push(c.id + ' (' + c.mode + '): ' + (data.questions || []).length + ' questions');
  });
  counts.forEach(function (line) { console.log('  ' + line); });
  if (errors.length) {
    console.error('\n' + errors.length + ' problem(s):');
    errors.forEach(function (e) { console.error('  - ' + e); });
    process.exit(1);
  }
  console.log('\nAll question files are valid.');
}

function list() {
  var m = loadManifest();
  m.categories.forEach(function (c) {
    if (c.mix) { console.log(c.id + '\tmix\t-\t' + c.name); return; }
    var data = readJSON(path.join(DATA, c.file));
    console.log(c.id + '\t' + c.mode + '\t' + data.questions.length + '\t' + c.name);
  });
}

function nextId(categoryId, questions) {
  var max = 0;
  questions.forEach(function (q) {
    var m = /-(\d+)$/.exec(q.id || '');
    if (m) { max = Math.max(max, parseInt(m[1], 10)); }
  });
  var n = String(max + 1);
  while (n.length < 3) { n = '0' + n; }
  return categoryId + '-' + n;
}

function add(categoryId) {
  var m = loadManifest();
  var cat = findCategory(m, categoryId);
  var file = path.join(DATA, cat.file);
  var data = readJSON(file);
  var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  var answers = [];
  var steps = [
    cat.mode === 'knowme' ? 'Prompt (use {name} for the person, e.g. "{name}\'s dream car is..."): ' : 'Question: ',
    'Option 1: ', 'Option 2: ', 'Option 3: ', 'Option 4: '
  ];
  if (cat.mode === 'trivia') { steps.push('Which option is correct? (1-4): ', 'Difficulty (1 easy, 2 medium, 3 hard) [1]: '); }
  steps.push('Tags, comma separated (optional): ');

  function ask(i) {
    if (i >= steps.length) { return finish(); }
    rl.question(steps[i], function (a) { answers.push(a.trim()); ask(i + 1); });
  }

  function finish() {
    rl.close();
    var q = { id: nextId(cat.id, data.questions), question: answers[0], options: answers.slice(1, 5) };
    var rest = answers.slice(5);
    if (cat.mode === 'trivia') {
      q.correctIndex = parseInt(rest.shift(), 10) - 1;
      q.difficulty = parseInt(rest.shift() || '1', 10);
    }
    q.tags = (rest.shift() || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    var problems = Q.validateQuestion(q, cat.mode);
    if (problems.length) {
      console.error('Not saved: ' + problems.join(', '));
      process.exit(1);
    }
    data.questions.push(q);
    fs.writeFileSync(file, serializeFile(data));
    console.log('Added ' + q.id + ' to data/' + cat.file + ' (' + data.questions.length + ' questions).');
  }

  ask(0);
}

function newCategory(id, name, mode, description) {
  if (!id || !name) { usage(1); }
  if (!/^[a-z0-9-]+$/.test(id)) { console.error('Use lowercase letters, digits and dashes for the id.'); process.exit(1); }
  mode = mode || 'trivia';
  var m = loadManifest();
  if (m.categories.some(function (c) { return c.id === id; })) { console.error('Category "' + id + '" already exists.'); process.exit(1); }
  var rel = 'questions/' + id + '.json';
  var file = path.join(DATA, rel);
  if (!fs.existsSync(file)) { fs.writeFileSync(file, serializeFile({ category: id, mode: mode, questions: [] })); }
  m.categories.push({ id: id, name: name, mode: mode, file: rel, description: description || '' });
  var errors = Q.validateManifest(m);
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  fs.writeFileSync(MANIFEST, serializeManifest(m));
  console.log('Created data/' + rel + ' and added it to data/manifest.json.');
  console.log('Now add questions: node tools/questions.js add ' + id);
}

function format() {
  var m = loadManifest();
  fs.writeFileSync(MANIFEST, serializeManifest(m));
  var files = m.categories.filter(function (c) { return !c.mix; });
  files.forEach(function (c) {
    var file = path.join(DATA, c.file);
    fs.writeFileSync(file, serializeFile(readJSON(file)));
  });
  console.log('Formatted manifest and ' + files.length + ' question files.');
}

var USAGE = [
  'Couples Quiz TV - question tool',
  '',
  '  node tools/questions.js validate                  check the manifest and every question file',
  '  node tools/questions.js list                      show categories and question counts',
  '  node tools/questions.js add <category-id>         add a question by answering prompts',
  '  node tools/questions.js new-category <id> "<Name>" [trivia|knowme] ["description"]',
  '                                                    create a question file + manifest line',
  '  node tools/questions.js format                    rewrite files in the standard layout'
].join('\n');

function usage(code) {
  console.log(USAGE);
  process.exit(code || 0);
}

if (require.main === module) {
  var args = process.argv.slice(2);
  var cmd = args[0];
  if (cmd === 'validate') { validate(); } else if (cmd === 'list') { list(); } else if (cmd === 'add') { if (!args[1]) { usage(1); } add(args[1]); } else if (cmd === 'new-category') { newCategory(args[1], args[2], args[3], args[4]); } else if (cmd === 'format') { format(); } else { usage(cmd ? 1 : 0); }
}

module.exports = { serializeFile: serializeFile, serializeManifest: serializeManifest, nextId: nextId };
