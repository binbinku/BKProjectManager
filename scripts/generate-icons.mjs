import { Resvg } from '@resvg/resvg-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// docs/assets/logo.svg is the single source for UI and native application branding.
const source = await readFile(new URL('../docs/assets/logo.svg', import.meta.url), 'utf8');
const output = new URL('../build/', import.meta.url);
await mkdir(output, { recursive: true });
const macSource = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${source.replace('<svg ', '<svg x="100" y="100" ').replace('width="96" height="96"', 'width="824" height="824"')}</svg>`;
const render = (svg, size) =>
  Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng());

await writeFile(new URL('icon.png', output), render(source, 1024));
await writeFile(new URL('icon-mac.png', output), render(macSource, 1024));

// Windows 11 supports PNG-compressed frames in ICO files. Keep small frames so
// taskbars, shortcuts and installer windows do not have to scale a single image.
const sizes = [16, 24, 32, 48, 64, 128, 256];
const frames = sizes.map((size) => render(source, size));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (const [index, size] of sizes.entries()) {
  const entry = 6 + index * 16;
  header[entry] = header[entry + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frames[index].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frames[index].length;
}
await writeFile(new URL('icon.ico', output), Buffer.concat([header, ...frames]));

// Modern ICNS stores PNG representations, including the 2x Retina variants.
// Encode directly to keep regeneration available on both macOS and Windows.
const representations = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
  ['ic11', 32],
  ['ic12', 64],
  ['ic13', 256],
  ['ic14', 512],
].map(([type, size]) => {
  const png = render(macSource, size);
  const chunk = Buffer.alloc(8);
  chunk.write(type, 0, 'ascii');
  chunk.writeUInt32BE(8 + png.length, 4);
  return Buffer.concat([chunk, png]);
});
const icnsHeader = Buffer.alloc(8);
icnsHeader.write('icns', 0, 'ascii');
icnsHeader.writeUInt32BE(8 + representations.reduce((sum, chunk) => sum + chunk.length, 0), 4);
await writeFile(new URL('icon.icns', output), Buffer.concat([icnsHeader, ...representations]));
console.log('Generated build/icon.png, icon-mac.png, icon.ico and icon.icns from logo.svg.');
