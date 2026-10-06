/* Couples Quiz TV - startup: shared app state, stage scaling and wiring. */
(function (root) {
  'use strict';
  var CQ = root.CQ;
  var doc = root.document;

  var savedPlayers = CQ.Storage.get('players', null);

  /* Everything the screens share. */
  var App = {
    settings: CQ.Settings.migrate(CQ.Storage.get('settings', null)),
    players: savedPlayers && savedPlayers.length === 2 ? savedPlayers : ['Player 1', 'Player 2'],
    rounds: null,
    manifest: null,
    categoryId: null,
    game: null,
    scale: 1,
    router: null,

    saveSettings: function () { CQ.Storage.set('settings', App.settings); },
    savePlayers: function () { CQ.Storage.set('players', App.players); },

    category: function (id) {
      var list = App.manifest ? App.manifest.categories : [];
      for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
      return null;
    },

    /* Load a category, pick fresh questions and create the game. */
    startGame: function (categoryId) {
      var cat = App.category(categoryId);
      if (!cat) { return Promise.reject(new Error('Unknown category ' + categoryId)); }
      return CQ.Questions.loadCategory(cat).then(function (list) {
        var seenKey = 'seen.' + cat.id;
        var picked = CQ.Questions.pick(list, App.rounds, CQ.Storage.get(seenKey, []), cat.mode);
        CQ.Storage.set(seenKey, picked.seen);
        var timerOn = cat.mode === 'knowme' ? App.settings.timerKnowMe : App.settings.timerTrivia;
        App.categoryId = cat.id;
        App.game = CQ.Game.create({
          mode: cat.mode,
          players: App.players,
          questions: picked.questions,
          total: App.rounds,
          timerSeconds: timerOn ? App.settings.timerSeconds : 0,
          categoryId: cat.id,
          categoryName: cat.name
        });
        return App.game;
      });
    }
  };
  App.rounds = App.settings.rounds;

  /* The visible area in CSS pixels. Takes the smallest of the browser's numbers:
   * innerWidth can report the zoomed-out "page" size in TV browsers, while
   * documentElement.clientWidth and visualViewport give what is actually on screen. */
  function screenSize() {
    var de = doc.documentElement;
    var w = de.clientWidth || root.innerWidth;
    var h = de.clientHeight || root.innerHeight;
    if (root.innerWidth && root.innerWidth < w) { w = root.innerWidth; }
    if (root.innerHeight && root.innerHeight < h) { h = root.innerHeight; }
    var vv = root.visualViewport;
    if (vv && vv.width && vv.width < w) { w = vv.width; }
    if (vv && vv.height && vv.height < h) { h = vv.height; }
    return { w: w, h: h };
  }

  /* Scale the 1920x1080 stage to the screen. Settings -> Screen size shrinks it further
   * for TVs that cut off the edges (overscan). */
  function fit() {
    var size = screenSize();
    if (!size.w || !size.h) { return; }
    var s = Math.min(size.w / 1920, size.h / 1080) * (App.settings.screenFit || 100) / 100;
    var tx = Math.round((size.w - 1920 * s) / 2);
    var ty = Math.round((size.h - 1080 * s) / 2);
    var t = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
    var stage = doc.getElementById('stage');
    stage.style.webkitTransform = t;
    stage.style.transform = t;
    App.scale = s;
    App.screen = size;
  }
  App.fit = fit;

  function fatal(message) {
    var box = doc.getElementById('fatal');
    box.style.display = 'block';
    box.appendChild(doc.createTextNode(message + '\n'));
  }

  function boot() {
    fit();
    root.addEventListener('resize', fit);
    root.addEventListener('orientationchange', fit);
    if (root.visualViewport) { root.visualViewport.addEventListener('resize', fit); }
    // Some TV browsers report their final size only after the first layout.
    root.setTimeout(fit, 300);
    root.setTimeout(fit, 1500);
    CQ.Sound.configure({ sfx: App.settings.sound, musicOn: App.settings.musicOn, music: App.settings.music });
    CQ.Sound.tryAutostart();
    // A click (pointer/mouse mode in TV browsers) also counts as the gesture that allows audio.
    doc.addEventListener('click', function () { CQ.Sound.unlock(); }, true);

    var debug = new CQ.DebugOverlay(doc.getElementById('debug'), App);
    var input = new CQ.Input.Controller();
    var router = new CQ.Router({
      app: App,
      screenEl: doc.getElementById('screen'),
      hintsEl: doc.getElementById('hints'),
      modalEl: doc.getElementById('modal-layer')
    });
    CQ.debug = debug;
    CQ.input = input;
    App.router = router;

    for (var name in CQ.Screens) {
      if (CQ.Screens.hasOwnProperty(name)) { router.register(name, CQ.Screens[name]); }
    }
    router.onDebug = function () { debug.toggle(); };

    input.attach(root, doc);
    input.onRaw(function (info) {
      debug.record(info);
      // Any key press counts as the user gesture browsers need before playing audio.
      if (info.type === 'keydown') { CQ.Sound.unlock(); }
    });
    input.setTrap(App.settings.historyTrap);
    input.setHandler(function (action, info) { router.handle(action, info); });

    // TV Bro starts in mouse mode; tell people once how to get D-pad mode.
    var pointerHinted = false;
    doc.addEventListener('mousemove', function () {
      if (pointerHinted) { return; }
      pointerHinted = true;
      root.setTimeout(function () {
        CQ.UI.toast('Mouse mode works, but the arrows are easier: in TV Bro hold OK and choose the D-pad button', 7000);
      }, 400);
    });
    if (App.settings.debug) { debug.setVisible(true); }

    CQ.Questions.loadManifest().then(function (manifest) {
      App.manifest = manifest;
      router.go('title');
    }, function (err) {
      fatal(err.message + '\nOpen the game through a web server (see README), not as a file.');
    });
  }

  CQ.App = App;
  boot();
})(this);
