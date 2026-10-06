/* Couples Quiz TV - the one keyboard controller.
 *
 * Turns raw key events from the remote into a handful of actions:
 *   up, down, left, right, enter, back, debug
 * and hands them to a single handler (the router). Nothing else in the app listens
 * to the keyboard, so the browser's own tab order and scrolling never get involved.
 *
 * Remotes and TV browsers disagree on what they send, so both the modern `key` names
 * and the old numeric keyCodes are mapped. The Back button is the tricky one: many
 * Android TV browsers use it for "history back" before the page sees a key. To catch
 * that too, the controller can keep an extra history entry (the "history trap") and
 * treat the resulting popstate as Back.
 *
 * Browser global CQ.Input, Node module for tests. */
(function (root) {
  'use strict';

  var KEY_NAMES = {
    ArrowUp: 'up', Up: 'up',
    ArrowDown: 'down', Down: 'down',
    ArrowLeft: 'left', Left: 'left',
    ArrowRight: 'right', Right: 'right',
    Enter: 'enter', Select: 'enter', Accept: 'enter',
    Escape: 'back', Esc: 'back', Backspace: 'back', BrowserBack: 'back', GoBack: 'back', Back: 'back',
    d: 'debug', D: 'debug'
  };

  var KEY_CODES = {
    38: 'up', 40: 'down', 37: 'left', 39: 'right',
    13: 'enter',
    23: 'enter', // Android KEYCODE_DPAD_CENTER, sent by some WebViews
    27: 'back', // Escape
    8: 'back', // Backspace
    166: 'back', // BrowserBack
    4: 'back', // Android KEYCODE_BACK, sent by some WebViews
    461: 'back', // LG webOS
    10009: 'back', // Samsung Tizen
    68: 'debug' // "d"
  };

  var UP_COMBO_COUNT = 5;
  var UP_COMBO_MS = 2500;
  var BACK_DEDUPE_MS = 600;

  /* Map a keyboard event (or anything with key / keyCode / which) to an action or null. */
  function normalize(e) {
    if (!e) { return null; }
    if (typeof e.key === 'string' && KEY_NAMES.hasOwnProperty(e.key)) { return KEY_NAMES[e.key]; }
    var code = e.keyCode || e.which || 0;
    if (KEY_CODES.hasOwnProperty(code)) { return KEY_CODES[code]; }
    return null;
  }

  function Controller() {
    this.handler = null;
    this.rawListeners = [];
    this.upTimes = [];
    this.lastBackAt = -Infinity;
    this.win = null;
    this.trapEnabled = false;
    this.trapDepth = 0;
    this.gestureArmed = false;
  }

  /* Start listening on a window/document pair. */
  Controller.prototype.attach = function (win, doc) {
    var self = this;
    this.win = win;
    doc.addEventListener('keydown', function (e) { self.onKeyDown(e); }, true);
    win.addEventListener('popstate', function (e) { self.onPopState(e); });
  };

  /* handler(action, info) receives every action. */
  Controller.prototype.setHandler = function (fn) {
    this.handler = fn;
  };

  /* Listen to every raw event (used by the debug overlay and the remote check).
   * Returns a function that removes the listener. */
  Controller.prototype.onRaw = function (fn) {
    var list = this.rawListeners;
    list.push(fn);
    return function () {
      var i = list.indexOf(fn);
      if (i >= 0) { list.splice(i, 1); }
    };
  };

  Controller.prototype.emitRaw = function (info) {
    for (var i = 0; i < this.rawListeners.length; i++) {
      try { this.rawListeners[i](info); } catch (err) { /* a broken listener must not block input */ }
    }
  };

  Controller.prototype.dispatch = function (action, info) {
    if (this.handler) { this.handler(action, info); }
  };

  Controller.prototype.onKeyDown = function (e, now) {
    now = typeof now === 'number' ? now : Date.now();
    // A key press counts as a user gesture, which browsers require before a history
    // entry is allowed to catch the Back button.
    this.armTrap(true);

    var action = normalize(e);
    var info = {
      type: 'keydown',
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      which: e.which,
      repeat: !!e.repeat,
      action: action,
      time: now
    };

    // Up pressed 5 times in a row (within 2.5 s) toggles the debug overlay, for
    // remotes that have no "d" key.
    var combo = false;
    if (action === 'up' && !e.repeat) {
      this.upTimes.push(now);
      while (this.upTimes.length && now - this.upTimes[0] > UP_COMBO_MS) { this.upTimes.shift(); }
      if (this.upTimes.length >= UP_COMBO_COUNT) {
        this.upTimes = [];
        combo = true;
      }
    } else if (action && action !== 'up') {
      this.upTimes = [];
    }

    this.emitRaw(info);
    if (!action) { return; }
    if (e.preventDefault) { e.preventDefault(); }
    if (action === 'back') { this.lastBackAt = now; }
    // Holding OK or Back must not fire it again and again.
    if (e.repeat && (action === 'enter' || action === 'back' || action === 'debug')) { return; }

    this.dispatch(action, info);
    if (combo) { this.dispatch('debug', info); }
  };

  Controller.prototype.onPopState = function (e, now) {
    if (!this.trapEnabled || this.trapDepth <= 0) { return; }
    now = typeof now === 'number' ? now : Date.now();
    this.trapDepth--;
    this.gestureArmed = false;
    this.armTrap(false);
    var info = { type: 'popstate', action: 'back', time: now };
    this.emitRaw(info);
    // The same Back press may already have arrived as a key event.
    if (now - this.lastBackAt < BACK_DEDUPE_MS) { return; }
    this.lastBackAt = now;
    this.dispatch('back', info);
  };

  Controller.prototype.setTrap = function (enabled) {
    this.trapEnabled = !!enabled;
  };

  Controller.prototype.armTrap = function (withGesture) {
    if (!this.trapEnabled) { return; }
    if (withGesture && this.gestureArmed) { return; }
    var h = this.win && this.win.history;
    if (!h || !h.pushState) { return; }
    try {
      h.pushState({ cqTrap: Date.now() }, '');
      this.trapDepth++;
      if (withGesture) { this.gestureArmed = true; }
    } catch (err) { /* some browsers limit pushState; Back keys still work */ }
  };

  var Input = {
    normalize: normalize,
    Controller: Controller,
    KEY_NAMES: KEY_NAMES,
    KEY_CODES: KEY_CODES
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = Input;
  } else {
    root.CQ = root.CQ || {};
    root.CQ.Input = Input;
  }
})(this);
