const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'manage_db.cjs'), 'utf8');

function runWrapper(spawnSync, root) {
  const exits = [];
  vm.runInNewContext(source, {
    __dirname: path.join(root, 'scripts'),
    require: name => name === 'child_process' ? { spawnSync } : require(name),
    process: { argv: ['node', 'manage_db.cjs', '--status'], env: {}, platform: process.platform,
      exit: status => exits.push(status) },
    console: { error() {} },
  });
  return exits;
}

test('DB commands use the backend venv even when a global Python is available', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clarion-wrapper-'));
  try {
    const venv = path.join(root, 'ai-summary-service', 'venv', process.platform === 'win32' ? 'Scripts' : 'bin',
      process.platform === 'win32' ? 'python.exe' : 'python');
    fs.mkdirSync(path.dirname(venv), { recursive: true });
    fs.writeFileSync(venv, 'interpreter marker');
    const exits = runWrapper((command, args) => ({ status: args[0] === '--version' ? 0 : command === venv ? 23 : 0 }), root);
    assert.deepEqual(exits, [23]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

for (const failure of [{ status: null, error: new Error('launch failed') }, { status: null, signal: 'SIGTERM' }]) {
  test(`DB command fails when Python ${failure.error ? 'cannot launch' : 'is terminated'}`, () => {
    const exits = runWrapper((command, args) => args[0] === '--version' ? { status: 0 } : failure, __dirname);
    assert.deepEqual(exits, [1]);
  });
}
