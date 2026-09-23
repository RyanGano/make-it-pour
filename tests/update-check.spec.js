// The once-a-minute deploy check, against a local server that plays each kind of host.
// A false "There's an update" notice cannot be dismissed and stops the checks, so the
// quiet cases matter as much as the real deploys.
const { test, expect } = require("@playwright/test");
const { startServer, openGame } = require("./helpers");

// Four minutes of checks. The fake clock jumps to each due timer (stepping through every
// animation frame would take far too long). After each jump, wait for the server to see
// the check (up to a few seconds - none arrives once the notice is up, or while a hung
// check is in flight), then give the page a moment to act on the answer.
async function runChecks(page, server, minutes = 4) {
  for (let i = 0; i < minutes; i++) {
    const before = server.checks();
    await page.clock.fastForward(61000);
    for (let t = 0; t < 30 && server.checks() === before; t++) await page.waitForTimeout(100);
    await page.waitForTimeout(250);
  }
}

// A running fake clock keeps ticking in real time, and a jump made while it ticks can be
// lost, which skips a check at random. Pausing it first makes every jump land.
async function pauseClock(page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
}

async function check(page, mode, minutes) {
  const server = await startServer(mode);
  try {
    const errors = await openGame(page, server.base);
    for (let t = 0; t < 30 && server.checks() === 0; t++) await page.waitForTimeout(100);   // the check on load
    await page.waitForTimeout(250);
    await pauseClock(page);
    await runChecks(page, server, minutes);
    const shown = await page.locator("#updateNotice").isVisible();
    expect(errors).toEqual([]);
    return { shown, checks: server.checks() };
  } finally {
    await server.close();
  }
}

const QUIET = {
  normal: "an unchanged page",
  etagDropped: "an ETag that disappears",
  maintenance: "a 200 maintenance page",
  mtimeEtag: "an ETag bumped by a redeploy of identical bytes",
  injectedEtag: "per-request bytes under a stable ETag",
  injectedModified: "per-request bytes under a stable Last-Modified and no ETag"
};

for (const [mode, what] of Object.entries(QUIET)) {
  test("no notice for " + what, async ({ page }) => {
    const { shown, checks } = await check(page, mode);
    expect(shown).toBe(false);
    expect(checks).toBeGreaterThanOrEqual(5);   // the check on load, then one a minute
  });
}

test("checks carry on after one that never finishes", async ({ page }) => {
  // The second check hangs. It is abandoned after 10 seconds, and the minutes around that
  // may be skipped while it winds down, but checking must resume: a checker stalled by
  // the hung request stops at 2.
  const { shown, checks } = await check(page, "hang", 6);
  expect(shown).toBe(false);
  expect(checks).toBeGreaterThanOrEqual(3);
});

const DEPLOYS = {
  deployBody: "a deploy seen only in the page body",
  deployEtag: "a deploy with a new ETag",
  deployModified: "a deploy with a new Last-Modified and no ETag",
  deployFixedTimestamp: "a deploy with a new ETag under a fixed timestamp"
};

for (const [mode, what] of Object.entries(DEPLOYS)) {
  test("notice for " + what, async ({ page }) => {
    const { shown, checks } = await check(page, mode);
    expect(shown).toBe(true);
    expect(checks).toBe(3);   // checks stop once the notice is up
  });
}

test("the refresh button reloads the page", async ({ page }) => {
  const server = await startServer("deployBody");
  try {
    await openGame(page, server.base);
    for (let t = 0; t < 30 && server.checks() === 0; t++) await page.waitForTimeout(100);
    await page.waitForTimeout(250);
    await pauseClock(page);
    await runChecks(page, server);
    await expect(page.locator("#updateNotice")).toBeVisible();
    await Promise.all([page.waitForEvent("load"), page.click("#updateRefresh")]);
  } finally {
    await server.close();
  }
});
