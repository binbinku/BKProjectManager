import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const version = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;
if (process.env.RELEASE_TAG && process.env.RELEASE_TAG !== `v${version}`) {
  throw new Error(`Release tag must match v${version}`);
}
const directory = path.resolve(process.argv[2] || 'release-assets');
const expected = [
  `BKProjectManager-${version}-mac-arm64.dmg`,
  `BKProjectManager-${version}-mac-arm64.zip`,
  `BKProjectManager-${version}-mac-x64.dmg`,
  `BKProjectManager-${version}-mac-x64.zip`,
  `BKProjectManager-${version}-win-x64.exe`,
  `BKProjectManager-${version}-win-x64.zip`,
].sort();
const actual = (await readdir(directory)).filter((name) => name !== 'SHA256SUMS.txt').sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(
    `Unexpected release assets. Expected ${expected.join(', ')}; found ${actual.join(', ')}`,
  );
}
const checksums = [];
for (const name of expected) {
  const file = path.join(directory, name);
  const info = await stat(file);
  if (!info.isFile() || info.size === 0) throw new Error(`Empty or invalid asset: ${name}`);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  checksums.push(`${hash.digest('hex')}  ${name}`);
  console.log(`${name}: ${(info.size / 1024 / 1024).toFixed(1)} MiB`);
}
await writeFile(path.join(directory, 'SHA256SUMS.txt'), checksums.join('\n') + '\n');
console.log('All six release assets verified. SHA256SUMS.txt generated.');
