# Roadmap

v1 (this repo) is hot-seat: one TV, one remote, players take turns. The plan below makes
the game faster and more secret by moving answering to your phones.

## Phase 2: phones as controllers

Each player answers on their own phone, at the same time and in secret. The TV becomes
a pure display.

### How it works

1. The TV page opens a **room** and shows a short room code (e.g. `KQXT`) plus a QR code
   with the join URL.
2. Each player opens the URL on their phone (or scans the QR code), types their name
   and joins. No app install, just a mobile web page.
3. Questions appear on the TV. The four answer buttons appear on both phones. Both
   players answer **simultaneously**. The TV shows only "Ana ✓ answered" until both are in
   or the timer ends, then reveals.
4. Know-me mode becomes one step: both players answer about themselves *and* guess the
   other's answer at the same time, all on their phones. No looking away, no passing.

### Pieces

- **`server/`**: a small Node server, ideally with no dependencies beyond
  [`ws`](https://github.com/websockets/ws) (or Node's built-in WebSocket support once
  stable).
  - Serves the static game (so one URL works for TV and phones) and a `/ws` WebSocket
    endpoint.
  - Keeps rooms in memory: `{ code, tv, players[2], state }`. Rooms expire after 2 hours
    without activity.
  - **The server owns the game state.** It reuses `src/game.js` unchanged (it's already a
    pure Node module) and `src/questions.js` for picking questions. Clients only send
    intents and render what the server broadcasts. That keeps phones and TV in sync and
    stops anyone peeking at the answers in dev tools.
- **TV client**: the existing screens, driven by server messages instead of local input.
  The D-pad still works for menus, and hot-seat stays available as a fallback mode.
- **Phone client (`phone.html`)**: a touch UI: join form, four big answer buttons,
  "waiting for the other player", personal score.

### Message protocol (JSON over WebSocket)

| Direction | Message | Purpose |
| --- | --- | --- |
| TV → server | `{type:"host"}` | create a room, get `{type:"room", code}` |
| phone → server | `{type:"join", code, name}` | join as player 1 or 2, get `{type:"joined", slot, token}` |
| TV → server | `{type:"start", categoryId, rounds}` | start a game |
| server → all | `{type:"question", index, total, question, options, deadline}` | show a question (never includes the answer) |
| phone → server | `{type:"answer", index, choice}` | lock in an answer (know-me: `{secret, guess}`) |
| server → TV | `{type:"answered", slot}` | show the "answered" tick without revealing the choice |
| server → all | `{type:"reveal", correctIndex, choices, points, scores}` | reveal after both answered or the deadline |
| server → all | `{type:"results", summary}` | end of game |
| any | `{type:"resume", code, token}` | reconnect after a phone locks or Wi-Fi drops |

### Scoring changes with simultaneous answers

- Both players answer every question, so a game of 10 means 10 questions each in the same
  time hot-seat takes for 5.
- Speed bonus compares answer times measured **on the server** (when the message
  arrives), so phone clocks don't matter.
- Know-me: each player scores a point for every correct guess of the other's answer.
  Optional bonus round: "who knows whom better" decided by match rate.

### Hosting options

- **Home network**: run `node server` on a laptop or Raspberry Pi. Phones and TV use
  `http://<ip>:8080`. No internet needed, but not reachable from Puffin's cloud browser
  (use TV Bro).
- **Free/cheap cloud** (Render, Fly.io, Railway, Glitch-style hosts): one small instance,
  HTTPS and `wss://` included. GitHub Pages can't run the WebSocket server, so the static
  build could stay on Pages and point at the server URL.

### Open questions

- QR code generation without dependencies (small embedded encoder vs. server-side image).
- Reconnect UX when a phone sleeps mid-question (pause the timer? auto-answer "no answer"?).
- Rate limiting and room-code brute force: 4 letters is 456,976 codes, fine for a private
  game with room expiry.

## Phase 3 (optional): real Google Cast receiver

Make the game a proper Cast app instead of a page in a TV browser. Tap "Cast" on a phone
and the game opens on the Chromecast. No TV browser, no typing URLs.

- **Receiver**: a Web Receiver app built on the Cast Application Framework (CAF)
  receiver SDK. It's an HTML page hosted over HTTPS (GitHub Pages works) that loads the
  receiver SDK and renders the existing TV screens. Use a custom message namespace such
  as `urn:x-cast:com.couplesquiz.game` for game messages.
- **Registration**: register an app ID in the
  [Google Cast SDK Developer Console](https://cast.google.com/publish) (one-time fee
  of $5). Register your Chromecast's serial number as a test device to run an
  unpublished receiver.
- **Sender**: the phone page from phase 2 becomes a Cast sender with the Web Sender SDK
  (works in Chrome on Android). Each phone connects to the same receiver session, so
  phones can talk to the receiver directly over Cast messages. With one phone as host,
  the phase-2 WebSocket server becomes optional for local play.
- **Considerations**: Cast receivers are designed around one sender plus media, so two
  senders in one session need testing. iOS needs a native sender app (Google Cast iOS SDK)
  because Safari has no Web Sender support. The receiver must handle idle timeouts.

## Small v1.x ideas

- More categories (music, food, sports, "our relationship" with your own questions).
- Difficulty filter on the category screen (use the existing `difficulty` field).
- Warning beeps in the last 5 seconds of the timer (when sound is on).
- "Double or nothing" final question with wagers.
- Spanish UI strings (all text is in the screen files, easy to pull into a `strings.js`).
