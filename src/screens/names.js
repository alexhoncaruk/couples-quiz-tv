/* Name editor: quick picks (recent names and presets) plus an on-screen keyboard
 * driven by the D-pad. Names are saved in localStorage. */
(function (root) {
  'use strict';
  var CQ = root.CQ;
  var h = CQ.UI.h;
  CQ.Screens = CQ.Screens || {};

  var MAX_LEN = 12;
  var COLS = 10;
  var PRESETS = ['Me', 'Babe', 'Honey', 'Sunshine', 'Captain', 'Champ'];
  var LETTER_ROWS = ['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZÑÇ-\'', 'ÁÉÍÓÚÀÈÒÜÖ'];

  function trim(s) {
    return s.replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
  }

  /* Recent names first, then presets: no duplicates, no default "Player N" names and
   * not the name the other player already has. */
  function quickPicks(recent, otherName) {
    var out = [];
    var seen = {};
    seen[String(otherName).toLowerCase()] = true;
    recent.concat(PRESETS).forEach(function (n) {
      var k = String(n).toLowerCase();
      if (!n || seen[k] || /^player \d$/.test(k)) { return; }
      seen[k] = true;
      out.push(n);
    });
    return out.slice(0, 6);
  }

  CQ.Screens.names = {
    hints: [['← → ↑ ↓', 'Move'], ['OK', 'Type / pick'], ['BACK', 'Cancel']],

    mount: function (el, params, ctx) {
      var app = ctx.app;
      var slot = params.slot === 1 ? 1 : 0;
      var current = app.players[slot];
      var text = /^Player \d$/.test(current) ? '' : current;
      var shift = false;
      var recent = CQ.Storage.get('recentNames', []);

      el.appendChild(h('div', { class: 'h2 center' }, [
        'Name for ', h('span', { class: CQ.UI.playerClass(slot) }, 'Player ' + (slot + 1))
      ]));
      var field = h('div', { class: 'name-field ' + CQ.UI.playerClass(slot) });
      el.appendChild(field);

      var kb = h('div', { class: 'kb' });
      el.appendChild(kb);
      var KEY_W = 1300 / COLS; // px per column
      var rows = [];
      var letterItems = [];

      function keyEl(label, x, w, cls) {
        var k = h('div', { class: 'key focusable' + (cls ? ' ' + cls : ''), style: 'width:' + (w * KEY_W - 12) + 'px' }, label);
        return { el: k, x: x, w: w };
      }

      function upper() {
        var auto = text === '' || /[ \-]$/.test(text);
        return shift ? !auto : auto;
      }

      function paint() {
        CQ.UI.clear(field);
        field.appendChild(root.document.createTextNode(text));
        field.appendChild(h('span', { class: 'cursor' }));
        var up = upper();
        letterItems.forEach(function (it) { it.el.textContent = up ? it.ch : it.ch.toLowerCase(); });
        shiftItem.el.className = shiftItem.el.className.replace(/(^|\s)on(?=\s|$)/g, '') + (shift ? ' on' : '');
      }

      function type(ch) {
        if (text.length >= MAX_LEN) { CQ.Sound.play('error'); ctx.toast('Names can be up to ' + MAX_LEN + ' letters'); return; }
        text += upper() ? ch : ch.toLowerCase();
        shift = false;
        paint();
      }

      function save(name) {
        name = trim(name);
        if (!name) { CQ.Sound.play('error'); ctx.toast('Type a name or pick one from the top row'); return; }
        app.players[slot] = name;
        app.savePlayers();
        var list = [name].concat(recent.filter(function (n) { return n.toLowerCase() !== name.toLowerCase(); }));
        CQ.Storage.set('recentNames', list.slice(0, 8));
        ctx.go('setup', { focusSlot: slot });
      }

      // Row 0: quick picks, spread across the keyboard width.
      var picks = quickPicks(recent, app.players[1 - slot]);
      var pickRow = h('div', { class: 'kb-row presets' });
      kb.appendChild(pickRow);
      var pw = COLS / picks.length;
      rows.push(picks.map(function (name, i) {
        var it = keyEl(name, i * pw, pw, 'chip');
        it.onSelect = function () { save(name); };
        pickRow.appendChild(it.el);
        return it;
      }));

      // Letter rows.
      LETTER_ROWS.forEach(function (letters) {
        var rowEl = h('div', { class: 'kb-row' });
        kb.appendChild(rowEl);
        var items = [];
        for (var i = 0; i < letters.length; i++) {
          var it = keyEl(letters.charAt(i), i, 1);
          it.ch = letters.charAt(i);
          it.sound = 'type';
          it.onSelect = (function (ch) { return function () { type(ch); }; })(it.ch);
          rowEl.appendChild(it.el);
          letterItems.push(it);
          items.push(it);
        }
        rows.push(items);
      });

      // Action row: Shift(2) Space(3) Delete(3) Done(2).
      var actionRow = h('div', { class: 'kb-row' });
      kb.appendChild(actionRow);
      var shiftItem = keyEl('Aa Shift', 0, 2, 'action');
      shiftItem.sound = 'toggle';
      shiftItem.onSelect = function () { shift = !shift; paint(); };
      var spaceItem = keyEl('Space', 2, 3, 'action');
      spaceItem.sound = 'type';
      spaceItem.onSelect = function () {
        if (text && !/ $/.test(text) && text.length < MAX_LEN) { text += ' '; paint(); }
      };
      var delItem = keyEl('Delete', 5, 3, 'action');
      delItem.sound = 'delete';
      delItem.onSelect = function () { text = text.slice(0, -1); paint(); };
      var doneItem = keyEl('Done', 8, 2, 'done');
      doneItem.onSelect = function () { save(text); };
      [shiftItem, spaceItem, delItem, doneItem].forEach(function (it) { actionRow.appendChild(it.el); });
      rows.push([shiftItem, spaceItem, delItem, doneItem]);

      paint();
      ctx.setGrid(rows, { focus: text ? doneItem : (picks.length ? rows[0][0] : rows[1][0]) });

      return { back: function () { ctx.go('setup', { focusSlot: slot }); } };
    }
  };
})(this);
