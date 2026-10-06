/* Couples Quiz TV - screen state machine and focus manager.
 *
 * Screens are states. Only the transitions listed in TRANSITIONS are allowed, so a
 * stray key press can never jump somewhere that makes no sense (like from the title
 * straight to a reveal).
 *
 * A screen is { hints: [[key, text]...], mount(el, params, ctx) } and mount returns an
 * optional instance { back(), key(action) -> true if handled, pause(), resume(), unmount() }.
 * Screens call ctx.setGrid(rows) to say what can be focused; the router moves the focus
 * ring with the arrows (via CQ.Nav) and calls item.onSelect on Enter. */
(function (root) {
  'use strict';

  var TRANSITIONS = {
    title: ['setup', 'settings', 'howto'],
    settings: ['title', 'remote'],
    remote: ['settings'],
    howto: ['title'],
    setup: ['title', 'names', 'category'],
    names: ['setup'],
    category: ['setup', 'interstitial', 'title'],
    interstitial: ['question', 'results', 'title'],
    question: ['reveal', 'interstitial', 'title'],
    reveal: ['interstitial', 'results', 'title'],
    results: ['interstitial', 'category', 'title']
  };

  /* Ignore Enter this long after a screen change, so one press (or a bouncy remote)
   * can't also pick the first answer on the next screen. */
  var ENTER_LOCK_MS = 300;

  function canGo(from, to) {
    if (!TRANSITIONS.hasOwnProperty(to)) { return false; }
    if (from === null || from === undefined || from === to) { return true; }
    return !!TRANSITIONS[from] && TRANSITIONS[from].indexOf(to) >= 0;
  }

  function Router(opts) {
    this.app = opts.app;
    this.screenEl = opts.screenEl;
    this.hintsEl = opts.hintsEl;
    this.modalEl = opts.modalEl;
    this.screens = {};
    this.name = null;
    this.def = null;
    this.instance = null;
    this.layer = null; // focus layer of the screen
    this.modal = null; // focus layer of an open confirm dialog
    this.enterLockUntil = 0;
    this.onDebug = null;
  }

  Router.prototype.register = function (name, def) {
    this.screens[name] = def;
  };

  Router.prototype.go = function (name, params) {
    if (!this.screens[name] || !canGo(this.name, name)) {
      if (root.console) { root.console.warn('Blocked screen change ' + this.name + ' -> ' + name); }
      return false;
    }
    if (this.instance && this.instance.unmount) { this.instance.unmount(); }
    this.closeModal();
    CQ.UI.clear(this.screenEl);
    this.layer = null;
    this.name = name;
    this.def = this.screens[name];
    this.enterLockUntil = Date.now() + ENTER_LOCK_MS;

    var el = root.document.createElement('div');
    el.className = 'screen screen-' + name;
    this.screenEl.appendChild(el);
    this.setHints(this.def.hints);
    this.instance = this.def.mount(el, params || {}, this.makeContext()) || {};
    return true;
  };

  Router.prototype.makeContext = function () {
    var self = this;
    return {
      app: self.app,
      go: function (name, params) { return self.go(name, params); },
      setGrid: function (rows, opts) { self.setGrid(rows, opts); },
      focus: function (item) { self.focusItem(item); },
      current: function () { return self.currentItem(self.layer); },
      setHints: function (hints) { self.setHints(hints); },
      confirm: function (opts, onYes, onNo) { self.confirm(opts, onYes, onNo); },
      toast: function (msg, ms) { CQ.UI.toast(msg, ms); }
    };
  };

  Router.prototype.setHints = function (hints) {
    CQ.UI.renderHints(this.hintsEl, hints);
  };

  /* rows: [[{ el, onSelect, x, w, disabled }, ...], ...]
   * opts: { wrapX, wrapY, focus: item to focus first } */
  Router.prototype.setGrid = function (rows, opts) {
    opts = opts || {};
    var old = this.layer;
    this.layer = { rows: rows, pos: null, opts: opts };
    if (old) { this.paint(old, null); }
    var pos = null;
    if (opts.focus) { pos = CQ.Nav.find(rows, function (it) { return it === opts.focus; }); }
    this.paint(this.layer, pos || CQ.Nav.first(rows));
  };

  Router.prototype.focusItem = function (item) {
    if (!this.layer) { return; }
    var pos = CQ.Nav.find(this.layer.rows, function (it) { return it === item; });
    if (pos) { this.paint(this.layer, pos); }
  };

  Router.prototype.currentItem = function (layer) {
    if (!layer || !layer.pos) { return null; }
    return layer.rows[layer.pos.row][layer.pos.col] || null;
  };

  /* Move the focus ring inside a layer. */
  Router.prototype.paint = function (layer, pos) {
    var before = this.currentItem(layer);
    if (before && before.el) { before.el.className = before.el.className.replace(/(^|\s)focused(?=\s|$)/g, ''); }
    layer.pos = pos;
    var now = this.currentItem(layer);
    if (now && now.el) { now.el.className += ' focused'; }
    if (now && now.onFocus) { now.onFocus(now); }
  };

  Router.prototype.handle = function (action) {
    if (action === 'debug') {
      if (this.onDebug) { this.onDebug(); }
      return;
    }
    if (action === 'enter' && Date.now() < this.enterLockUntil) { return; }

    if (this.modal) {
      if (action === 'back') { this.answerModal(false); } else { this.navigate(this.modal, action); }
      return;
    }
    var inst = this.instance || {};
    if (inst.key && inst.key(action) === true) { return; }
    if (action === 'back') {
      if (inst.back) { inst.back(); }
      return;
    }
    if (this.layer) { this.navigate(this.layer, action); }
  };

  Router.prototype.navigate = function (layer, action) {
    if (action === 'enter') {
      var item = this.currentItem(layer);
      if (item && item.onSelect) { item.onSelect(item); }
      return;
    }
    var next = CQ.Nav.move(layer.rows, layer.pos, action, layer.opts);
    if (next && !CQ.Nav.same(next, layer.pos)) { this.paint(layer, next); } else if (next) { layer.pos = next; }
  };

  /* A two-button dialog. Back or the "no" button closes it. */
  Router.prototype.confirm = function (opts, onYes, onNo) {
    var h = CQ.UI.h;
    var self = this;
    if (this.instance && this.instance.pause) { this.instance.pause(); }
    var no = CQ.UI.button(opts.no || 'Cancel');
    var yes = CQ.UI.button(opts.yes || 'OK', 'danger');
    var box = h('div', { class: 'backdrop' }, h('div', { class: 'modal-box' }, [
      h('div', { class: 'h2' }, opts.title),
      opts.message ? h('div', { class: 'sub' }, opts.message) : null,
      h('div', { class: 'btn-row' }, [no, yes])
    ]));
    CQ.UI.clear(this.modalEl);
    this.modalEl.appendChild(box);
    var noItem = { el: no, onSelect: function () { self.answerModal(false); } };
    var yesItem = { el: yes, onSelect: function () { self.answerModal(true); } };
    this.modal = { rows: [[noItem, yesItem]], pos: null, opts: {}, onYes: onYes, onNo: onNo };
    this.paint(this.modal, { row: 0, col: 0 });
    this.enterLockUntil = Date.now() + ENTER_LOCK_MS;
  };

  Router.prototype.answerModal = function (yes) {
    var modal = this.modal;
    this.closeModal();
    if (!modal) { return; }
    if (yes) {
      if (modal.onYes) { modal.onYes(); }
    } else {
      if (this.instance && this.instance.resume) { this.instance.resume(); }
      if (modal.onNo) { modal.onNo(); }
    }
  };

  Router.prototype.closeModal = function () {
    this.modal = null;
    if (this.modalEl) { CQ.UI.clear(this.modalEl); }
  };

  var CQ = root.CQ || {};
  var api = { TRANSITIONS: TRANSITIONS, canGo: canGo, Router: Router };

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CQ = CQ;
    CQ.Router = Router;
    CQ.Router.canGo = canGo;
    CQ.Router.TRANSITIONS = TRANSITIONS;
  }
})(this);
