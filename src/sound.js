/* Couples Quiz TV - sound effects and background music, all synthesized with WebAudio.
 * There are no audio files: every sound is built from oscillators and noise, so nothing
 * has to download on the TV and there are no copyright issues.
 *
 * Browsers only allow audio after a user gesture, so main.js calls Sound.unlock() on
 * every key press; the music starts on the first one. Everything quietly does nothing
 * where WebAudio is missing (and in Node, where the tests load this file). */
(function (root) {
  'use strict';

  var MUSIC_LEVELS = { off: 0, low: 0.18, medium: 0.32, high: 0.55 };
  var DUCK = 0.45; // music volume factor while a question is on screen
  var BPM = 104;
  var STEP = 60 / BPM / 4; // one 16th note, in seconds
  var SWING = 0.12; // odd 16ths come a little late, for groove
  var LOOKAHEAD = 0.15; // seconds of music scheduled ahead

  var ctx = null;
  var master = null;
  var sfxBus = null;
  var musicBus = null;
  var noiseBuf = null;
  var state = { sfx: true, music: 'medium', ducked: false, unlocked: false };
  var music = { playing: false, step: 0, bar: 0, next: 0, timer: null };
  var lastPlayed = {};

  /* ---------- Audio graph ---------- */

  function build(ac) {
    ctx = ac;
    master = ctx.createGain();
    master.gain.value = 0.9;
    if (ctx.createDynamicsCompressor) {
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 4;
      master.connect(comp);
      comp.connect(ctx.destination);
    } else {
      master.connect(ctx.destination);
    }
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 2;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < data.length; i++) { data[i] = Math.random() * 2 - 1; }
    return ctx;
  }

  function audio() {
    if (ctx) { return ctx; }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) { return null; }
    try { return build(new AC()); } catch (e) { return null; }
  }

  function midi(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  /* Gain envelope: quick attack, exponential decay. */
  function env(gain, t, peak, attack, decay) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /* One oscillator note. freqEnd makes it slide. */
  function tone(type, freq, t, dur, peak, dest, freqEnd) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) { o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur); }
    env(g, t, peak, 0.005, dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /* A burst of filtered noise (drums, clicks). */
  function noise(t, dur, peak, dest, filterType, freq, q) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    if (q) { f.Q.value = q; }
    var g = ctx.createGain();
    env(g, t, peak, 0.002, dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  function lowpass(freq, dest) {
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    f.connect(dest);
    return f;
  }

  /* ---------- Sound effects ---------- */

  var SFX = {
    move: function (t) { tone('sine', 1150, t, 0.035, 0.18, sfxBus); },
    select: function (t) { tone('triangle', 660, t, 0.08, 0.32, sfxBus, 990); },
    back: function (t) { tone('triangle', 620, t, 0.12, 0.3, sfxBus, 310); },
    type: function (t) {
      noise(t, 0.025, 0.4, sfxBus, 'bandpass', 3000, 2);
      tone('square', 1400, t, 0.025, 0.08, sfxBus);
    },
    'delete': function (t) { tone('square', 520, t, 0.07, 0.16, sfxBus, 260); },
    toggle: function (t) {
      tone('triangle', 880, t, 0.05, 0.25, sfxBus);
      tone('triangle', 1320, t + 0.05, 0.07, 0.22, sfxBus);
    },
    open: function (t) { tone('sine', 480, t, 0.14, 0.3, sfxBus, 900); },
    error: function (t) {
      tone('square', 220, t, 0.09, 0.14, sfxBus);
      tone('square', 175, t + 0.12, 0.14, 0.14, sfxBus);
    },
    start: function (t) {
      noise(t, 0.35, 0.18, sfxBus, 'bandpass', 1200, 0.7);
      tone('sine', 260, t, 0.35, 0.3, sfxBus, 1040);
      tone('triangle', 1046.5, t + 0.32, 0.3, 0.25, sfxBus);
    },
    pass: function (t) { // ding-dong
      tone('sine', 783.99, t, 0.6, 0.2, sfxBus);
      tone('sine', 1567.98, t, 0.25, 0.07, sfxBus);
      tone('sine', 622.25, t + 0.22, 0.8, 0.2, sfxBus);
      tone('sine', 1244.5, t + 0.22, 0.3, 0.07, sfxBus);
    },
    lock: function (t) { // ka-chunk
      noise(t, 0.06, 0.45, sfxBus, 'bandpass', 1800, 1);
      tone('square', 180, t, 0.09, 0.18, lowpass(900, sfxBus), 90);
      tone('triangle', 880, t + 0.1, 0.15, 0.25, sfxBus);
    },
    tick: function (t) { tone('sine', 1760, t, 0.05, 0.4, sfxBus); },
    correct: function (t) { // rising arpeggio + sparkle
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
        tone('triangle', f, t + i * 0.07, 0.28, 0.3, sfxBus);
      });
      tone('sine', 2093, t + 0.3, 0.4, 0.1, sfxBus);
    },
    wrong: function (t) { // bwomp bwomp
      var f = lowpass(1100, sfxBus);
      tone('sawtooth', 311.1, t, 0.2, 0.28, f, 293.7);
      tone('sawtooth', 233.1, t + 0.22, 0.45, 0.28, f, 196);
    },
    win: function (t) { // little fanfare, then a big chord
      [392, 523.25, 659.25, 783.99].forEach(function (f, i) {
        tone('square', f, t + i * 0.12, 0.12, 0.08, lowpass(2500, sfxBus));
        tone('triangle', f, t + i * 0.12, 0.15, 0.14, sfxBus);
      });
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f) {
        tone('triangle', f, t + 0.5, 1.2, 0.11, sfxBus);
      });
      noise(t + 0.5, 0.6, 0.12, sfxBus, 'highpass', 6000);
    },
    tie: function (t) {
      [[392, 493.88], [440, 554.37]].forEach(function (pair, i) {
        pair.forEach(function (f) { tone('triangle', f, t + i * 0.3, 0.5, 0.14, sfxBus); });
      });
    }
  };

  /* ---------- Funky background loop ---------- */

  // 8-bar progression in E dorian: Em9 Em9 A13 A13 Em9 Em9 Cmaj7 B7.
  var CHORDS = {
    Em: { root: 40, third: 3, stab: [55, 59, 62, 66] },
    A: { root: 45, third: 4, stab: [55, 59, 61, 66] },
    C: { root: 36, third: 4, stab: [52, 55, 59, 64] },
    B: { root: 35, third: 4, stab: [54, 57, 59, 63] }
  };
  var PROGRESSION = ['Em', 'Em', 'A', 'A', 'Em', 'Em', 'C', 'B'];
  // 16 steps per bar. Bass values are semitones above the root; 'third' follows the chord.
  var PATTERNS = {
    bass: [0, null, null, 12, null, null, 0, null, 'third', null, 5, 7, null, null, 10, 12],
    kick: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.25],
    hat: [0.16, 0.06, 0.16, 0.06, 0.16, 0.06, 0.16, 0.08, 0.16, 0.06, 0.16, 0.06, 0.16, 0.06, 0, 0.06],
    openHat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    stab: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
    fill: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.7, 0.9]
  };

  function kick(t) { tone('sine', 150, t, 0.28, 0.75, musicBus, 45); }

  function snare(t, v) {
    noise(t, 0.16, 0.5 * v, musicBus, 'bandpass', 1800, 0.8);
    tone('triangle', 200, t, 0.08, 0.28 * v, musicBus, 140);
  }

  function hat(t, v, open) {
    noise(t, open ? 0.22 : 0.035, v, musicBus, 'highpass', 7000);
  }

  function bass(t, note) {
    var o = ctx.createOscillator();
    var f = ctx.createBiquadFilter();
    var g = ctx.createGain();
    var dur = STEP * 1.7;
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(midi(note), t);
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(1500, t);
    f.frequency.exponentialRampToValueAtTime(260, t + dur);
    env(g, t, 0.42, 0.005, dur);
    o.connect(f);
    f.connect(g);
    g.connect(musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function stab(t, notes) {
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1400;
    f.Q.value = 0.9;
    f.connect(musicBus);
    for (var i = 0; i < notes.length; i++) { tone('square', midi(notes[i]), t, 0.13, 0.07, f); }
  }

  function playStep(step, bar, t) {
    var chord = CHORDS[PROGRESSION[bar % PROGRESSION.length]];
    var lastBar = bar % PROGRESSION.length === PROGRESSION.length - 1;
    if (step % 2 === 1) { t += STEP * SWING; }
    if (PATTERNS.kick[step]) { kick(t); }
    if (PATTERNS.snare[step]) { snare(t, PATTERNS.snare[step]); }
    if (lastBar && PATTERNS.fill[step]) { snare(t, PATTERNS.fill[step]); }
    if (PATTERNS.openHat[step]) { hat(t, 0.12, true); } else if (PATTERNS.hat[step]) { hat(t, PATTERNS.hat[step], false); }
    var b = PATTERNS.bass[step];
    if (b !== null) { bass(t, chord.root + (b === 'third' ? chord.third : b)); }
    if (PATTERNS.stab[step]) { stab(t, chord.stab); }
  }

  function schedule() {
    if (!ctx) { return; }
    while (music.next < ctx.currentTime + LOOKAHEAD) {
      playStep(music.step, music.bar, music.next);
      music.next += STEP;
      music.step++;
      if (music.step === 16) { music.step = 0; music.bar++; }
    }
  }

  function musicGain() {
    return (MUSIC_LEVELS[state.music] || 0) * (state.ducked ? DUCK : 1);
  }

  function fadeMusic() {
    if (!ctx) { return; }
    musicBus.gain.setTargetAtTime(musicGain(), ctx.currentTime, 0.25);
  }

  function startMusic() {
    if (music.playing || !ctx || !MUSIC_LEVELS[state.music]) { return; }
    music.playing = true;
    music.step = 0;
    music.bar = 0;
    music.next = ctx.currentTime + 0.1;
    music.timer = root.setInterval(schedule, 30);
    fadeMusic();
  }

  function stopMusic() {
    if (music.timer) { root.clearInterval(music.timer); }
    music.timer = null;
    music.playing = false;
    if (ctx) { musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.1); }
  }

  /* ---------- Public API ---------- */

  var Sound = {
    MUSIC_LEVELS: MUSIC_LEVELS,
    PATTERNS: PATTERNS,
    PROGRESSION: PROGRESSION,
    CHORDS: CHORDS,
    SFX_NAMES: Object.keys(SFX),

    /* opts: { sfx: bool, music: 'off' | 'low' | 'medium' | 'high' } */
    configure: function (opts) {
      if (opts.hasOwnProperty('sfx')) { state.sfx = !!opts.sfx; }
      if (opts.hasOwnProperty('music')) { Sound.setMusic(opts.music); }
    },

    /* Call on every key press: creates/resumes the audio and starts the music. */
    unlock: function () {
      var ac = audio();
      if (!ac) { return; }
      if (ac.state === 'suspended' && ac.resume) { ac.resume(); }
      state.unlocked = true;
      startMusic();
    },

    play: function (name) {
      if (!state.sfx || !state.unlocked || !ctx || !SFX[name]) { return; }
      var now = ctx.currentTime;
      // Held arrows repeat fast; don't stack identical sounds on top of each other.
      if (lastPlayed[name] && now - lastPlayed[name] < 0.03) { return; }
      lastPlayed[name] = now;
      try { SFX[name](now + 0.01); } catch (e) { /* never let a sound break the game */ }
    },

    setSfx: function (on) {
      state.sfx = !!on;
    },

    setMusic: function (level) {
      state.music = MUSIC_LEVELS.hasOwnProperty(level) ? level : 'off';
      if (!MUSIC_LEVELS[state.music]) { stopMusic(); return; }
      if (state.unlocked) { startMusic(); }
      fadeMusic();
    },

    /* Turn the music down while a question is on screen. */
    duck: function (on) {
      state.ducked = !!on;
      fadeMusic();
    },

    /* Pause everything while the browser is in the background (Home pressed). */
    suspend: function () {
      if (ctx && ctx.suspend) { ctx.suspend(); }
    },
    resume: function () {
      if (ctx && state.unlocked && ctx.resume) { ctx.resume(); }
    },

    isMusicPlaying: function () { return music.playing; },

    /* For testing: render into a given (offline) AudioContext. */
    _attach: function (ac) {
      build(ac);
      state.unlocked = true;
    },
    _playStep: function (step, bar, t) { playStep(step, bar, t); },
    _sfxAt: function (name, t) { SFX[name](t); },
    _setMusicGain: function (v) { musicBus.gain.value = v; },
    STEP: STEP
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = Sound;
  } else {
    root.CQ = root.CQ || {};
    root.CQ.Sound = Sound;
    if (root.document && root.document.addEventListener) {
      root.document.addEventListener('visibilitychange', function () {
        if (root.document.hidden) { Sound.suspend(); } else { Sound.resume(); }
      });
    }
  }
})(this);
