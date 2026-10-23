import { generateManifest } from 'material-icon-theme';
import { createRequire } from 'node:module';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
const source = path.dirname(require.resolve('material-icon-theme/package.json'));
const output = path.join(root, 'public/material-icon-theme');
const generated = path.join(root, 'src/generated');
const manifest = generateManifest();
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(generated, { recursive: true });
await Promise.all(
  Object.values(manifest.iconDefinitions).map(async (definition) => {
    const filename = path.basename(definition.iconPath);
    await copyFile(path.join(source, 'icons', filename), path.join(output, filename));
    definition.iconPath = filename;
  }),
);
await copyFile(path.join(source, 'LICENSE'), path.join(output, 'LICENSE'));
await writeFile(path.join(generated, 'material-icons.json'), JSON.stringify(manifest));
const metadata = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
console.log(
  `Prepared Material Icon Theme ${metadata.version}: ${Object.keys(manifest.iconDefinitions).length} offline SVG icons.`,
);
