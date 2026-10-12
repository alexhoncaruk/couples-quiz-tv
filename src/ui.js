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

  /* ' long' for names that need a smaller font in the big name displays. */
  function longName(name) {
    return String(name).length > 9 ? ' long' : '';
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

  /* Replace {name} in know-me prompts with the person they are about, and {partner}
   * with the other player. */
  function fillName(text, name, partner) {
    return String(text).replace(/\{name\}/g, name).replace(/\{partner\}/g, partner || 'their partner');
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

  var CONFETTI_COLOURS = ['#ffd400', '#ff8a9a', '#5ee0d3', '#6a5cf0', '#5df08f', '#ff7b6b', '#ffffff'];

  /* Confetti falling over the whole stage for a few seconds. Pure CSS animations (cheap on
   * slow TVs); the pieces live inside `el`, so they go away with the screen. */
  function confetti(el, count) {
    var layer = h('div', { class: 'confetti-layer' });
    count = count || 90;
    for (var i = 0; i < count; i++) {
      var w = 14 + Math.round(Math.random() * 12);
      var css = 'left:' + Math.round(Math.random() * 1900 - 96) + 'px;' +
        'width:' + w + 'px;height:' + Math.round(w * 0.55) + 'px;' +
        'background:' + CONFETTI_COLOURS[i % CONFETTI_COLOURS.length] + ';';
      var dur = (2.8 + Math.random() * 2.4).toFixed(2) + 's';
      var delay = (Math.random() * 2.6).toFixed(2) + 's';
      css += '-webkit-animation-duration:' + dur + ';animation-duration:' + dur + ';' +
        '-webkit-animation-delay:' + delay + ';animation-delay:' + delay + ';';
      layer.appendChild(h('div', { class: 'confetti c' + (i % 3), style: css }));
    }
    el.appendChild(layer);
    return layer;
  }

  /* Know-me answers have no "fun fact", so the reveal shows a conversation starter. */
  var TALK_PROMPTS = [
    '{name}, what\'s the story behind that answer?',
    'Was that an easy pick, {name}, or did you hesitate?',
    'Would {name} have picked the same answer five years ago?',
    'Guesser: what made you think so?',
    '{name}, is there an answer you wish had been on the list?',
    'Has {name}\'s answer ever changed? When?',
    'Guesser: rate how sure you were, from 1 to 10.',
    '{name}, which answer was your second choice?',
    'Is there a funny memory that goes with this one?',
    'Do you two agree on this one? Who is more like that?',
    '{name}, explain your answer in one sentence!',
    'What would your best friends have guessed for {name}?',
    'Guesser: which answer did you almost pick?',
    '{name}, would you change your answer after hearing the guess?',
    'Has this ever caused a little argument between you two?',
    'What would your parents say {name}\'s answer is?'
  ];

  function talkPrompt(i) {
    return TALK_PROMPTS[Math.abs(i) % TALK_PROMPTS.length];
  }

  var LETTERS = ['A', 'B', 'C', 'D'];

  CQ.UI = {
    h: h,
    clear: clear,
    button: button,
    playerClass: playerClass,
    longName: longName,
    scoreboard: scoreboard,
    renderHints: renderHints,
    toast: toast,
    hideToast: hideToast,
    seconds: seconds,
    confirmQuit: confirmQuit,
    soundToggles: soundToggles,
    confetti: confetti,
    talkPrompt: talkPrompt,
    fillName: fillName,
    LETTERS: LETTERS
  };
})(this);
