// bin/launch.cjs
// Cross-shell launcher: strips ELECTRON_RUN_AS_NODE from the environment so
// the Electron binary boots into GUI mode regardless of the parent shell's state,
// then spawns electron with the project root as the app argument.
delete process.env.ELECTRON_RUN_AS_NODE;

const { spawn } = require('child_process');
const path = require('path');
const electronBin = require('electron');

const projectRoot = path.resolve(__dirname, '..');
const child = spawn(electronBin, [projectRoot], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
