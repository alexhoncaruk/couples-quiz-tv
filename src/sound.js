/* Couples Quiz TV - optional beeps with WebAudio (off by default, no audio files).
 * Turn on in Settings. Silently does nothing where WebAudio is missing. */
(function (root) {
  'use strict';
  var ctx = null;

  function audio() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) { return null; }
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended' && ctx.resume) { ctx.resume(); }
    return ctx;
  }

  function tone(freq, startIn, duration, type) {
    var ac = audio();
    if (!ac) { return; }
    var t = ac.currentTime + startIn;
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  var Sound = {
    enabled: false,
    correct: function () {
      if (!Sound.enabled) { return; }
      tone(660, 0, 0.15);
      tone(880, 0.12, 0.25);
    },
    wrong: function () {
      if (!Sound.enabled) { return; }
      tone(220, 0, 0.35, 'square');
    },
    tick: function () {
      if (!Sound.enabled) { return; }
      tone(1000, 0, 0.05);
    }
  };

  root.CQ = root.CQ || {};
  root.CQ.Sound = Sound;
})(this);
