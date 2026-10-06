/* Couples Quiz TV - key debug overlay.
 * Toggle with "d" or Up x5. Shows exactly what the remote sends (key, code, keyCode)
 * and what the game made of it, plus the screen size the TV browser reports. */
(function (root) {
  'use strict';
  var CQ = root.CQ;
  var MAX_LINES = 7;

  function describe(info) {
    if (info.type === 'popstate') { return 'popstate (browser Back)   -> back'; }
    return 'key=' + JSON.stringify(info.key === undefined ? null : info.key) +
      ' code=' + JSON.stringify(info.code === undefined ? null : info.code) +
      ' keyCode=' + info.keyCode +
      '   -> ' + (info.action || 'ignored') +
      (info.repeat ? ' (repeat)' : '');
  }

  function DebugOverlay(el, app) {
    this.el = el;
    this.app = app;
    this.visible = false;
    this.lines = [];
    this.last = null;
  }

  DebugOverlay.prototype.record = function (info) {
    this.last = info;
    this.lines.unshift(describe(info));
    if (this.lines.length > MAX_LINES) { this.lines.length = MAX_LINES; }
    if (this.visible) { this.render(); }
  };

  DebugOverlay.prototype.setVisible = function (on) {
    this.visible = !!on;
    this.el.style.display = this.visible ? 'block' : 'none';
    if (this.visible) { this.render(); }
  };

  DebugOverlay.prototype.toggle = function () {
    this.setVisible(!this.visible);
  };

  DebugOverlay.prototype.render = function () {
    var h = CQ.UI.h;
    var w = root.innerWidth, hgt = root.innerHeight;
    var big = 'Press a key on the remote';
    if (this.last) {
      big = this.last.type === 'popstate' ? 'Browser Back (popstate)'
        : 'keyCode ' + this.last.keyCode + '  key "' + this.last.key + '"';
    }
    CQ.UI.clear(this.el);
    this.el.appendChild(h('div', null, 'KEY DEBUG  (d or Up x5 to close)'));
    this.el.appendChild(h('div', { class: 'debug-big' }, big));
    this.el.appendChild(h('div', null, this.lines.join('\n') || '-'));
    var errors = root.CQ_ERRORS || [];
    if (errors.length) {
      this.el.appendChild(h('div', { class: 'bad' }, 'errors: ' + errors.slice(-3).join(' | ')));
    }
    this.el.appendChild(h('div', { class: 'small' },
      'inner ' + w + 'x' + hgt +
      '  client ' + root.document.documentElement.clientWidth + 'x' + root.document.documentElement.clientHeight +
      (root.visualViewport ? '  visual ' + Math.round(root.visualViewport.width) + 'x' + Math.round(root.visualViewport.height) : '') +
      '  dpr ' + (root.devicePixelRatio || 1) +
      '  scale ' + (this.app.scale ? this.app.scale.toFixed(2) : '?') +
      '  screen ' + (this.app.router && this.app.router.name) + '\n' +
      (root.navigator ? root.navigator.userAgent : '')));
  };

  CQ.DebugOverlay = DebugOverlay;
  CQ.DebugOverlay.describe = describe;
})(this);
