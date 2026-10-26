import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// build/ contains application icons. Only these disposable output directories
// may be removed, regardless of the shell's current working directory.
const allowed = new Set(['dist', 'release']);
const targets = process.argv.slice(2);
if (!targets.length) targets.push(...allowed);
if (targets.some((target) => !allowed.has(target))) {
  console.error('清理范围只能是 dist 或 release。');
  process.exitCode = 1;
} else {
  for (const target of new Set(targets)) {
    await rm(fileURLToPath(new URL(`../${target}`, import.meta.url)), {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 200,
    });
    console.log(`已清理 ${target}/`);
  }
}
