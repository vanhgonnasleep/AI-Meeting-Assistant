#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

let pyScript = path.resolve(__dirname, 'manage_db.py');
let scriptArgs = process.argv.slice(2);

// If first arg points to a .py script, run that script instead
if (scriptArgs.length > 0 && scriptArgs[0].endsWith('.py')) {
  pyScript = path.resolve(__dirname, scriptArgs[0]);
  scriptArgs = scriptArgs.slice(1);
}

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
      const result = spawnSync(cmd, [pyScript, ...scriptArgs], { stdio: 'inherit' });
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
