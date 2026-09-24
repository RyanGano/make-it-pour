// Keyboard, mouse and focus. The rule under test: outside live play, a button the player
// chose with the keyboard answers Enter and Space itself; otherwise those keys belong to
// the game (start a round, close a panel). Every case here was a real bug at some point.
const { test, expect } = require("@playwright/test");
const { startServer, openGame, screens, tabTo, finishRound } = require("./helpers");

const RICH = { v: 2, best: 0, tips: 5000, owned: {} };
let server;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.close(); });

async function open(page, opts) {
  page.__errors = await openGame(page, server.base, opts);
}

// Whatever else a test checks, the page must not have thrown.
test.afterEach(async ({ page }) => {
  expect(page.__errors || [], "page errors").toEqual([]);
});

test.describe("held keys", () => {
  test("Space held through the end of a round does not skip the end screen", async ({ page }) => {
    await open(page, { short: true });
    await page.keyboard.press("Enter");
    await page.keyboard.down("Space");
    await finishRound(page);
    await page.keyboard.down("Space");   // auto-repeat
    await page.keyboard.up("Space");
    expect(await screens(page)).toMatchObject({ end: true, playing: false });
  });

  test("held Enter on a Tab-focused mute button toggles it once", async ({ page }) => {
    await open(page);
    await page.keyboard.press("Enter");
    await tabTo(page, "#mute");
    await page.keyboard.down("Enter");
    await page.keyboard.down("Enter");
    await page.keyboard.down("Enter");
    await page.keyboard.up("Enter");
    expect((await screens(page)).mute).toBe("Unmute");
  });

  test("held NumpadEnter on Reset Everything arms it but does not wipe the save", async ({ page }) => {
    await open(page, { save: RICH });
    await page.keyboard.press("KeyI");
    await tabTo(page, "#resetBtn");
    await page.keyboard.down("NumpadEnter");
    await page.keyboard.down("NumpadEnter");
    await page.keyboard.down("NumpadEnter");
    await page.keyboard.up("NumpadEnter");
    expect(await page.evaluate(() => localStorage.getItem("makeItPourSave"))).not.toBeNull();
    await expect(page.locator("#resetBtn")).toHaveText("Tap again to confirm");
  });

  test("held NumpadEnter on a buy button buys one level; two presses buy two", async ({ page }) => {
    await open(page, { save: RICH, short: true });
    await page.keyboard.press("Enter");
    await finishRound(page);
    await page.keyboard.press("KeyU");
    await tabTo(page, 'button[data-id="reach"]');
    await page.keyboard.down("NumpadEnter");
    await page.keyboard.down("NumpadEnter");
    await page.keyboard.up("NumpadEnter");
    await expect(page.locator("#tipsCount")).toHaveText("4,890");
    await page.keyboard.press("NumpadEnter");
    await expect(page.locator("#tipsCount")).toHaveText("4,570");
    expect((await screens(page)).shop).toBe(true);
  });

  test("NumpadEnter starts a round like Enter", async ({ page }) => {
    await open(page);
    await page.keyboard.press("NumpadEnter");
    expect((await screens(page)).playing).toBe(true);
  });
});

test.describe("keyboard-chosen buttons", () => {
  test("Enter on a Tab-focused Upgrades opens the shop and does not start a round", async ({ page }) => {
    await open(page, { save: RICH, short: true });
    await page.keyboard.press("Enter");
    await finishRound(page);
    await tabTo(page, "#shopBtn");
    await page.keyboard.press("Enter");
    expect(await screens(page)).toMatchObject({ shop: true, end: true, playing: false });
  });

  test("Enter buys every level from the keyboard, then leaves the shop, then starts a round", async ({ page }) => {
    await open(page, { save: RICH, short: true });
    await page.keyboard.press("Enter");
    await finishRound(page);
    await page.keyboard.press("KeyU");
    await tabTo(page, 'button[data-id="reach"]');
    for (let i = 0; i < 3; i++) await page.keyboard.press("Enter");
    await expect(page.locator("#tipsCount")).toHaveText("3,790");
    expect(await screens(page)).toMatchObject({ focus: "shopCloseBtn", shop: true });
    await page.keyboard.press("Enter");   // Done
    await page.keyboard.press("Enter");   // start
    expect(await screens(page)).toMatchObject({ shop: false, playing: true });
  });

  test("Enter and Space on the Hide maxed toggle flip it and leave the shop open", async ({ page }) => {
    await open(page, { save: { ...RICH, owned: { reach: 3 } }, short: true });
    await page.keyboard.press("Enter");
    await finishRound(page);
    await page.keyboard.press("KeyU");
    await tabTo(page, "#hideMaxedBtn");
    await page.keyboard.press("Enter");
    await expect(page.locator("#hideMaxedBtn")).toHaveText("Show 1 maxed");
    await page.keyboard.press("Space");
    await expect(page.locator("#hideMaxedBtn")).toHaveText("Hide maxed");
    expect(await screens(page)).toMatchObject({ focus: "hideMaxedBtn", shop: true });
  });

  test("buying the last level while maxed rows are hidden moves focus to Done", async ({ page }) => {
    await open(page, { save: RICH, short: true });
    await page.evaluate(() => localStorage.setItem("makeItPourHideMaxed", "on"));
    await page.reload();
    await page.keyboard.press("Enter");
    await finishRound(page);
    await page.keyboard.press("KeyU");
    await tabTo(page, 'button[data-id="reach"]');
    for (let i = 0; i < 3; i++) await page.keyboard.press("Enter");
    await expect(page.locator('button[data-id="reach"]')).toHaveCount(0);
    expect(await screens(page)).toMatchObject({ focus: "shopCloseBtn", shop: true });
  });

  test("I over a Tab-focused Upgrades, then Enter, closes only the info panel", async ({ page }) => {
    await open(page, { short: true });
    await page.keyboard.press("Enter");
    await finishRound(page);
    await tabTo(page, "#shopBtn");
    await page.keyboard.press("KeyI");
    expect(await screens(page)).toMatchObject({ info: true, focus: "infoScreen" });
    await page.keyboard.press("Enter");
    expect(await screens(page)).toMatchObject({ info: false, shop: false, end: true, focus: "shopBtn" });
  });

  test("U over a Tab-focused Share, then Enter, closes only the shop", async ({ page }) => {
    await open(page, { short: true });
    await page.keyboard.press("Enter");
    await finishRound(page);
    await tabTo(page, "#shareBtn");
    await page.keyboard.press("KeyU");
    await page.keyboard.press("Enter");
    expect(await screens(page)).toMatchObject({ shop: false, focus: "shareBtn" });
    await expect(page.locator("#endStatus")).not.toHaveText(/^Copied/);
  });

  test("Tab in the shop never reaches the end-screen buttons it covers", async ({ page }) => {
    await open(page, { save: RICH, short: true });
    await page.keyboard.press("Enter");
    await finishRound(page);
    await page.keyboard.press("KeyU");
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const id = await page.evaluate(() => document.activeElement.id);
      expect(["againBtn", "shopBtn", "shareBtn"]).not.toContain(id);
    }
  });

  test("Tab in the info panel never reaches Play", async ({ page }) => {
    await open(page);
    await page.click("#info");
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement.id)).not.toBe("startBtn");
    }
  });

  test("pause, Tab to Resume, I, Esc: focus returns to Resume and Enter resumes", async ({ page }) => {
    await open(page);
    await page.keyboard.press("Enter");
    await page.keyboard.press("KeyP");
    await tabTo(page, "#resumeBtn");
    await page.keyboard.press("KeyI");
    await page.keyboard.press("Escape");
    expect(await screens(page)).toMatchObject({ paused: true, focus: "resumeBtn" });
    await page.keyboard.press("Enter");
    expect(await screens(page)).toMatchObject({ paused: false, playing: true });
  });

  test("mid-round, Tab to mute and Enter toggles it", async ({ page }) => {
    await open(page);
    await page.keyboard.press("Enter");
    await tabTo(page, "#mute");
    await page.keyboard.press("Enter");
    expect(await screens(page)).toMatchObject({ playing: true, mute: "Unmute" });
  });

  test("a mute button focused mid-round does not take Space at the end screen", async ({ page }) => {
    await open(page, { short: true });
    await page.keyboard.press("Enter");
    await tabTo(page, "#mute");
    await page.keyboard.press("Enter");
    await finishRound(page);
    await page.keyboard.press("Space");
    expect(await screens(page)).toMatchObject({ playing: true, mute: "Unmute" });
  });

  test("Space with a Tab-focused pause button mid-round pours, not pauses", async ({ page }) => {
    await open(page);
    await page.keyboard.press("Enter");
    await tabTo(page, "#pause");
    await page.keyboard.press("Space");
    expect(await screens(page)).toMatchObject({ playing: true, paused: false });
  });

  test("a Tab-pressed Start leaves no focus behind when the round ends", async ({ page }) => {
    await open(page, { short: true });
    await tabTo(page, "#startBtn");
    await page.keyboard.press("Enter");
    await finishRound(page);
    expect(await screens(page)).toMatchObject({ end: true, focus: "BODY" });
  });

  for (const key of ["Shift+F10", "ContextMenu"]) {
    test(key + " on a Tab-focused (i) keeps its focus", async ({ page }) => {
      await open(page);
      await tabTo(page, "#info");
      await page.keyboard.press(key);
      expect((await screens(page)).focus).toBe("info");
    });
  }
});

test.describe("mouse, then keyboard", () => {
  test("click mute, pour on the canvas, then Space at the end starts a round", async ({ page }) => {
    await open(page, { short: true });
    await page.click("#startBtn");
    await page.click("#mute");
    await page.mouse.move(300, 400);
    await page.mouse.down();
    await page.clock.runFor(100);
    await page.mouse.up();
    await finishRound(page);
    await page.keyboard.press("Space");
    expect(await screens(page)).toMatchObject({ playing: true, mute: "Unmute" });
  });

  test("click (i) mid-round, Esc, P, pour, then Space at the end starts a round", async ({ page }) => {
    await open(page, { short: true });
    await page.click("#startBtn");
    await page.click("#info");
    await page.keyboard.press("Escape");
    await page.keyboard.press("KeyP");
    await page.mouse.move(300, 400);
    await page.mouse.down();
    await page.mouse.up();
    await finishRound(page);
    await page.keyboard.press("Space");
    expect(await screens(page)).toMatchObject({ playing: true, info: false });
  });

  test("press mute and drag off, then Space starts a round", async ({ page }) => {
    await open(page);
    const box = await page.locator("#mute").boundingBox();
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(400, 400);
    await page.mouse.up();
    await page.keyboard.press("Space");
    expect(await screens(page)).toMatchObject({ playing: true, mute: "Mute" });
  });

  test("right-click mute, then Space starts a round", async ({ page }) => {
    await open(page);
    await page.click("#mute", { button: "right" });
    await page.keyboard.press("Space");
    expect(await screens(page)).toMatchObject({ playing: true, mute: "Mute" });
  });

  test("click (i), Space closes it, Space starts a round", async ({ page }) => {
    await open(page);
    await page.click("#info");
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    expect(await screens(page)).toMatchObject({ playing: true, info: false });
  });

  test("click inside the info text, then Enter closes it", async ({ page }) => {
    await open(page);
    await page.click("#info");
    await page.click("#infoScreen .panel p");
    await page.keyboard.press("Enter");
    expect(await screens(page)).toMatchObject({ info: false, start: true });
  });

  test("a mouse shop visit with a purchase, then Enter, starts a round", async ({ page }) => {
    await open(page, { save: RICH, short: true });
    await page.keyboard.press("Enter");
    await finishRound(page);
    await page.click("#shopBtn");
    expect((await screens(page)).focus).toBe("BODY");
    await page.click(".up button:not([disabled])");
    await page.click("#shopCloseBtn");
    await page.keyboard.press("Enter");
    expect((await screens(page)).playing).toBe(true);
  });

  test("clicking the shop's backdrop closes it", async ({ page }) => {
    await open(page, { short: true });
    await page.keyboard.press("Enter");
    await finishRound(page);
    await page.click("#shopBtn");
    await page.click("#shopScreen", { position: { x: 5, y: 5 } });
    expect((await screens(page)).shop).toBe(false);
  });

  test("the press style still shows while a button is held", async ({ page }) => {
    await open(page);
    const box = await page.locator("#startBtn").boundingBox();
    await page.mouse.move(box.x + 20, box.y + 10);
    await page.mouse.down();
    expect(await page.evaluate(() => getComputedStyle(document.getElementById("startBtn")).transform))
      .toBe("matrix(1, 0, 0, 1, 0, 2)");
    await page.mouse.up();
  });
});

test.describe("overlays", () => {
  for (const how of ["Space", "Enter", "click"]) {
    test("resuming with " + how + " while the info panel is open closes the panel", async ({ page }) => {
      await open(page);
      await page.keyboard.press("Enter");
      await page.keyboard.press("KeyI");
      if (how === "click") await page.click("#pause");
      else { await tabTo(page, "#pause"); await page.keyboard.press(how); }
      expect(await screens(page)).toMatchObject({ info: false, paused: false, playing: true });
    });
  }

  test("the info panel reopens scrolled to the top", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 500 });
    await open(page);
    await page.click("#info");
    await page.evaluate(() => { document.getElementById("infoScreen").scrollTop = 400; });
    await page.keyboard.press("Escape");
    await page.click("#info");
    expect(await page.evaluate(() => document.getElementById("infoScreen").scrollTop)).toBe(0);
  });

  test("on a phone the info panel's heading starts below the corner buttons", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await open(page);
    await page.click("#info");
    const heading = await page.locator("#infoScreen h2").boundingBox();
    const controls = await page.locator("#controls").boundingBox();
    expect(heading.y).toBeGreaterThanOrEqual(controls.y + controls.height);
  });

  test("on a phone the timer bar is not drawn under the corner buttons", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await open(page);
    await page.keyboard.press("Enter");
    await page.clock.runFor(200);
    const box = await page.locator("#controls").boundingBox();
    // Any bar-coloured pixel in the canvas behind the buttons is the timer running under them.
    const hidden = await page.evaluate(({ x, y, w, h }) => {
      const c = document.getElementById("game");
      const k = c.width / c.getBoundingClientRect().width;
      const d = c.getContext("2d").getImageData(x * k, y * k, w * k, h * k).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 120 && d[i + 1] > 200 && d[i + 2] > 230) n++;
      return n;
    }, { x: box.x, y: box.y, w: box.width, h: box.height });
    expect(hidden).toBe(0);
  });

  test("the info panel opens above the shop", async ({ page }) => {
    await open(page, { short: true });
    await page.keyboard.press("Enter");
    await finishRound(page);
    await page.click("#shopBtn");
    await page.click("#info");
    const top = await page.evaluate(() =>
      document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest(".overlay").id);
    expect(top).toBe("infoScreen");
  });
});
