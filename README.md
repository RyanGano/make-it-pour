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

## Tips, score, and the fork between them

The bar runs on **two currencies, and no single way of playing earns both**.

| | Where it comes from | What it buys |
| --- | --- | --- |
| **Score** | Filling cups, multiplied by the combo | Your **rank**, which decides what the shop will *sell* you |
| **Tips** | *Over* pouring a cup you have already filled | The upgrades themselves |

Every cup that reaches 100% is the same small decision:

- **Move on** and the combo climbs. Big combo, big score, big rank — and almost no money.
- **Lean on it** and each payout hands you tips (1, then 2, then 2… for as long as you hold)
  *and knocks a point off your combo*. Rich, and scoring badly.

The first **half second** of over pouring is free: it pays the clock but costs no combo and
earns no tips, because drops still in the air when a cup tops out are physics, not a choice.
The one exception to the whole scheme is the **golden cup, which tips you 8 just for finishing
it** — without it a player chasing a huge score could never afford to shop at all.

Over pouring is also the **only** thing that gives clock back, so nobody can ignore it
entirely. That is the pressure: the seconds you need to survive are bought with the multiplier
that would have made the round worth something.

## Rank and the back bar

Your **best single round of the session** sets your rank, and every upgrade is gated behind
one. Grind tips alone and you end up rich in front of a locked shelf; chase score alone and
you can afford nothing on the open one.

| Rank | Best round needed | Unlocks |
| --- | --- | --- |
| 1 — Barback | — | Steady Hands, Deep Pockets, Bigger Tips |
| 2 — Pourer | 6,000 | Wider Stream, Long Sip |
| 3 — Bartender | 20,000 | Top Shelf, Gold Rush |
| 4 — Mixologist | 50,000 | Hot Streak |
| 5 — Master of the Bar | 90,000 | Bubble Trouble |

The **Upgrades** button on the end screen (or <kbd>U</kbd>) opens the shop:

| Upgrade | Levels | Cost | What it does |
| --- | --- | --- | --- |
| Steady Hands | 3 | 110 / 320 / 780 | Carry the bottle lower, so the stream has less air to cross. |
| Deep Pockets | 3 | 100 / 290 / 700 | +5 seconds on the starting clock. |
| Bigger Tips | 3 | 190 / 520 / 1200 | Payouts climb higher, and the cup waits long enough to get there. |
| Wider Stream | 3 | 160 / 450 / 1050 | +7 drops a second out of the bottle. |
| Long Sip | 2 | 220 / 650 | Over pouring pays more clock, for longer. |
| Top Shelf | 4 | 150 / 380 / 880 / 1900 | +20% score per level. |
| Gold Rush | 3 | 150 / 410 / 980 | +5% chance a cup comes up golden. |
| Hot Streak | 3 | 150 / 400 / 900 | +1 combo cap and a longer window before it cools. |
| Bubble Trouble | 3 | 250 / 650 / 1450 | Bubbles drift across the bar; pour through one for 1.5s and points. |

**Bigger Tips is worth nothing to a player who will not lean on a cup**, and Top Shelf is worth
nothing to one who never stops leaning. The tree is deliberately not something a good session
clears out by accident: it costs **15,390 tips** in total, which is roughly 20 rounds for
someone who reads the fork well and switches lines when rank is what is blocking them, and
considerably more for anyone who commits to one currency and stays there.

The bottle's reach starts deliberately short so **Steady Hands** has somewhere to go: a fresh
bar can only carry the bottle down to 42% of the screen, and the three levels take that to 66%.

What you buy — and your rank — **carries into every later round of the session, but not past a
reload**. Nothing is written to disk, so every player starts a fresh page on exactly the same
bar and scores stay comparable.

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
- **Golden cups** are worth 3x, add double the time, and are the only cup that tips you for
  simply finishing it.
- Filling a cup only ever scores. The clock — and every tip you will ever spend — comes back
  from **over pouring**: keep the stream on a cup after it is full and it pays every third of
  a second, for up to two seconds, before the cup is spent. See
  [Tips, score, and the fork between them](#tips-score-and-the-fork-between-them).
- **Unfilled cups drain the clock faster.** The countdown runs at 1x plus 0.05x for every
  unfilled cup on screen: one waiting cup means 1.05 seconds lost per second, two means
  1.1x, and so on. Fill one and the rate drops straight back down. The HUD shows the
  current rate under the timer whenever it is above 1x, so extra cups are pressure, not
  free time.
- The round starts at 60 seconds. Cups get thirstier and more numerous over time, and they
  slide faster the longer you survive *and* the more cups you fill — so a hot streak buys
  time while it also outruns you. That's what ends the game, not a bonus cap.

Your best score is stored locally in the browser. Tips, rank and upgrades are not stored at
all — they live only in the page, for as long as it is open.

## Tech

Vanilla HTML/CSS/JS on a single `<canvas>` — no dependencies, no bundler. The only network
traffic is a once-a-minute check of `index.html` itself: if its `ETag`/`Last-Modified` (or, on
hosts that send neither, its contents) changes, a small "There's an update — refresh" notice
appears in the bottom right. That check is skipped when the page is opened over `file:`.
Pointer Events unify mouse and multi-touch input, and the canvas is device-pixel-ratio aware,
so it stays crisp on high-DPI phones.
