/** Playwright config for simple extension smoke tests */
module.exports = {
  testDir: 'tests/playwright',
  timeout: 30_000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
};
