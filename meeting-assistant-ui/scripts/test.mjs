import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findTests(path);
    return /\.test\.(?:js|cjs|mjs)$/.test(entry.name) ? [path] : [];
  });
}

// Explicit filenames work on Node 20+ and Windows without shell glob expansion.
const tests = [...findTests(join(root, 'src')), ...findTests(resolve(root, '../scripts'))].sort();
const result = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...tests], {
  cwd: root,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
