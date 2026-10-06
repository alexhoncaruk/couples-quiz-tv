/* Node-only: keep the code runnable on old TV browsers.
 * Fails on syntax and APIs newer than what old Chromium-based TV browsers support,
 * and on CSS features without wide support. A crude scan (comments and strings are
 * stripped first), but it catches the usual slips. */
(function () {
  'use strict';
  if (typeof module !== 'object' || !module.exports) { return; }
  var fs = require('fs');
  var path = require('path');
  var T = require('./harness');
  var ROOT = path.join(__dirname, '..');

  function files(dir, ext) {
    var out = [];
    fs.readdirSync(dir).forEach(function (f) {
      var p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) { out = out.concat(files(p, ext)); } else if (path.extname(p) === ext) { out.push(p); }
    });
    return out;
  }

  function stripJs(src) {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
      .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
  }

  var JS_RULES = [
    [/\?\.[A-Za-z_$\[(]/, 'optional chaining ?.'],
    [/\?\?/, 'nullish coalescing ??'],
    [/`/, 'template literals (keep to ES5 strings)'],
    [/=>/, 'arrow functions (keep to ES5 functions)'],
    [/\b(let|const|class)\s/, 'let/const/class (keep to ES5)'],
    [/\basync\s+function|\bawait\s/, 'async/await'],
    [/\{\s*\.\.\.|,\s*\.\.\./, 'spread / rest syntax'],
    [/catch\s*\{/, 'optional catch binding'],
    [/^\s*(import|export)\s/m, 'ES modules'],
    [/\bimport\s*\(/, 'dynamic import'],
    [/\.(flat|flatMap|replaceAll|at|findLast)\(/, 'newer array/string methods'],
    [/\b(fetch|Object\.fromEntries|Object\.entries|Object\.values|Array\.from|Array\.prototype\.includes)\b/, 'APIs missing on old browsers'],
    [/\.includes\(/, '.includes() (use indexOf)'],
    [/\.padStart\(|\.padEnd\(/, 'padStart/padEnd']
  ];

  var CSS_RULES = [
    [/(^|[;{\s])gap\s*:/m, 'gap (flex gap needs Chrome 84)'],
    [/(^|[;{\s])inset\s*:/m, 'inset shorthand'],
    [/aspect-ratio/, 'aspect-ratio'],
    [/:(is|where|has)\(/, ':is/:where/:has'],
    [/\bclamp\(|\bmin\(|\bmax\(/, 'CSS min/max/clamp'],
    [/display\s*:\s*grid/, 'CSS grid'],
    [/var\(--/, 'CSS variables']
  ];

  files(path.join(ROOT, 'src'), '.js').forEach(function (file) {
    T.test('compat: ' + path.relative(ROOT, file) + ' uses only old-browser-safe JS', function () {
      var src = stripJs(fs.readFileSync(file, 'utf8'));
      JS_RULES.forEach(function (rule) {
        T.ok(!rule[0].test(src), rule[1] + ' found in ' + path.relative(ROOT, file));
      });
    });
  });

  files(path.join(ROOT, 'styles'), '.css').forEach(function (file) {
    T.test('compat: ' + path.relative(ROOT, file) + ' uses only widely supported CSS', function () {
      var css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      CSS_RULES.forEach(function (rule) {
        T.ok(!rule[0].test(css), rule[1] + ' found in ' + path.relative(ROOT, file));
      });
    });
  });

  T.test('compat: every script index.html loads exists', function () {
    var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    var re = /<script src="([^"]+)"/g;
    var m;
    while ((m = re.exec(html))) { T.ok(fs.existsSync(path.join(ROOT, m[1])), m[1] + ' is missing'); }
  });

  T.test('compat: index.html loads every src file, with no type="module"', function () {
    var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    T.ok(html.indexOf('type="module"') < 0, 'no ES modules');
    files(path.join(ROOT, 'src'), '.js').forEach(function (file) {
      var rel = path.relative(ROOT, file).split(path.sep).join('/');
      T.ok(html.indexOf('src="' + rel + '"') >= 0, rel + ' is not loaded by index.html');
    });
  });
})();
