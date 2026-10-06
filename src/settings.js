/* Couples Quiz TV - settings defaults and upgrades of settings saved by older versions.
 * Pure logic: browser global CQ.Settings, Node module for tests. */
(function (root) {
  'use strict';

  var VERSION = 2;

  var DEFAULTS = {
    version: VERSION,
    sound: true,
    music: 'medium',
    timerTrivia: true,
    timerKnowMe: false,
    timerSeconds: 20,
    rounds: 10,
    debug: false,
    historyTrap: true
  };

  /* Saved settings + defaults for anything missing. Version 1 had sound off by
   * default and no music, so those two are switched on once when upgrading. */
  function migrate(saved) {
    var s = {};
    for (var k in DEFAULTS) {
      if (DEFAULTS.hasOwnProperty(k)) { s[k] = saved && saved.hasOwnProperty(k) ? saved[k] : DEFAULTS[k]; }
    }
    if (!saved || !(saved.version >= 2)) {
      s.sound = true;
      s.music = 'medium';
    }
    s.version = VERSION;
    return s;
  }

  var Settings = { VERSION: VERSION, DEFAULTS: DEFAULTS, migrate: migrate };

  if (typeof module === 'object' && module.exports) {
    module.exports = Settings;
  } else {
    root.CQ = root.CQ || {};
    root.CQ.Settings = Settings;
  }
})(this);
