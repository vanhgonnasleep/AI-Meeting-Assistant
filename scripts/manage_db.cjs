#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const pyScript = path.resolve(__dirname, 'manage_db.py');
const args = process.argv.slice(2);

// Candidates for python executable
const candidates = [
  'py',
  'python3',
  'python',
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Python', 'bin', 'python.exe') : null
].filter(Boolean);

let spawned = false;
for (const cmd of candidates) {
  try {
    const check = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
    if (check.status === 0) {
      const result = spawnSync(cmd, [pyScript, ...args], { stdio: 'inherit' });
      spawned = true;
      process.exit(result.status || 0);
      break;
    }
  } catch (e) {
    // try next candidate
  }
}

if (!spawned) {
  console.error('[ERROR] Could not locate Python executable (py, python3, or python).');
  process.exit(1);
}
