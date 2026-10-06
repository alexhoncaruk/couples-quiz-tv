# Couples Quiz TV

A 2-player quiz game for couples, played on a TV with nothing but a D-pad remote
(Chromecast with Google TV, Android TV, Fire TV, or a keyboard's arrow keys).
It's one static web page: open it in a TV browser and play hot-seat, passing one remote
back and forth.

- **Trivia**: Mixed trivia, Movies & TV, Geography, plus your own Custom category.
  100 points per right answer plus up to 50 for speed, with a 20-second timer.
- **How well do you know me?**: one of you secretly answers a question about yourself
  (the TV only shows "Answer locked in"), the other guesses. A match is a point. Then swap.
- **Sound**: clicks, a "pass the remote" chime, jingles for right and wrong answers, a
  ticking clock, a winner fanfare and a funky background loop. All of it is synthesized
  live, so there are no audio files. Volume and on/off are in Settings.
- Plain HTML/CSS/JS, no build step, no frameworks, no npm packages. ES5 code, so it runs
  on old TV browsers.
- Designed for 1920x1080 at 10 feet: big text, a thick yellow focus ring, 5% safe
  margins for overscan, and a hint bar on every screen.

## Controls

| Remote button | What it does |
| --- | --- |
| Arrows (D-pad) | Move the yellow focus ring |
| OK / Enter | Select |
| Back (also Escape or Backspace on a keyboard) | One screen back. During a game it asks "Quit game?" first |
| Up five times quickly (or `d` on a keyboard) | Show or hide the key debug overlay |

On the Settings screen, Left/Right change a value.

## Run it locally

You need a small web server: browsers block the question files when the page is opened
straight from disk (`file://`).

```bash
cd couples-quiz-tv
python3 -m http.server 8000
```

Open <http://localhost:8000> and play with the arrow keys, Enter and Escape.

**To try it on the TV before deploying**, serve it on your home network and open your
computer's address in **TV Bro** (Puffin won't work for this, see below):

```bash
python3 -m http.server 8000 --bind 0.0.0.0
# find your computer's IP: `ipconfig getifaddr en0` (Mac) or `hostname -I` (Linux)
# then open http://<that-ip>:8000 on the TV
```

## Tests

```bash
node tests/run.js        # plain Node, no installs
```

They cover:

- D-pad navigation: grids, wide keyboard keys, sticky columns, disabled items, wrapping
- Key mapping: modern `key` names, old `keyCode`s, Android DPAD_CENTER and Back codes,
  held keys, the Up x5 shortcut, and Back arriving as a browser history event
- Scoring, turn order, the comeback question, the know-me flow, stats
- Screen transitions, question validation, shuffling, avoiding repeated questions
- Every content file
- A compatibility scan that fails on syntax and CSS old TV browsers don't support

**On the TV itself**, open `/tests/` (e.g. `https://<you>.github.io/couples-quiz-tv/tests/`).
It runs the same logic tests in the TV's own browser, which proves the code works on that
browser's JavaScript engine.

## Deploy to GitHub Pages

1. Create a repository on GitHub called `couples-quiz-tv` and push this folder:
   ```bash
   git remote add origin https://github.com/<you>/couples-quiz-tv.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   then choose branch `main` and folder `/ (root)`, and click **Save**.
3. After a minute the game is live at `https://<you>.github.io/couples-quiz-tv/`.

All paths are relative, so the game works fine in that sub-folder. GitHub Pages on a free
account needs a **public** repository (private-repo Pages needs a paid plan). There's
nothing secret in here, but your custom questions will be public too.

## Play it on Chromecast with Google TV

1. **Install a browser on the TV.** On the Google TV home screen, go to *Search*, type
   **TV Bro** (or **Puffin TV**) and install it. You can also install from
   [play.google.com](https://play.google.com) on your phone or computer, signed in to the
   same Google account, and pick your Chromecast as the device.
   - **TV Bro** is a normal (WebView-based) browser. It works with your GitHub Pages URL
     and with a computer on your home network. Try it first.
   - **Puffin TV** loads pages through Puffin's cloud servers, so it can only open
     public URLs like GitHub Pages, never `localhost` or `192.168.x.x`.
2. **Open the URL**: `https://<you>.github.io/couples-quiz-tv/`. Typing with the remote is
   slow, so do it once and then:
3. **Bookmark it** (both browsers have a bookmark or favourites option in their menu). Next
   time it's two clicks.
4. If the browser offers **full screen**, use it. The game scales itself to any window
   size.
5. Press **Start**, enter your names and play.

Things to check the first time:

- **The D-pad moves a mouse pointer instead of the yellow focus ring**: TV Bro starts in
  cursor (mouse) mode. **Press and hold OK** to open its round cursor menu and move onto
  the **D-pad** button: the arrows now go straight to the game. The game also works in
  mouse mode (point at a button and press OK), it's just slower.
- **Back in TV Bro's D-pad mode** switches TV Bro back to mouse mode and never reaches the
  game. That's why every screen also has on-screen **Back**, **Cancel** or **Quit game**
  buttons. In mouse mode, keep *Settings → Catch the browser's Back button* **On** so
  Back goes back one screen instead of leaving the page.
- **The picture is cut off at the edges** (common on older TVs with overscan): lower
  *Settings → Screen size* to 95% or 90%, or set the TV's picture size to "Screen fit" /
  "Just scan".

## Sound and music

- **Sound effects** (on by default): a soft tick when the focus moves, a click on OK,
  a lower blip on Back, typing clicks on the keyboard, a ding-dong on "pass the remote",
  a clunk when a know-me answer locks in, a rising jingle for right answers, a "bwomp"
  for wrong ones, a ticking clock in the last 5 seconds and a fanfare for the winner.
- **Background music** (Medium by default): a funky drums, bass and keys loop that gets
  quieter while a question is on screen. *Settings → Music volume*: Low, Medium or High.
- Android TV browsers usually allow sound straight away. Where a browser blocks sound
  until you press something, the music starts with the first press on the remote. It pauses when you press Home and resumes when you come back.
- Everything is generated live with the Web Audio API (`src/sound.js`), so nothing has to
  download, there are no copyright issues, and it works offline.

**Mute buttons:** the title screen and the "pass the remote" screen have **Music** and
**Sounds** buttons, to mute either one with a press. Both start On.

**Your own music from Spotify instead:** start a playlist in the Spotify app on the
Chromecast (or from your phone with Spotify Connect), press Home, open TV Bro and the
game, and press the **Music** button to turn the game's music off. The game's sound effects will play
on top. Some Android TV versions pause Spotify when another app starts making sound. If
that happens, turn *Sound effects* off too.

## Check what keys your remote sends

You need this when a button does nothing or does the wrong thing.

1. Press **Up five times quickly** on any screen (or `d` on a keyboard). A black box opens
   in the top right corner.
2. Press each button. Every press adds a line like
   ```
   key="ArrowDown" code="ArrowDown" keyCode=40   -> down
   ```
   `-> ignored` means the game doesn't understand that key yet. The box also shows the
   screen size the browser reports and its user agent.
3. Press Up five times again to close it. You can also turn it on permanently in
   Settings.

For a guided check, go to **Settings → Remote check**: it shows a box for Up, Down, Left,
Right, OK and Back that turns green when the button works. Press Back twice to leave.

**If a button is ignored**, note its `key` and `keyCode` from the overlay and add them to
`KEY_NAMES` or `KEY_CODES` at the top of `src/input.js`, for example
`23: 'enter'`. Then run `node tests/run.js`.

## Adding questions

Questions live in `data/questions/`, one JSON file per category, one question per line:

```json
{"id":"mixed-031","question":"How many days are in a leap year?","options":["364","365","366","367"],"correctIndex":2,"difficulty":1,"tags":["numbers"]}
```

- `options`: exactly 4. `correctIndex`: 0-3, counting from 0, so 2 is the third option.
  Options are shuffled in the game, so the right one can sit anywhere in the file. Add
  `"keepOrder": true` to keep the order (e.g. years or numbers).
- `difficulty`: 1 easy, 2 medium, 3 hard. `tags`: any words, for your own sorting.
- Know-me prompts (`know-me.json`) have no `correctIndex`. Write `{name}` where the
  person's name goes:
  `{"id":"know-me-026","question":"{name}'s dream car is…","options":["A","B","C","D"],"tags":["fun"]}`

**The easy way: the question tool** (plain Node, no installs):

```bash
node tools/questions.js add custom          # asks for the question, options, answer…
node tools/questions.js validate            # checks every file (run after editing by hand)
node tools/questions.js list                # categories and question counts
```

**Adding a whole category** takes one new file plus one line in `data/manifest.json`:

```bash
node tools/questions.js new-category music "Music" trivia "Hits, bands and lyrics."
node tools/questions.js add music
```

Or by hand: copy `data/questions/custom.json` to `data/questions/music.json`, change
`"category"`, and add this line to `data/manifest.json`:

```json
{"id":"music","name":"Music","mode":"trivia","file":"questions/music.json","description":"Hits, bands and lyrics."}
```

The category screen is built from the manifest, so the new category appears straight
away. Use `"mode":"knowme"` for another "about each other" category. The game remembers
which questions you've already played (per category, on that TV) and serves new ones first.

## How the game works

- Questions per game: 5, 10, 15 or 20 (choose on the category screen; the default is in
  Settings). Players alternate. With an odd number, the last question is a **comeback
  question** for whoever is behind.
- Trivia scoring: 100 points for a right answer, plus up to 50 for speed (50 at 0 s,
  0 when the 20 s run out). Timing out counts as wrong.
- Know-me: no timer by default (Settings can turn it on). The subject's secret pick is
  never timed.
- The end screen shows the winner, accuracy, fastest right answer and best streak, and
  the title screen keeps an all-time record for each pair of names.
- Names, settings, records and played-question history are saved in the TV browser's
  localStorage. *Settings → Reset saved data* wipes them.

## Project structure

```
index.html              the page; loads the scripts below in order (?v=N busts TV caches)
styles/main.css         10-foot UI on a 1920x1080 stage scaled to the screen
src/
  nav.js                grid navigation logic (pure, tested)
  input.js              the only keyboard listener: key mapping, Back history trap, Up x5
  router.js             screen state machine (allowed transitions) + focus ring + confirm dialog
  game.js               turns, scoring, know-me flow, stats (pure, tested)
  questions.js          manifest/question loading, validation, shuffling, unseen-first picking
  storage.js            localStorage wrapper with in-memory fallback
  settings.js           settings defaults and upgrades from older saved settings
  sound.js              synthesized sound effects and background music (Web Audio API)
  ui.js                 DOM helpers, hint bar, scoreboard, toasts
  debug.js              key debug overlay
  main.js               startup and shared state
  screens/              title, settings, remote (check), howto, setup, names (keyboard),
                        category, interstitial (pass the remote), question, reveal, results
data/
  manifest.json         one line per category
  questions/*.json      one file per category
tools/questions.js      validate / add / new-category / format
tests/                  dependency-free tests: `node tests/run.js` or open /tests/ in a browser
docs/ROADMAP.md         phone-as-controller and Google Cast plans
```

Screen flow:

```
title ─┬─ settings ── remote check
       ├─ how to play
       └─ setup ── names (keyboard)
            └─ category ── [ pass the remote → question → reveal ] x N ── results
                          know-me: pass → secret pick → "locked in" → pass → guess → reveal
```

Every in-game screen answers Back with the "Quit game?" dialog. Results offers Play again,
Change category or Home.

## Compatibility notes

- ES5 only (`var`, `function`, no arrow functions, template strings, `let`/`const`,
  `fetch` or modules) plus `Promise`. That's stricter than ES2017 on purpose, and
  `tests/compat.test.js` enforces it.
- CSS: flexbox, transforms and `calc()` only. No grid, flex `gap`, `inset` or CSS
  variables.
- Scripts are plain `<script>` tags sharing one `window.CQ` namespace, and data loads
  with `XMLHttpRequest`.
- Audio uses the Web Audio API with no files. Where it's missing, the game is silent and
  keeps working.
- Animations are minimal (a blinking cursor and the timer bar) to keep slow TV chips
  smooth.
