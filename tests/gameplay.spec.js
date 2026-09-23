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
