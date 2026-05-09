import { copyFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function copyArtifact(from, to) {
  copyFileSync(from, to);
  console.log(`Created release artifact: ${to}`);
}

mkdirSync('dist', { recursive: true });
run('npm run build');

if (process.platform === 'darwin') {
  run('npm run build:mac');
  copyArtifact('dist/deepcode', 'dist/deepcode-mac');
  process.exit(0);
}

if (process.platform === 'win32') {
  run('npm run build:exe');
  copyArtifact('dist/deepcode.exe', 'dist/deepcode-win.exe');
  process.exit(0);
}

if (process.platform === 'linux') {
  console.error('Linux SEA release is not configured yet. Use npm run build for npm package output.');
  process.exit(1);
}

console.error(`Unsupported platform: ${process.platform}`);
process.exit(1);
