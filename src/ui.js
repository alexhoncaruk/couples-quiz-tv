/* Couples Quiz TV - small DOM helpers shared by the screens. */
(function (root) {
  'use strict';
  var CQ = root.CQ;
  var doc = root.document;

  function append(el, children) {
    if (children === null || children === undefined || children === false) { return; }
    if (Object.prototype.toString.call(children) === '[object Array]') {
      for (var i = 0; i < children.length; i++) { append(el, children[i]); }
      return;
    }
    if (typeof children === 'string' || typeof children === 'number') {
      el.appendChild(doc.createTextNode(String(children)));
      return;
    }
    el.appendChild(children);
  }

  /* h('div', { class: 'btn' }, ['text', otherNode]) */
  function h(tag, attrs, children) {
    var el = doc.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!attrs.hasOwnProperty(k) || attrs[k] === null || attrs[k] === undefined) { continue; }
        if (k === 'class') { el.className = attrs[k]; } else if (k === 'style') { el.style.cssText = attrs[k]; } else { el.setAttribute(k, attrs[k]); }
      }
    }
    append(el, children);
    return el;
  }

  function clear(el) {
    while (el.firstChild) { el.removeChild(el.firstChild); }
  }

  function button(label, extraClass) {
    return h('div', { class: 'btn focusable' + (extraClass ? ' ' + extraClass : '') }, label);
  }

  function playerClass(index) {
    return index === 0 ? 'p1' : 'p2';
  }

  /* Both players with their scores; `active` (0/1) gets a highlight. */
  function scoreboard(game, active) {
    var box = h('div', { class: 'scoreboard' });
    for (var i = 0; i < 2; i++) {
      var p = game.players[i];
      box.appendChild(h('div', { class: 'score ' + playerClass(i) + (i === active ? ' active' : '') }, [
        p.name, h('span', { class: 'score-num' }, String(p.score))
      ]));
    }
    return box;
  }

  /* hints: [['OK', 'Select'], ...] */
  function renderHints(el, hints) {
    clear(el);
    if (!hints) { return; }
    for (var i = 0; i < hints.length; i++) {
      el.appendChild(h('span', { class: 'hint' }, [h('span', { class: 'hint-key' }, hints[i][0]), hints[i][1]]));
    }
  }

  var toastTimer = null;
  function hideToast() {
    var el = doc.getElementById('toast');
    if (el) { el.style.display = 'none'; }
    if (toastTimer) { root.clearTimeout(toastTimer); toastTimer = null; }
  }

  function toast(message, ms) {
    var el = doc.getElementById('toast');
    if (!el) { return; }
    el.textContent = message;
    el.style.display = 'block';
    if (toastTimer) { root.clearTimeout(toastTimer); }
    toastTimer = root.setTimeout(function () { el.style.display = 'none'; }, ms || 2600);
  }

  /* Seconds with one decimal, e.g. 3.4 s */
  function seconds(ms) {
    return ms === null || ms === undefined ? '-' : (ms / 1000).toFixed(1) + ' s';
  }

  /* The shared "Quit game?" confirm used on every in-game screen. */
  function confirmQuit(ctx) {
    ctx.confirm({
      title: 'Quit game?',
      message: 'The scores of this game will be lost.',
      yes: 'Quit',
      no: 'Keep playing'
    }, function () {
      ctx.app.game = null;
      ctx.go('title');
    });
  }

  /* Replace {name} in know-me prompts with the person they are about. */
  function fillName(text, name) {
    return String(text).replace(/\{name\}/g, name);
  }

  /* The two mute buttons (music, sound effects) used on the title and between turns.
   * Returns { el, items } so the screen can put the items in its focus grid. */
  function soundToggles(app) {
    var box = h('div', { class: 'toggles' });
    function make(key, label, apply) {
      var el = h('div', { class: 'btn toggle focusable' });
      var item = {
        el: el,
        sound: null, // played below, so muting effects still gives a click and unmuting too
        paint: function () {
          var on = !!app.settings[key];
          el.textContent = label + (on ? ': On' : ': Off');
          el.className = el.className.replace(/(^|\s)off(?=\s|$)/g, '') + (on ? '' : ' off');
        },
        onSelect: function () {
          var on = !app.settings[key];
          app.settings[key] = on;
          app.saveSettings();
          if (on) { apply(on); CQ.Sound.play('toggle'); } else { CQ.Sound.play('toggle'); apply(on); }
          item.paint();
        }
      };
      item.paint();
      box.appendChild(el);
      return item;
    }
    var music = make('musicOn', '\u266B Music', function (on) { CQ.Sound.setMusicOn(on); });
    var sfx = make('sound', 'Sounds', function (on) { CQ.Sound.setSfx(on); });
    return { el: box, items: [music, sfx] };
  }

  var LETTERS = ['A', 'B', 'C', 'D'];

  CQ.UI = {
    h: h,
    clear: clear,
    button: button,
    playerClass: playerClass,
    scoreboard: scoreboard,
    renderHints: renderHints,
    toast: toast,
    hideToast: hideToast,
    seconds: seconds,
    confirmQuit: confirmQuit,
    soundToggles: soundToggles,
    fillName: fillName,
    LETTERS: LETTERS
  };
})(this);
