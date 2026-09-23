#!/usr/bin/env node
// Syncs cache-busting `?v=` query hashes with the referenced file contents.
// Usage: node scripts/update-asset-versions.mjs [--check]
// A hash is the first 12 hex chars of the file's SHA-256. Updating one file changes
// the hash of every file that references it, so passes repeat until nothing changes.
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const checkOnly = process.argv.includes('--check');
const sourcePattern = /\.(html|m?js|css)$/;
const referencePattern = /((?:\.{0,2}\/)?[\w./-]+\.[a-z0-9]+)\?v=([0-9a-f]{12})/g;

const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
  if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
  const path = join(dir, entry.name);
  return entry.isDirectory() ? walk(path) : sourcePattern.test(entry.name) ? [path] : [];
});
const hashOf = path => createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12);

const sources = walk(root);
const stale = new Map();
for (let pass = 0; pass < 20; pass++) {
  let changed = false;
  for (const source of sources) {
    const text = readFileSync(source, 'utf8');
    const next = text.replace(referencePattern, (match, path, version) => {
      const target = path.startsWith('/') ? join(root, path) : resolve(dirname(source), path);
      if (!existsSync(target)) return match;
      const current = hashOf(target);
      if (current === version) return match;
      stale.set(`${relative(root, source)} → ${path}`, current);
      return `${path}?v=${current}`;
    });
    if (next !== text) {
      changed = true;
      if (!checkOnly) writeFileSync(source, next);
    }
  }
  if (!changed || checkOnly) break;
}

for (const [reference, version] of stale) console.log(`${checkOnly ? 'stale' : 'updated'}: ${reference} (${version})`);
if (!stale.size) console.log('All asset versions are current.');
if (checkOnly && stale.size) process.exitCode = 1;
