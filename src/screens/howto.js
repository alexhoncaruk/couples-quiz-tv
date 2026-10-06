/* How to play. */
(function (root) {
  'use strict';
  var CQ = root.CQ;
  var h = CQ.UI.h;
  CQ.Screens = CQ.Screens || {};

  function p(parts) { return h('p', null, parts); }
  function b(text) { return h('b', null, text); }

  CQ.Screens.howto = {
    hints: [['OK', 'Got it'], ['BACK', 'Title']],

    mount: function (el, params, ctx) {
      el.appendChild(h('div', { class: 'h1' }, 'How to play'));
      el.appendChild(h('div', { class: 'howto' }, [
        p(['One remote, two players. Take turns and ', b('pass the remote'), ' when the screen tells you to. Use the arrows to move and ', b('OK'), ' to choose.']),
        p([b('Trivia: '), 'answer your own questions. A right answer is worth ', b('100 points'), ', plus up to ', b('50 bonus points'), ' for answering fast. If the number of questions is odd, the last one is a comeback question for whoever is behind.']),
        p([b('How well do you know me? '), 'One of you answers a question about yourself while the other looks away. The TV only shows "Answer locked in". Then the other guesses what you picked: a match is ', b('1 point'), '. Then you swap.']),
        p([b('Back'), ' takes you one screen back. During a game it asks before quitting. Remote acting strange? Press ', b('Up 5 times'), ' to see what keys the TV receives, or try Settings → Remote check.'])
      ]));
      var ok = CQ.UI.button('Got it', 'primary');
      el.appendChild(h('div', { class: 'btn-row' }, ok));
      ctx.setGrid([[{ el: ok, onSelect: function () { ctx.go('title'); } }]]);
      return { back: function () { ctx.go('title'); } };
    }
  };
})(this);
