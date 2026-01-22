const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function prepareExt() {
  execSync('npm run prepare-ext', { stdio: 'inherit' });
}

function writeImportFile(contents, filename = 'import.txt') {
  const filePath = path.resolve(__dirname, '..', 'fixtures', filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  return filePath;
}

function cleanupFixtures() {
  const fixturesDir = path.resolve(__dirname, '..', 'fixtures');
  if (fs.existsSync(fixturesDir)) {
    // Node 14+ supports fs.rmSync with recursive; fall back to rmdirSync if not
    if (fs.rmSync) {
      fs.rmSync(fixturesDir, { recursive: true, force: true });
    } else {
      fs.rmdirSync(fixturesDir, { recursive: true });
    }
  }
}

module.exports = { prepareExt, writeImportFile, cleanupFixtures };
