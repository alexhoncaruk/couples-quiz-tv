/* Settings: Left/Right (or OK) changes a value. Saved to localStorage right away. */
(function (root) {
  'use strict';
  var CQ = root.CQ;
  var h = CQ.UI.h;
  CQ.Screens = CQ.Screens || {};

  function onOff(v) { return v ? 'On' : 'Off'; }

  var OPTIONS = [
    { key: 'sound', label: 'Sound effects', values: [true, false], fmt: onOff },
    { key: 'music', label: 'Background music', values: ['off', 'low', 'medium', 'high'], fmt: function (v) { return v.charAt(0).toUpperCase() + v.slice(1); } },
    { key: 'timerTrivia', label: 'Timer in trivia', values: [true, false], fmt: onOff },
    { key: 'timerKnowMe', label: 'Timer in "How well do you know me?"', values: [false, true], fmt: onOff },
    { key: 'timerSeconds', label: 'Timer length', values: [10, 15, 20, 30], fmt: function (v) { return v + ' seconds'; } },
    { key: 'rounds', label: 'Questions per game', values: [5, 10, 15, 20], fmt: String },
    { key: 'debug', label: 'Key debug overlay', values: [false, true], fmt: onOff },
    { key: 'historyTrap', label: 'Catch the browser\'s Back button', values: [true, false], fmt: onOff }
  ];

  function apply(app, key, value) {
    if (key === 'sound') { CQ.Sound.setSfx(value); }
    if (key === 'music') { CQ.Sound.setMusic(value); }
    if (key === 'rounds') { app.rounds = value; }
    if (key === 'debug') { CQ.debug.setVisible(value); }
    if (key === 'historyTrap') { CQ.input.setTrap(value); }
  }

  CQ.Screens.settings = {
    hints: [['↑ ↓', 'Move'], ['← →', 'Change'], ['OK', 'Select'], ['BACK', 'Title']],

    mount: function (el, params, ctx) {
      var app = ctx.app;
      el.appendChild(h('div', { class: 'h1' }, 'Settings'));
      var rows = [];

      OPTIONS.forEach(function (opt) {
        var val = h('span', { class: 'setting-val' });
        var row = h('div', { class: 'setting focusable' }, [opt.label, val]);
        el.appendChild(row);
        var item = {
          el: row,
          option: opt,
          paint: function () { val.textContent = '‹  ' + opt.fmt(app.settings[opt.key]) + '  ›'; },
          change: function (step) {
            var i = opt.values.indexOf(app.settings[opt.key]);
            var n = opt.values.length;
            var v = opt.values[((i < 0 ? 0 : i) + step + n) % n];
            app.settings[opt.key] = v;
            app.saveSettings();
            apply(app, opt.key, v);
            CQ.Sound.play('toggle');
            item.paint();
          },
          sound: null, // change() plays its own sound
          onSelect: function () { item.change(1); }
        };
        item.paint();
        rows.push([item]);
      });

      var check = CQ.UI.button('Remote check');
      var reset = CQ.UI.button('Reset saved data', 'danger');
      var done = CQ.UI.button('Done', 'primary');
      el.appendChild(h('div', { class: 'btn-row' }, [check, reset, done]));
      rows.push([
        { el: check, onSelect: function () { ctx.go('remote'); } },
        {
          el: reset,
          onSelect: function () {
            ctx.confirm({
              title: 'Reset everything?',
              message: 'Names, settings, records and question history will be deleted.',
              yes: 'Reset',
              no: 'Cancel'
            }, function () {
              CQ.Storage.clearAll();
              root.location.reload();
            });
          }
        },
        { el: done, onSelect: function () { ctx.go('title', { focus: 'settings' }); } }
      ]);

      ctx.setGrid(rows, { focus: params.focus === 'remote' ? rows[rows.length - 1][0] : null });

      return {
        key: function (action) {
          var item = ctx.current();
          if (item && item.option && (action === 'left' || action === 'right')) {
            item.change(action === 'left' ? -1 : 1);
            return true;
          }
          return false;
        },
        back: function () { ctx.go('title', { focus: 'settings' }); }
      };
    }
  };
})(this);
