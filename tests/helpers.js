// Shared test helpers: a local server for the game, and a page loader.
//
// The game is served over HTTP rather than file:, because the deploy check only runs
// over HTTP. The same server can misbehave on purpose (hang, drop headers, serve a
// maintenance page...) for the update-check tests.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const GAME = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// /index.html is the real game. /short.html is the same page with 1-second rounds, so a
// test can reach the end screen without waiting a minute.
const SHORT = GAME.replace("const ROUND_TIME = 60;", "const ROUND_TIME = 1;");
if (SHORT === GAME) throw new Error("ROUND_TIME not found - update tests/helpers.js");

// How the server answers the page's once-a-minute deploy checks (requests with ?_=).
// `n` counts those checks; the page's own first load is not one of them.
const MODES = {
  // A plain host: stable ETag, same page every time.
  normal: () => ({ headers: { etag: '"v1"' }, body: GAME }),
  // The second check never finishes.
  hang: (n) => (n === 2 ? "hang" : { headers: { etag: '"v1"' }, body: GAME }),
  // From the second check on, the ETag disappears (a CDN edge or proxy strips it).
  etagDropped: (n) => ({ headers: n >= 2 ? {} : { etag: '"v1"' }, body: GAME }),
  // From the second check on, a 200 maintenance page instead of the game.
  maintenance: (n) => (n >= 2
    ? { headers: {}, body: "<h1>Down for maintenance</h1>" }
    : { headers: { etag: '"v1"' }, body: GAME }),
  // nginx / GitHub Pages: the ETag follows the file's mtime, and a redeploy of identical
  // bytes bumps it.
  mtimeEtag: (n) => ({ headers: { etag: n >= 2 ? '"6502b3c4-10a2b"' : '"6502a1b0-10a2b"' }, body: GAME }),
  // Per-request bytes injected into an unchanged page, under a stable ETag...
  injectedEtag: () => ({ headers: { etag: 'W/"same-deploy"' }, body: inject(GAME) }),
  // ...or under a stable Last-Modified and no ETag.
  injectedModified: () => ({ headers: { "last-modified": "Wed, 23 Sep 2026 03:00:00 GMT" }, body: inject(GAME) }),
  // Real deploys from the third check on, signalled by the body alone...
  deployBody: (n) => ({ headers: {}, body: n >= 3 ? GAME + "<!-- v2 -->" : GAME }),
  // ...by the ETag...
  deployEtag: (n) => ({ headers: { etag: n >= 3 ? '"v2"' : '"v1"' }, body: n >= 3 ? GAME + "<!-- v2 -->" : GAME }),
  // ...by Last-Modified with no ETag...
  deployModified: (n) => ({
    headers: { "last-modified": n >= 3 ? "Wed, 23 Sep 2026 05:00:00 GMT" : "Wed, 23 Sep 2026 03:00:00 GMT" },
    body: n >= 3 ? GAME + "<!-- v2 -->" : GAME
  }),
  // ...and by the ETag, on a host that serves every version with the same fixed timestamp.
  deployFixedTimestamp: (n) => ({
    headers: { "last-modified": "Thu, 01 Jan 1970 00:00:01 GMT", etag: n >= 3 ? '"md5-v2"' : '"md5-v1"' },
    body: n >= 3 ? GAME + "<!-- v2 -->" : GAME
  })
};

function inject(page) {
  return page.replace("</body>", "<script>/* token " + Math.random() + " */</script></body>");
}

// Starts a server on a free port. Returns { base, checks(), close() }.
async function startServer(mode = "normal") {
  const answer = MODES[mode];
  if (!answer) throw new Error("unknown mode " + mode);
  let checks = 0;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/short.html") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(SHORT);
    }
    if (url.pathname !== "/index.html") {
      res.writeHead(404);
      return res.end();
    }
    let reply = { headers: { etag: '"v1"' }, body: GAME };
    if (url.searchParams.has("_")) reply = answer(++checks);
    if (reply === "hang") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.write("<!DOCTYPE");   // and never end
    }
    res.writeHead(200, { "content-type": "text/html", ...reply.headers });
    res.end(reply.body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    base: "http://127.0.0.1:" + port,
    checks: () => checks,
    close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); })
  };
}

// Opens the game with an optional save and a fake clock, and collects page errors.
//   save:  the makeItPourSave object to start from (written once, before the page loads)
//   short: true for 1-second rounds
async function openGame(page, base, { save, short = false } = {}) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (save) {
    await page.addInitScript((s) => {
      if (sessionStorage.getItem("seeded")) return;   // survive reloads without re-seeding
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("makeItPourSave", JSON.stringify(s));
    }, save);
  }
  await page.clock.install();
  await page.goto(base + (short ? "/short.html" : "/index.html"));
  return errors;
}

// A snapshot of which screens are up and where focus is.
function screens(page) {
  return page.evaluate(() => ({
    focus: document.activeElement.id || document.activeElement.tagName,
    start: !document.getElementById("startScreen").hidden,
    end: !document.getElementById("endScreen").hidden,
    shop: !document.getElementById("shopScreen").hidden,
    info: !document.getElementById("infoScreen").hidden,
    paused: !document.getElementById("pauseScreen").hidden,
    playing: !document.getElementById("pause").hidden,
    mute: document.getElementById("mute").title
  }));
}

// Presses Tab until the focused element matches `selector`.
async function tabTo(page, selector) {
  for (let i = 0; i < 30; i++) {
    if (await page.evaluate((s) => document.activeElement.matches(s), selector)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("could not Tab to " + selector);
}

// Plays out a 1-second round (see openGame's `short`).
const finishRound = (page) => page.clock.runFor(3000);

module.exports = { startServer, openGame, screens, tabTo, finishRound, GAME };
