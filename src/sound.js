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
  var LOOKAHEAD = 0.3; // seconds of music scheduled ahead (live fallback only)
  var LOOP_RATE = 24000; // sample rate of the pre-rendered music loop

  var ctx = null;
  var master = null;
  var sfxBus = null;
  var musicBus = null;
  var noiseBuf = null;
  var state = { sfx: true, music: 'medium', musicOn: true, ducked: false, unlocked: false };
  // The music loop is rendered once into an AudioBuffer and played on repeat. That needs
  // no timers while playing, so a busy TV can't make it stutter, slow down or stop.
  // Browsers without OfflineAudioContext fall back to scheduling notes live.
  var music = { playing: false, step: 0, bar: 0, next: 0, timer: null, source: null, buffer: null, rendering: false };
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
    cheer: function (t) { // applause: lots of short random claps that swell and fade
      for (var i = 0; i < 90; i++) {
        var at = Math.pow(Math.random(), 1.4) * 2.6;
        var loud = 0.12 + 0.22 * Math.random() * (1 - at / 3);
        noise(t + at, 0.02 + Math.random() * 0.03, loud, sfxBus, 'bandpass', 1200 + Math.random() * 2200, 1.2);
      }
    },
    horn: function (t) { // party horn
      var f = lowpass(1800, sfxBus);
      tone('sawtooth', 380, t, 0.12, 0.12, f, 520);
      tone('sawtooth', 520, t + 0.13, 0.45, 0.14, f, 760);
    },
    celebrate: function (t) { // winner: fanfare, party horns and applause
      SFX.win(t);
      SFX.horn(t + 0.55);
      SFX.cheer(t + 0.7);
      SFX.horn(t + 1.5);
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

  /* Live fallback: schedule the next notes a little ahead. If the timer was held up
   * (a busy TV), skip the missed notes instead of firing them all at once. */
  function schedule() {
    if (!ctx) { return; }
    if (music.next < ctx.currentTime - 0.05) { music.next = ctx.currentTime + 0.05; }
    while (music.next < ctx.currentTime + LOOKAHEAD) {
      playStep(music.step, music.bar, music.next);
      music.next += STEP;
      music.step++;
      if (music.step === 16) { music.step = 0; music.bar++; }
    }
  }

  /* Render the 8-bar loop into a buffer, offline and off the main thread. Half a second
   * of extra tail is rendered and added back onto the start, so notes ringing over the
   * loop point are kept and the loop joins seamlessly. Needs no live AudioContext, so it
   * can start as soon as the page loads. Calls done(buffer) or done(null). */
  var TAIL = 0.5;
  function renderLoop(done) {
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OAC) { done(null); return; }
    var loopSteps = PROGRESSION.length * 16;
    var loopFrames = Math.round(loopSteps * STEP * LOOP_RATE);
    var tailFrames = Math.round(TAIL * LOOP_RATE);
    var oc;
    try { oc = new OAC(1, loopFrames + tailFrames, LOOP_RATE); } catch (e) { done(null); return; }

    // Point the note functions at the offline context for a moment (synchronously).
    var saved = { ctx: ctx, musicBus: musicBus, noiseBuf: noiseBuf };
    try {
      ctx = oc;
      musicBus = oc.createGain();
      musicBus.connect(oc.destination);
      noiseBuf = oc.createBuffer(1, LOOP_RATE, LOOP_RATE);
      var nd = noiseBuf.getChannelData(0);
      for (var i = 0; i < nd.length; i++) { nd[i] = Math.random() * 2 - 1; }
      for (var s = 0; s < loopSteps; s++) { playStep(s % 16, Math.floor(s / 16), s * STEP); }
    } catch (e2) {
      oc = null;
    }
    ctx = saved.ctx;
    musicBus = saved.musicBus;
    noiseBuf = saved.noiseBuf;
    if (!oc) { done(null); return; }

    var finished = false;
    function finish(rendered) {
      if (finished) { return; }
      finished = true;
      try {
        var out = oc.createBuffer(1, loopFrames, LOOP_RATE);
        var src = rendered.getChannelData(0);
        var dst = out.getChannelData(0);
        for (var j = 0; j < loopFrames; j++) { dst[j] = src[j] + (j < tailFrames ? src[loopFrames + j] : 0); }
        done(out);
      } catch (e3) { done(null); }
    }
    function fail() {
      if (!finished) { finished = true; done(null); }
    }
    oc.oncomplete = function (ev) { finish(ev.renderedBuffer); };
    try {
      var p = oc.startRendering();
      if (p && p.then) { p.then(finish, fail); }
    } catch (e4) { fail(); }
  }

  /* Start rendering the loop early (page load); music plays from it once ready. */
  function prepareLoop() {
    if (music.buffer || music.rendering || music.failed) { return; }
    music.rendering = true;
    renderLoop(function (buffer) {
      music.rendering = false;
      music.buffer = buffer;
      if (!buffer) { music.failed = true; return; }
      // If the live fallback was filling in while rendering, switch over now.
      if (music.playing && !music.source && ctx) {
        if (music.timer) { root.clearInterval(music.timer); music.timer = null; }
        playLoop();
      }
    });
  }

  function playLoop() {
    var src = ctx.createBufferSource();
    src.buffer = music.buffer;
    src.loop = true;
    src.connect(musicBus);
    src.start(0);
    music.source = src;
  }

  function musicWanted() {
    return state.musicOn && MUSIC_LEVELS[state.music] > 0;
  }

  function musicGain() {
    return musicWanted() ? MUSIC_LEVELS[state.music] * (state.ducked ? DUCK : 1) : 0;
  }

  function fadeMusic() {
    if (!ctx) { return; }
    musicBus.gain.setTargetAtTime(musicGain(), ctx.currentTime, 0.25);
  }

  function startLive() {
    music.step = 0;
    music.bar = 0;
    music.next = ctx.currentTime + 0.1;
    music.timer = root.setInterval(schedule, 50);
  }

  function startMusic() {
    if (music.playing || !ctx || !musicWanted()) { return; }
    music.playing = true;
    fadeMusic();
    if (music.buffer) { playLoop(); return; }
    // Not rendered yet (or can't be): play live notes meanwhile.
    startLive();
    prepareLoop();
  }

  function stopMusic() {
    if (music.timer) { root.clearInterval(music.timer); }
    music.timer = null;
    if (music.source) {
      try { music.source.stop(0); } catch (e) { /* already stopped */ }
      music.source.disconnect();
      music.source = null;
    }
    music.playing = false;
    if (ctx) { musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.1); }
  }

  /* Some TVs pause web audio on their own (another app grabbing sound, a screensaver).
   * Every few seconds, wake it up again if the game is on screen. */
  var watchdog = null;
  function startWatchdog() {
    if (watchdog || !root.setInterval) { return; }
    watchdog = root.setInterval(function () {
      var hidden = root.document && root.document.hidden;
      if (ctx && state.unlocked && !hidden && ctx.state === 'suspended' && ctx.resume) { ctx.resume(); }
    }, 4000);
  }

  /* ---------- Public API ---------- */

  var Sound = {
    MUSIC_LEVELS: MUSIC_LEVELS,
    PATTERNS: PATTERNS,
    PROGRESSION: PROGRESSION,
    CHORDS: CHORDS,
    SFX_NAMES: Object.keys(SFX),

    /* opts: { sfx: bool, musicOn: bool, music: 'low' | 'medium' | 'high' } */
    configure: function (opts) {
      if (opts.hasOwnProperty('sfx')) { state.sfx = !!opts.sfx; }
      if (opts.hasOwnProperty('musicOn')) { state.musicOn = !!opts.musicOn; }
      if (opts.hasOwnProperty('music')) { Sound.setMusic(opts.music); }
    },

    /* Start right away where the browser allows audio without a key press
     * (Android TV WebViews usually do). Otherwise the first key press starts it. */
    tryAutostart: function () {
      var ac = audio();
      if (ac && ac.state === 'running') {
        state.unlocked = true;
        startWatchdog();
        startMusic();
      }
    },

    /* Call on every key press: creates/resumes the audio and starts the music. */
    unlock: function () {
      var ac = audio();
      if (!ac) { return; }
      if (ac.state === 'suspended' && ac.resume) { ac.resume(); }
      state.unlocked = true;
      startWatchdog();
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
      Sound.setMusicOn(state.musicOn);
    },

    setMusicOn: function (on) {
      state.musicOn = !!on;
      if (!musicWanted()) { stopMusic(); return; }
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

    /* Render the music loop in the background; call once at startup. */
    prepare: function () { prepareLoop(); },

    isMusicPlaying: function () { return music.playing; },
    /* 'loop' (pre-rendered), 'live' (fallback), 'rendering' or 'off', for tests and debugging. */
    musicMode: function () {
      if (!music.playing) { return 'off'; }
      if (music.source) { return 'loop'; }
      if (music.timer) { return 'live'; }
      return 'rendering';
    },

    /* For testing: render into a given (offline) AudioContext. */
    _attach: function (ac) {
      build(ac);
      state.unlocked = true;
    },
    _playStep: function (step, bar, t) { playStep(step, bar, t); },
    _sfxAt: function (name, t) { SFX[name](t); },
    _setMusicGain: function (v) { musicBus.gain.value = v; },
    _loopBuffer: function () { return music.buffer; },
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
