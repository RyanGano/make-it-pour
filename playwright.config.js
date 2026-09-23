// The game is a single index.html with no build step. These tests drive it in a real
// browser; see "Tests" in the README.
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  fullyParallel: true,
  // On CI, a stray test.only fails the run instead of quietly skipping everything else,
  // and failures are also annotated on the pull request's changed lines.
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
