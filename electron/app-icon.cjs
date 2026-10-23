const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execute = promisify(execFile);
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');

function iconPNG(data) {
  if (data.subarray(0, 8).equals(pngSignature)) return data;
  if (data.toString('ascii', 0, 4) !== 'icns') return null;
  const images = [];
  for (let offset = 8; offset + 8 <= data.length;) {
    const length = data.readUInt32BE(offset + 4);
    if (length < 8 || offset + length > data.length) break;
    const image = data.subarray(offset + 8, offset + length);
    if (image.length >= 24 && image.subarray(0, 8).equals(pngSignature))
      images.push({ data: image, width: image.readUInt32BE(16) });
    offset += length;
  }
  images.sort((a, b) => a.width - b.width);
  return (images.find((image) => image.width >= 64) || images.at(-1))?.data || null;
}

async function macAppIcon(bundle) {
  // Read the app's own icon rather than invoking Electron's macOS getFileIcon
  // worker, which crashes on this runtime. plutil also supports binary plists.
  const { stdout } = await execute(
    '/usr/bin/plutil',
    ['-convert', 'json', '-o', '-', path.join(bundle, 'Contents', 'Info.plist')],
    { maxBuffer: 1024 * 1024 },
  );
  const info = JSON.parse(stdout);
  const names = info.CFBundleIcons?.CFBundlePrimaryIcon?.CFBundleIconFiles;
  const name = info.CFBundleIconFile || names?.at(-1);
  if (typeof name !== 'string' || !name) return null;
  const filename = path.basename(name);
  const data = await fs.readFile(
    path.join(
      bundle,
      'Contents',
      'Resources',
      path.extname(filename) ? filename : `${filename}.icns`,
    ),
  );
  const png = iconPNG(data);
  return png ? `data:image/png;base64,${png.toString('base64')}` : null;
}

module.exports = { macAppIcon, iconPNG };
