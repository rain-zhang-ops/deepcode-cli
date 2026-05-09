#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

SENTINEL="NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"
TARGET_BIN="dist/deepcode"

echo "[1/7] TypeScript typecheck..."
npm run typecheck

echo "[2/7] Build npm bundle..."
npm run bundle

echo "[3/7] Build SEA bundle..."
npx esbuild src/cli.tsx \
  --bundle --platform=node --format=esm --target=node18 \
  --outfile=dist/cli-full.js \
  --alias:react-devtools-core=./scripts/react-devtools-core-stub.mjs \
  --jsx=automatic --jsx-import-source=react \
  "--banner:js=import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"

echo "[4/7] Generate SEA entry..."
node scripts/gen-sea-entry.mjs

echo "[5/7] Generate SEA blob..."
node --experimental-sea-config sea-config.json --experimental-require-module

echo "[6/7] Inject blob into macOS executable..."
rm -f "$TARGET_BIN"
cp "$(command -v node)" "$TARGET_BIN"
chmod 755 "$TARGET_BIN"
npx --yes postject "$TARGET_BIN" NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse "$SENTINEL" --macho-segment-name NODE_SEA --overwrite

echo "[7/7] Verify executable..."
"$TARGET_BIN" --version

echo "SEA macOS build completed: $TARGET_BIN"