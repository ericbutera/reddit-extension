const path = require('path');
const { injectChromeMock } = require('../helpers/chromeMock');

class OptionsPage {
  constructor(page) {
    this.page = page;
  }

  static async open(page, initialState = { subs: [], stats: {} }) {
    // inject chrome mock and navigate to options page
    await injectChromeMock(page, initialState);
    // pages/ -> playwright/ -> tests/ -> repo root; need to go up three levels to reach repo root
    const optionsPath = path.resolve(__dirname, '../../../dist/options.html');
    await page.goto('file://' + optionsPath);
    await page.waitForSelector('body');
    return new OptionsPage(page);
  }

  // Locators
  subsList() {
    return this.page.locator('#subsList');
  }

  pendingList() {
    return this.page.locator('#pendingList');
  }

  addInput() {
    return this.page.locator('#addInput');
  }

  fileInput() {
    return this.page.locator('#file');
  }

  // Actions
  async addSub(text) {
    await this.addInput().fill(text);
    await this.page.click('#addBtn');
  }

  async saveChanges() {
    await this.page.click('#saveChanges');
    await this.page.waitForTimeout(200);
  }

  async importFile(filePath) {
    await this.fileInput().setInputFiles(filePath);
    await this.page.waitForTimeout(200);
  }

  async deleteAll() {
    await this.page.click('#deleteAll');
    await this.page.waitForTimeout(200);
  }

  // Helpers for assertions
  async pendingContains(text) {
    const txt = await this.pendingList().innerText().catch(() => '');
    return txt.includes(text);
  }

  async subsContains(text) {
    const txt = await this.subsList().innerText().catch(() => '');
    return txt.includes(text);
  }
}

module.exports = OptionsPage;
