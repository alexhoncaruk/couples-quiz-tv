#!/usr/bin/env node
/* Runs every test file with plain Node, no dependencies: node tests/run.js */
'use strict';

var fs = require('fs');
var path = require('path');
var T = require('./harness');

fs.readdirSync(__dirname)
  .filter(function (f) { return /\.test\.js$/.test(f); })
  .sort()
  .forEach(function (f) { require(path.join(__dirname, f)); });

var result = T.run(function (passed, name, err) {
  if (passed) {
    console.log('  ok   ' + name);
  } else {
    console.log('  FAIL ' + name + '\n       ' + (err && err.message));
  }
});

console.log('\n' + result.passed + ' passed, ' + result.failed + ' failed');
process.exit(result.failed ? 1 : 0);
