/* Couples Quiz TV - localStorage wrapper.
 * Values are stored as JSON under "cq." keys. If storage is blocked (some TV browsers
 * in private mode), it quietly falls back to memory for this visit. */
(function (root) {
  'use strict';
  var PREFIX = 'cq.';
  var memory = {};

  function backend() {
    try {
      var ls = root.localStorage;
      if (!ls) { return null; }
      ls.setItem(PREFIX + 'probe', '1');
      ls.removeItem(PREFIX + 'probe');
      return ls;
    } catch (e) {
      return null;
    }
  }

  var ls = backend();

  function get(key, fallback) {
    var raw = null;
    try {
      raw = ls ? ls.getItem(PREFIX + key) : (memory.hasOwnProperty(key) ? memory[key] : null);
    } catch (e) { raw = null; }
    if (raw === null || raw === undefined) { return fallback; }
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function set(key, value) {
    var raw = JSON.stringify(value);
    try {
      if (ls) { ls.setItem(PREFIX + key, raw); } else { memory[key] = raw; }
    } catch (e) { memory[key] = raw; }
  }

  function remove(key) {
    try { if (ls) { ls.removeItem(PREFIX + key); } } catch (e) { /* ignore */ }
    delete memory[key];
  }

  /* Remove everything this game saved (names, settings, records, seen questions). */
  function clearAll() {
    memory = {};
    if (!ls) { return; }
    try {
      var keys = [];
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && k.indexOf(PREFIX) === 0) { keys.push(k); }
      }
      for (var j = 0; j < keys.length; j++) { ls.removeItem(keys[j]); }
    } catch (e) { /* ignore */ }
  }

  root.CQ = root.CQ || {};
  root.CQ.Storage = { get: get, set: set, remove: remove, clearAll: clearAll, persistent: !!ls };
})(this);
