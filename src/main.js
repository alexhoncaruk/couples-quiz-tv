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

  /* Scale the 1920x1080 stage to whatever size the TV browser reports. */
  function fit() {
    var w = root.innerWidth || doc.documentElement.clientWidth;
    var h = root.innerHeight || doc.documentElement.clientHeight;
    var s = Math.min(w / 1920, h / 1080);
    var tx = Math.round((w - 1920 * s) / 2);
    var ty = Math.round((h - 1080 * s) / 2);
    var t = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
    var stage = doc.getElementById('stage');
    stage.style.webkitTransform = t;
    stage.style.transform = t;
    App.scale = s;
  }

  function fatal(message) {
    var box = doc.getElementById('fatal');
    box.style.display = 'block';
    box.appendChild(doc.createTextNode(message + '\n'));
  }

  function boot() {
    fit();
    root.addEventListener('resize', fit);
    CQ.Sound.configure({ sfx: App.settings.sound, music: App.settings.music });

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
