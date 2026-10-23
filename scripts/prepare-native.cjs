const fs = require('node:fs');
const path = require('node:path');

function prepareNative() {
  const directory = path.dirname(require.resolve('node-pty/package.json'));
  // npm's distributed helpers may lack executable permissions. Fix them before
  // copying into a read-only/signed app bundle, on every supported macOS arch.
  for (const architecture of ['darwin-arm64', 'darwin-x64']) {
    const helper = path.join(directory, 'prebuilds', architecture, 'spawn-helper');
    if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755);
  }
}

module.exports = prepareNative;
if (require.main === module) prepareNative();
