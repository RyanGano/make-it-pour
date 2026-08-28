# Make it Pour

A fast, touch-friendly arcade game for phones and desktops. Drag the bottle, hold to pour, and
fill the sliding cups before the clock runs dry.

![no build step](https://img.shields.io/badge/build-none-46e3ff)

## Play

There is no build step — the whole game is one self-contained `index.html`.

**Fastest:** double-click `index.html` (or open it in any modern browser).

**Local server** (needed if you want to test from your phone):

```sh
npx serve .
# or
python -m http.server 8000
```

Then open the printed URL, e.g. <http://localhost:8000>.

### Playing on your phone

1. Start a local server as above, on the same Wi-Fi as the phone.
2. Find your computer's LAN IP (`ipconfig` on Windows, `ifconfig`/`ip a` elsewhere).
3. On the phone, browse to `http://<that-ip>:8000`.
4. Add to Home Screen for a full-screen, chrome-free game.

## Controls

| Platform | Aim | Pour |
| --- | --- | --- |
| Touch | Drag anywhere | Keep your finger down |
| Mouse | Move the mouse | Hold the left button |
| Keyboard | Arrow keys | Spacebar |

## How to score

- Every drop that lands in a cup fills it; a cup that hits 100% pays out and is replaced.
- Filling a cup raises your **combo** (up to x9) and multiplies the payout. Go too long
  without a fill and the combo ticks back down.
- **Golden cups** are worth 3x and add double the time.
- Each fill adds **1 second** back to the clock, with no cap — keep landing cups and the
  round keeps going.
- The round starts at 60 seconds. Cups get thirstier and more numerous over time, and they
  slide faster the longer you survive *and* the more cups you fill — so a hot streak buys
  time while it also outruns you. That's what ends the game, not a bonus cap.

Your best score is stored locally in the browser.

## Tech

Vanilla HTML/CSS/JS on a single `<canvas>` — no dependencies, no bundler, no network calls.
Pointer Events unify mouse and multi-touch input, and the canvas is device-pixel-ratio aware,
so it stays crisp on high-DPI phones.
