/* Remote check: press every button once and see that the game understands it.
 * Arrows and OK only tick boxes here; leave with "Done" or by pressing Back twice. */
(function (root) {
  'use strict';
  var CQ = root.CQ;
  var h = CQ.UI.h;
  CQ.Screens = CQ.Screens || {};

  var KEYS = [['up', 'Up'], ['down', 'Down'], ['left', 'Left'], ['right', 'Right'], ['enter', 'OK'], ['back', 'Back']];

  CQ.Screens.remote = {
    hints: [['ANY', 'Test a button'], ['BACK x2', 'Leave']],

    mount: function (el, params, ctx) {
      el.appendChild(h('div', { class: 'h1' }, 'Remote check'));
      el.appendChild(h('div', { class: 'sub' }, 'Press each button on your remote. A box turns green when the game understands it.'));

      var boxes = {};
      var row = h('div', { class: 'keys-check' });
      KEYS.forEach(function (k) {
        boxes[k[0]] = h('div', { class: 'check' }, k[1]);
        row.appendChild(boxes[k[0]]);
      });
      el.appendChild(row);

      var area = h('div', { class: 'test-area focusable' }, 'Test area: press OK here as often as you like');
      var log = h('div', { class: 'keylog' }, 'Waiting for a key…');
      var done = CQ.UI.button('Done', 'primary');
      el.appendChild(area);
      el.appendChild(log);
      el.appendChild(h('div', { class: 'btn-row' }, done));

      var lines = [];
      var off = CQ.input.onRaw(function (info) {
        if (info.action && boxes[info.action]) { boxes[info.action].className = 'check ok'; }
        lines.unshift(CQ.DebugOverlay.describe(info));
        if (lines.length > 4) { lines.length = 4; }
        log.textContent = lines.join('\n');
        log.style.whiteSpace = 'pre';
      });

      var backPresses = 0;
      ctx.setGrid([
        [{ el: area, onSelect: function () {} }],
        [{ el: done, onSelect: function () { ctx.go('settings', { focus: 'remote' }); } }]
      ]);

      return {
        back: function () {
          backPresses++;
          if (backPresses >= 2) {
            ctx.go('settings', { focus: 'remote' });
          } else {
            ctx.toast('Back works! Press Back again to leave.');
          }
        },
        key: function (action) {
          if (action !== 'back') { backPresses = 0; }
          return false;
        },
        unmount: off
      };
    }
  };
})(this);
