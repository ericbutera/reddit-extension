const { test, expect } = require('@playwright/test');
const path = require('path');
const { prepareExt, writeImportFile, cleanupFixtures } = require('./helpers/testUtils');

test.beforeAll(() => {
  // Prepare extension assets (copy src -> dist) so tests can load options.html
  prepareExt();
});

test.afterAll(() => {
  // clean up generated fixture files
  cleanupFixtures();
});

const OptionsPage = require('./pages/optionsPage');

test('add a subreddit and save appears in list', async ({ page }) => {
  const options = await OptionsPage.open(page, { subs: [], stats: {} });

  // add a subreddit
  await options.addSub('r/testsub');

  // pending list should show + testsub
  await expect(options.pendingList()).toContainText('+ testsub');

  // save changes
  await options.saveChanges();

  // after save, subsList should contain testsub
  await expect(options.subsList()).toContainText('testsub');
});

test('import file and save imports multiple subs', async ({ page }) => {
  const options = await OptionsPage.open(page, { subs: [], stats: {} });

  // prepare a virtual file with two subs
  const filePath = writeImportFile('r/imported1\nr/imported2', 'import.txt');

  // import via file input helper
  await options.importFile(filePath);

  // the change handler should import and stage them
  await expect(options.pendingList()).toContainText('+ imported1');
  await expect(options.pendingList()).toContainText('+ imported2');

  // save and verify in subs list
  await options.saveChanges();
  await expect(options.subsList()).toContainText('imported1');
  await expect(options.subsList()).toContainText('imported2');
});

test('delete all stages removals and clears on save', async ({ page }) => {
  const options = await OptionsPage.open(page, { subs: ['a', 'b'], stats: {} });

  // click delete all
  await options.deleteAll();
  await expect(options.pendingList()).toContainText('- a');
  await expect(options.pendingList()).toContainText('- b');

  // save and expect subs list empty
  await options.saveChanges();
  await expect(options.subsList()).not.toContainText('a');
  await expect(options.subsList()).not.toContainText('b');
});
