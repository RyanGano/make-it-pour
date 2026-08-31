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

| Platform | Aim | Pour | Pause |
| --- | --- | --- | --- |
| Touch | Drag anywhere | Keep your finger down | Tap the pause button |
| Mouse | Move the mouse | Hold the left button | Click the pause button |
| Keyboard | Arrow keys | Spacebar | <kbd>P</kbd> or <kbd>Esc</kbd> |

<kbd>U</kbd> opens the upgrade shop from the end screen.

Pausing freezes the clock and everything on screen. The game also pauses itself if you
switch tabs or windows mid-round.

## Info panel

The **&#8505; button** in the top-right (or <kbd>I</kbd> on a keyboard) opens a panel with the
controls, the clock rules, the scoring rules, and the privacy note. It is deliberately not
shown on first launch, and opening it pauses a round in progress.

## Upgrades

Every cup you finish pays a **tip** — a golden cup pays three. The **Upgrades** button on the
end screen (or <kbd>U</kbd>) opens *the back bar*, where tips buy permanent perks:

| Upgrade | Levels | What it does |
| --- | --- | --- |
| Bigger Tips | 4 | +20% score per level. |
| Steady Hands | 3 | Carry the bottle lower, so the stream has less air to cross. |
| Wider Stream | 3 | +7 drops a second out of the bottle. |
| Deep Pockets | 3 | +5 seconds on the starting clock. |
| Gold Rush | 3 | +5% chance a cup comes up golden. |
| Hot Streak | 3 | +1 to the combo cap and a longer window before it cools. |
| Long Sip | 2 | Over pouring pays more, for longer. |
| Bubble Trouble | 3 | Bubbles drift across the bar; pour through one to pop it for 1.5s and points. |

The bottle's reach starts deliberately short so **Steady Hands** has somewhere to go: a fresh
bar can only carry the bottle down to 42% of the screen, and the three levels take that to 66%.

What you buy **carries into every later round of the session, but not past a reload**. Nothing
is written to disk, so every player starts a fresh page on exactly the same bar and scores stay
comparable. Maxing everything out costs 588 tips — roughly 25 to 30 rounds of play.

## Sharing a score

The end-of-round screen has a **Share** button next to *Pour Again*. It hands your score, the
number of cups you filled, and the page's URL to your device's share sheet
(`navigator.share`), so you can fire it off as a text message, or into any other app the
sheet offers. If the browser has no share sheet, the message is copied to the clipboard
instead ("Copied — paste it into a message."); if the clipboard is unavailable too, it falls
back to an `sms:` link. Nothing is shared unless you tap the button, and the game never sends
the message itself — your messaging app does.

## Privacy

The game collects nothing and sends nothing anywhere: no accounts, no analytics, no trackers,
no ads, no server that sees you play. Your best score is written to `localStorage` in your own
browser and never leaves the device. The Share button only hands text to your own device's
share sheet or clipboard when you press it — nothing is transmitted by the game. The only network request is the page re-fetching itself
once a minute to notice a new deploy, and it carries no information about you.

## How to score

- Every drop that lands in a cup fills it; a cup that hits 100% pays out and is replaced.
- Filling a cup raises your **combo** (up to x9) and multiplies the payout. Go too long
  without a fill and the combo ticks back down.
- **Golden cups** are worth 3x and add double the time.
- Filling a cup only scores. The clock comes back from **over pouring**: keep the stream on a
  cup after it is full and every extra drop that lands pays time. The first is worth **0.5s**,
  and each one after it is worth half the last, so one cup gives back about a second (two for
  a golden cup) no matter how long you lean on it — then the cup pops and you move on.
- **Unfilled cups drain the clock faster.** The countdown runs at 1x plus 0.05x for every
  unfilled cup on screen: one waiting cup means 1.05 seconds lost per second, two means
  1.1x, and so on. Fill one and the rate drops straight back down. The HUD shows the
  current rate under the timer whenever it is above 1x, so extra cups are pressure, not
  free time.
- The round starts at 60 seconds. Cups get thirstier and more numerous over time, and they
  slide faster the longer you survive *and* the more cups you fill — so a hot streak buys
  time while it also outruns you. That's what ends the game, not a bonus cap.

- Each finished cup also pays a **tip**, the currency for [Upgrades](#upgrades). Golden cups pay
  three.

Your best score is stored locally in the browser. Tips and upgrades are not stored at all —
they live only in the page, for as long as it is open.

## Tech

Vanilla HTML/CSS/JS on a single `<canvas>` — no dependencies, no bundler. The only network
traffic is a once-a-minute check of `index.html` itself: if its `ETag`/`Last-Modified` (or, on
hosts that send neither, its contents) changes, a small "There's an update — refresh" notice
appears in the bottom right. That check is skipped when the page is opened over `file:`.
Pointer Events unify mouse and multi-touch input, and the canvas is device-pixel-ratio aware,
so it stays crisp on high-DPI phones.
