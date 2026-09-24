// Gameplay, saves, formatting and resilience.
const { test, expect } = require("@playwright/test");
const { startServer, openGame, screens, finishRound } = require("./helpers");

let server;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.close(); });

const SAVE_KEY = "makeItPourSave";
const readSave = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);

// Holds the pour down and sweeps the bottle across the bar until the round ends.
async function playRound(page, { y = 600, width = 420 } = {}) {
  await page.click("#startBtn");
  await page.mouse.move(width / 2, y);
  await page.mouse.down();
  for (let t = 0; t < 900 && !(await screens(page)).end; t++) {
    await page.mouse.move(40 + (t * 23) % (width - 80), y);
    await page.clock.runFor(100);
  }
  await page.mouse.up();
}

test("a bot-played round fills cups, earns tips and ranks up without errors", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 420, height: 860 });
  const errors = await openGame(page, server.base);
  await playRound(page);
  const cups = Number((await page.locator("#finalCups").textContent()).replace(/\D/g, ""));
  expect(cups).toBeGreaterThan(5);
  const tips = await page.locator("#finalTips").textContent();
  await expect(page.locator("#shopBtn")).toHaveText("Upgrades · " + tips);
  expect(errors).toEqual([]);
});

test("the Tips stat follows a purchase", async ({ page }) => {
  await openGame(page, server.base, { short: true, save: { v: 2, best: 0, tips: 500, owned: {} } });
  await page.keyboard.press("Enter");
  await finishRound(page);
  await page.click("#shopBtn");
  await page.click(".up button:not([disabled])");
  await page.click("#shopCloseBtn");
  await expect(page.locator("#finalTips")).toHaveText("390");
  await expect(page.locator("#shopBtn")).toHaveText("Upgrades · 390");
});

test.describe("saves", () => {
  test("an older save keeps its rank, and unknown or excess upgrades are dropped", async ({ page }) => {
    await openGame(page, server.base, {
      short: true,
      save: { v: 2, best: 25000, tips: 40, peakScore: 25000, owned: { reach: 2, bogus: 3, mult: 99 } }
    });
    await page.keyboard.press("Enter");
    await finishRound(page);
    await page.click("#shopBtn");
    await expect(page.locator("#rankNum")).toHaveText("Rank 3");
    await expect(page.locator("#rankNext")).toContainText("best so far 25,000");
    const save = await readSave(page);
    expect(save.owned).toEqual({ reach: 2, mult: 4 });
  });

  test("a save from before best and peakScore were merged takes the higher of the two", async ({ page }) => {
    await openGame(page, server.base, { short: true, save: { v: 2, best: 0, tips: 0, peakScore: 20000, owned: {} } });
    await page.keyboard.press("Enter");
    await finishRound(page);
    await expect(page.locator("#finalRank")).toHaveText("3");
  });

  test("new saves still write peakScore, so older builds read the right rank", async ({ page }) => {
    await openGame(page, server.base, { short: true, save: { v: 2, best: 25000, tips: 0, owned: {} } });
    await page.keyboard.press("Enter");
    await finishRound(page);
    const save = await readSave(page);
    expect(save.peakScore).toBe(save.best);
    expect(save.best).toBe(25000);
  });

  test("Reset Everything wipes the save and the end screen's old news", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 420, height: 860 });
    await openGame(page, server.base);
    await playRound(page);
    await page.click("#info");
    await page.click("#resetBtn");
    await page.click("#resetBtn");
    await page.click("#infoCloseBtn");
    await expect(page.locator("#endTitle")).toHaveText("Time is Up!");
    await expect(page.locator("#endStatus")).toHaveText("");
    await expect(page.locator("#finalBest")).toHaveText("0");
    await expect(page.locator("#finalRank")).toHaveText("1");
    await expect(page.locator("#finalTips")).toHaveText("0");
    await expect(page.locator("#shopBtn")).toHaveText("Upgrades");
    expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBeNull();
  });

  test("the mute setting survives a reload, and its label says what a tap will do", async ({ page }) => {
    await openGame(page, server.base);
    await expect(page.locator("#mute")).toHaveAttribute("aria-label", "Mute sound");
    await page.click("#mute");
    await page.reload();
    await expect(page.locator("#mute")).toHaveAttribute("aria-label", "Unmute sound");
    await expect(page.locator("#mute")).toHaveAttribute("title", "Unmute");
  });
});

test.describe("hiding maxed upgrades", () => {
  const rows = (page) => page.locator("#upList .up");

  test("the toggle hides maxed rows, is remembered across reloads and resets, and undoes", async ({ page }) => {
    await openGame(page, server.base, { short: true, save: { v: 2, best: 0, tips: 1000, owned: { reach: 3, clock: 3 } } });
    await page.keyboard.press("Enter");
    await finishRound(page);
    await page.click("#shopBtn");
    const all = await rows(page).count();
    await expect(page.locator("#hideMaxedBtn")).toHaveText("Hide maxed");
    await page.click("#hideMaxedBtn");
    await expect(rows(page)).toHaveCount(all - 2);
    await expect(page.locator('button[data-id="reach"]')).toHaveCount(0);
    await expect(page.locator("#hideMaxedBtn")).toHaveText("Show 2 maxed");

    // Buying the last level of an upgrade takes it off the list while hiding is on.
    await page.click('button[data-id="tipsize"]');   // 190 - level 1 of 3
    await expect(rows(page)).toHaveCount(all - 2);

    await page.reload();
    await page.keyboard.press("Enter");
    await finishRound(page);
    await page.click("#shopBtn");
    await expect(rows(page)).toHaveCount(all - 2);
    await expect(page.locator("#hideMaxedBtn")).toHaveText("Show 2 maxed");

    await page.click("#hideMaxedBtn");
    await expect(rows(page)).toHaveCount(all);
    await expect(page.locator("#hideMaxedBtn")).toHaveText("Hide maxed");
    await page.click("#hideMaxedBtn");

    // A fresh bar has nothing maxed, so no toggle - but the choice is kept for the next climb.
    await page.click("#shopCloseBtn");
    await page.click("#info");
    await page.click("#resetBtn");
    await page.click("#resetBtn");
    await page.click("#infoCloseBtn");
    expect(await page.evaluate(() => localStorage.getItem("makeItPourHideMaxed"))).toBe("on");
    await page.click("#shopBtn");
    await expect(page.locator("#hideMaxedBtn")).toBeHidden();
    await expect(rows(page)).toHaveCount(all);
  });

  test("a full bar with maxed rows hidden says so instead of showing an empty list", async ({ page }) => {
    await openGame(page, server.base, {
      short: true,
      save: { v: 2, best: 1e7, tips: 0, owned: { reach: 9, clock: 9, tipsize: 9, pour: 9, sip: 9, mult: 9, gold: 9, combo: 9, bubbles: 9 } }
    });
    await page.keyboard.press("Enter");
    await finishRound(page);
    await page.click("#shopBtn");
    await page.click("#hideMaxedBtn");
    await expect(rows(page)).toHaveCount(0);
    await expect(page.locator("#maxedNote")).toHaveText("Every upgrade is maxed.");
    await expect(page.locator("#hideMaxedBtn")).toHaveText("Show 9 maxed");
  });
});

test.describe("numbers", () => {
  test("the info panel quotes the game's own numbers", async ({ page }) => {
    await openGame(page, server.base);
    const rules = await page.evaluate(() =>
      Object.fromEntries([...document.querySelectorAll("[data-rule]")].map((e) => [e.dataset.rule, e.textContent])));
    expect(rules).toEqual({
      cupScore: "100", goldenScore: "300", comboCap: "9", tipTiers: "2", goldFillTips: "8", roundTime: "60"
    });
  });

  test.describe("in Persian", () => {
    test.use({ locale: "fa-IR" });
    test("every number on the end screen and in the rules uses the same digits", async ({ page }) => {
      await openGame(page, server.base, { short: true, save: { v: 2, best: 25000, tips: 1200, owned: {} } });
      await page.keyboard.press("Enter");
      await finishRound(page);
      await expect(page.locator("#finalBest")).toHaveText("۲۵٬۰۰۰");
      await expect(page.locator("#finalTips")).toHaveText("۱٬۲۰۰");
      await expect(page.locator("#finalRank")).toHaveText("۳");
      await expect(page.locator('[data-rule="goldFillTips"]')).toHaveText("۸");
    });
  });

  test.describe("in German", () => {
    test.use({ locale: "de-DE" });
    test("upgrade effects use the locale's decimal comma", async ({ page }) => {
      await openGame(page, server.base, {
        short: true, save: { v: 2, best: 95000, tips: 0, owned: { sip: 1, combo: 2 } }
      });
      await page.keyboard.press("Enter");
      await finishRound(page);
      await page.keyboard.press("KeyU");
      await expect(page.locator(".up-list")).toContainText("Now: +0,6s of over pour, +25% clock.");
      await expect(page.locator(".up-list")).toContainText("Now: x11 max, +1,4s.");
    });
  });
});

test.describe("Steady Hands on short screens", () => {
  // The bottle's lowest position at each level, read from where the pour stream is drawn.
  async function lowestBottle(page, height, level) {
    await page.setViewportSize({ width: 800, height });
    await openGame(page, server.base, { save: { v: 2, best: 0, tips: 0, owned: level ? { reach: level } : {} } });
    await page.click("#startBtn");
    await page.mouse.move(400, height - 2);   // as low as the pointer goes
    await page.mouse.down();
    await page.clock.runFor(100);
    const ys = await page.evaluate(() => new Promise((resolve) => {
      const ctx = document.getElementById("game").getContext("2d");
      const fillRect = ctx.fillRect.bind(ctx);
      const seen = [];
      ctx.fillRect = (x, y, w, h) => { if (w === 10 && h === 90) seen.push(Math.round(y - 18)); return fillRect(x, y, w, h); };
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve(seen))));
    }));
    await page.mouse.up();
    return ys;
  }

  for (const height of [260, 360, 860]) {
    test("every level reaches deeper, and the bottle holds still, at " + height + "px tall", async ({ browser }) => {
      const floors = [];
      for (const level of [0, 1, 2, 3]) {
        const page = await browser.newPage();
        const ys = await lowestBottle(page, height, level);
        expect(new Set(ys).size, "bottle jitters at level " + level).toBe(1);
        floors.push(ys[0]);
        await page.close();
      }
      for (let i = 1; i < floors.length; i++) expect(floors[i]).toBeGreaterThan(floors[i - 1]);
    });
  }

  test("a tall screen keeps the priced reach: 42% of the height, then 8% a level", async ({ browser }) => {
    const page = await browser.newPage();
    const ys = await lowestBottle(page, 860, 3);
    expect(ys[0]).toBe(Math.round(860 * 0.66));
    await page.close();
  });

  test("a bottle held at its lowest still fills cups at every level on a phone on its side", async ({ browser }) => {
    test.slow();
    for (const level of [0, 3]) {
      const page = await browser.newPage({ viewport: { width: 800, height: 360 } });
      await openGame(page, server.base, { save: { v: 2, best: 0, tips: 0, owned: level ? { reach: level } : {} } });
      await page.click("#startBtn");
      await page.mouse.move(40, 355);
      await page.mouse.down();
      for (let t = 0; t < 300; t++) {
        await page.mouse.move(40 + (t * 7) % 720, 355);
        await page.clock.runFor(100);
      }
      // The score is only drawn on the canvas: read it from the next frame's HUD.
      const score = await page.evaluate(() => new Promise((resolve) => {
        const ctx = document.getElementById("game").getContext("2d");
        const fillText = ctx.fillText.bind(ctx);
        ctx.fillText = (t, ...a) => { if (ctx.font.startsWith("800 30px")) resolve(t); return fillText(t, ...a); };
      }));
      expect(Number(score.replace(/\D/g, "")), "score at level " + level).toBeGreaterThan(0);
      await page.close();
    }
  });
});

test.describe("resilience", () => {
  test("a browser that refuses an AudioContext still starts the game", async ({ page }) => {
    await page.addInitScript(() => {
      window.AudioContext = function () { throw new DOMException("blocked", "NotAllowedError"); };
    });
    const errors = await openGame(page, server.base);
    await page.click("#startBtn");
    expect((await screens(page)).playing).toBe(true);
    expect(errors).toEqual([]);
  });

  test("a Web Audio engine whose connect() returns nothing plays a round through", async ({ page }) => {
    await page.addInitScript(() => {
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (...a) { connect.apply(this, a); return undefined; };
    });
    const errors = await openGame(page, server.base, { short: true });
    await page.click("#startBtn");
    await page.mouse.move(300, 400);
    await page.mouse.down();
    await finishRound(page);
    expect((await screens(page)).end).toBe(true);
    expect(errors).toEqual([]);
  });

  test("an error in one frame does not freeze the game", async ({ page }) => {
    // Real timers here: the fake clock would rethrow the page's error into the test.
    await page.addInitScript(() => {
      let thrown = false;
      const byId = document.getElementById.bind(document);
      document.getElementById = (id) => {
        if (id === "finalScore" && !thrown) { thrown = true; throw new Error("boom"); }
        return byId(id);
      };
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(server.base + "/short.html");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);   // the 1-second round ends, and endGame() throws
    expect(errors).toEqual(["boom"]);
    const draws = await page.evaluate(() => new Promise((resolve) => {
      const ctx = document.getElementById("game").getContext("2d");
      const fillRect = ctx.fillRect.bind(ctx);
      let n = 0;
      ctx.fillRect = (...a) => { n++; return fillRect(...a); };
      setTimeout(() => resolve(n), 500);
    }));
    expect(draws).toBeGreaterThan(0);
  });
});

test.describe("the climb", () => {
  // Every upgrade maxed but Bubble Trouble's last level, at top rank with the tips for it.
  const ALMOST = { reach: 3, clock: 3, tipsize: 3, pour: 3, sip: 2, mult: 4, gold: 3, combo: 3, bubbles: 2 };

  // Stands in for the share sheet and records what it was handed.
  async function captureShares(page) {
    await page.addInitScript(() => {
      window.shared = [];
      navigator.share = async (data) => { window.shared.push(data.text); };
    });
  }
  const lastShare = async (page) => {
    await page.click("#shareBtn");
    return page.evaluate(() => window.shared[window.shared.length - 1]);
  };

  test("a fresh bar times its rounds, and pauses do not count", async ({ page }) => {
    await captureShares(page);
    await openGame(page, server.base, { short: true });
    await page.keyboard.press("Enter");
    await finishRound(page);
    await page.keyboard.press("Enter");
    await page.keyboard.press("p");
    await page.clock.runFor(60000);   // a minute paused
    await page.keyboard.press("p");
    await finishRound(page);
    const { run } = await readSave(page);
    expect(run).toMatchObject({ timed: true, rounds: 2, done: false });
    expect(run.time).toBeGreaterThan(1);
    expect(run.time).toBeLessThan(3);
    expect(await lastShare(page)).toBe(
      "I've played 2 rounds of Make it Pour (0m 0" + Math.floor(run.time) + "s of pouring) and bought 0 of 27 upgrade levels.");
  });

  test("a bar from before climbs were timed stays untimed", async ({ page }) => {
    await captureShares(page);
    await openGame(page, server.base, { short: true, save: { v: 2, best: 0, tips: 0, owned: { reach: 1 } } });
    await page.keyboard.press("Enter");
    await finishRound(page);
    expect((await readSave(page)).run).toEqual({ timed: false, time: 0, rounds: 0, done: false });
    expect(await lastShare(page)).toBe("I've bought 1 of 27 upgrade levels in Make it Pour.");
    await page.click("#shopBtn");
    await expect(page.locator("#runLine")).toContainText("Reset Everything starts a timed run");
  });

  test("the last level finishes the climb, sets the record, and a reset keeps only the record", async ({ page }) => {
    await captureShares(page);
    await openGame(page, server.base, {
      short: true,
      save: { v: 2, best: 90000, tips: 2000, owned: ALMOST, run: { timed: true, time: 3600, rounds: 20, done: false } }
    });
    await page.keyboard.press("Enter");
    await page.clock.runFor(30000);   // Deep Pockets makes it a 16-second round
    await page.click("#shopBtn");
    await page.click('.up button[data-id="bubbles"]');
    const { run, record } = await readSave(page);
    expect(run).toMatchObject({ timed: true, rounds: 21, done: true });
    expect(run.time).toBeGreaterThan(3610);
    expect(record).toEqual({ time: run.time, rounds: 21 });
    await expect(page.locator("#runLine")).toContainText("Every upgrade bought in 1h 00m");
    await page.click("#shopCloseBtn");
    expect(await lastShare(page)).toMatch(
      /^I bought every upgrade in Make it Pour in 1h 00m \d\ds of pouring over 21 rounds\. Can you beat it\?$/);

    // More rounds after the finish do not move it.
    await page.keyboard.press("Enter");
    await page.clock.runFor(30000);
    expect((await readSave(page)).run).toEqual(run);

    await page.click("#info");
    await page.click("#resetBtn");
    await page.click("#resetBtn");
    await page.click("#infoCloseBtn");
    const after = await readSave(page);
    expect(after).toMatchObject({ best: 0, tips: 0, owned: {}, record });
    expect(after.run).toEqual({ timed: true, time: 0, rounds: 0, done: false });
    expect(await lastShare(page)).toMatch(
      /^I've played 0 rounds of Make it Pour \(0m 00s of pouring\) and bought 0 of 27 upgrade levels\. My fastest run to every upgrade: 1h 00m \d\ds of pouring over 21 rounds\. Can you beat it\?$/);
  });

  test("a slower finish does not replace the record", async ({ page }) => {
    await openGame(page, server.base, {
      short: true,
      save: { v: 2, best: 90000, tips: 2000, owned: ALMOST,
              run: { timed: true, time: 9000, rounds: 40, done: false }, record: { time: 3000, rounds: 30 } }
    });
    await page.keyboard.press("Enter");
    await page.clock.runFor(30000);
    await page.click("#shopBtn");
    await page.click('.up button[data-id="bubbles"]');
    expect((await readSave(page)).record).toEqual({ time: 3000, rounds: 30 });
    await expect(page.locator("#runLine")).toContainText("Fastest run: 50m 00s of pouring over 30 rounds.");
  });
});
