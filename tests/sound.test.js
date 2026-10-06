/* Tests for src/sound.js and src/settings.js. Sound must be a harmless no-op where
 * WebAudio is missing (like Node), and the music patterns must be well-formed. */
(function (root) {
  'use strict';
  var inNode = typeof module === 'object' && module.exports;
  var T = inNode ? require('./harness') : root.T;
  var Sound = inNode ? require('../src/sound') : root.CQ.Sound;
  var Settings = inNode ? require('../src/settings') : root.CQ.Settings;
  var test = T.test, eq = T.eq, ok = T.ok;

  test('sound: every call is safe without WebAudio or before a key press', function () {
    if (!inNode) { return; } // a browser has WebAudio, so this only applies in Node
    Sound.configure({ sfx: true, music: 'high' });
    Sound.SFX_NAMES.forEach(function (n) { Sound.play(n); });
    Sound.play('no-such-sound');
    Sound.unlock();
    Sound.duck(true);
    Sound.duck(false);
    Sound.setMusic('off');
    Sound.suspend();
    Sound.resume();
    ok(!Sound.isMusicPlaying());
  });

  test('sound: the effects the screens use all exist', function () {
    ['move', 'select', 'back', 'type', 'delete', 'toggle', 'open', 'error', 'start', 'pass',
      'lock', 'tick', 'correct', 'wrong', 'win', 'tie'].forEach(function (n) {
      ok(Sound.SFX_NAMES.indexOf(n) >= 0, n);
    });
  });

  test('sound: music patterns are 16 steps and every chord is defined', function () {
    for (var name in Sound.PATTERNS) { eq(Sound.PATTERNS[name].length, 16, name); }
    Sound.PROGRESSION.forEach(function (c) { ok(Sound.CHORDS[c], c); });
  });

  test('sound: music levels go from silent to loud', function () {
    var L = Sound.MUSIC_LEVELS;
    ok(L.off === 0 && L.low > 0 && L.medium > L.low && L.high > L.medium);
  });

  test('settings: fresh install gets sound and music on', function () {
    var s = Settings.migrate(null);
    eq(s.sound, true);
    eq(s.music, 'medium');
    eq(s.rounds, 10);
    eq(s.version, Settings.VERSION);
  });

  test('settings: settings saved by version 1 keep their choices but get sound switched on', function () {
    var s = Settings.migrate({ sound: false, timerSeconds: 30, rounds: 5 });
    eq(s.sound, true, 'v1 had sound off only because it was the default');
    eq(s.music, 'medium');
    eq(s.timerSeconds, 30);
    eq(s.rounds, 5);
  });

  test('settings: choices saved by version 2 are respected', function () {
    var s = Settings.migrate({ version: 2, sound: false, music: 'off' });
    eq(s.sound, false);
    eq(s.music, 'off');
  });
})(this);
