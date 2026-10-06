/* Couples Quiz TV - settings defaults and upgrades of settings saved by older versions.
 * Pure logic: browser global CQ.Settings, Node module for tests. */
(function (root) {
  'use strict';

  var VERSION = 3;

  var DEFAULTS = {
    version: VERSION,
    sound: true,
    musicOn: true,
    music: 'medium',
    screenFit: 100,
    timerTrivia: true,
    timerKnowMe: false,
    timerSeconds: 20,
    rounds: 10,
    debug: false,
    historyTrap: true
  };

  var MUSIC_VOLUMES = { low: true, medium: true, high: true };

  /* Saved settings + defaults for anything missing. Sound effects and music are switched
   * on once when upgrading from version 1 (sound off by default) or 2 (music volume
   * could be "off"; muting is now a separate on/off). */
  function migrate(saved) {
    var s = {};
    for (var k in DEFAULTS) {
      if (DEFAULTS.hasOwnProperty(k)) { s[k] = saved && saved.hasOwnProperty(k) ? saved[k] : DEFAULTS[k]; }
    }
    if (!saved || !(saved.version >= 3)) {
      s.sound = true;
      s.musicOn = true;
    }
    if (!MUSIC_VOLUMES[s.music]) { s.music = 'medium'; }
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
