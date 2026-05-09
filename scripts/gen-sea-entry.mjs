import { readFileSync, writeFileSync } from 'fs';

const code = readFileSync('dist/cli-full.js', 'utf8');
const b64 = Buffer.from(code).toString('base64');

// Write the ESM bundle to a temp file at startup and import it.
// Using a temp file avoids data: URL module resolution issues (bare specifiers
// cannot be resolved relative to a data: base URL in Node.js ESM loader).
// On Windows, use pathToFileURL to avoid the drive letter being treated as a
// URL scheme by the ESM loader.
const wrapper = `'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const b64 = '${b64}';
const code = Buffer.from(b64, 'base64').toString('utf8');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepcode-sea-'));
const tmpFile = path.join(dir, 'index.mjs');
fs.writeFileSync(tmpFile, code, 'utf8');

process.on('exit', () => {
  try { fs.rmSync(dir, { recursive: true }); } catch {}
});

import(pathToFileURL(tmpFile).href).catch((err) => {
  process.stderr.write((err.stack || String(err)) + '\\n');
  process.exitCode = 1;
});
`;

writeFileSync('dist/sea-entry.cjs', wrapper);
console.log('Generated dist/sea-entry.cjs, size:', wrapper.length);
