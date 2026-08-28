#!/usr/bin/env node
/**
 * Fails if client/dist has mutual static import cycles involving vendor-shared
 * with app-shell, app-context, or any plugin-* chunk (ES-module TDZ / white screen).
 *
 * Usage: npm run build:ui   (preferred — vite build then this check)
 *         npm run check:chunk-cycles   (requires existing client/dist)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'client/dist/assets');

if (!fs.existsSync(dir)) {
  console.error('Missing client/dist/assets — run npm run build:ui first');
  process.exit(1);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
const nameOf = (f) => f.replace(/\.[A-Za-z0-9_-]+\.js$/, '');

function staticImports(file) {
  const txt = fs.readFileSync(path.join(dir, file), 'utf8');
  const out = new Set();
  for (const m of txt.matchAll(/import\{[^}]*\}from"\.\/([^"]+\.js)"/g)) {
    out.add(nameOf(m[1]));
  }
  for (const m of txt.matchAll(/import\*\s*as\s+[^ ]+\s+from"\.\/([^"]+\.js)"/g)) {
    out.add(nameOf(m[1]));
  }
  return [...out];
}

const byBase = {};
for (const f of files) byBase[nameOf(f)] = f;

const graph = {};
for (const base of Object.keys(byBase)) {
  graph[base] = staticImports(byBase[base]).filter((t) => byBase[t]);
}

const cycles = [];
for (const a of Object.keys(graph)) {
  for (const b of graph[a] || []) {
    if ((graph[b] || []).includes(a) && a < b) cycles.push([a, b]);
  }
}

function isDodCritical(a, b) {
  const pair = [a, b];
  const hasVendorShared = pair.includes('vendor-shared');
  if (!hasVendorShared) return false;
  return pair.some(
    (x) => x === 'app-shell' || x === 'app-context' || x.startsWith('plugin-'),
  );
}

const critical = cycles.filter(([a, b]) => isDodCritical(a, b));

if (cycles.length) {
  console.log('Mutual chunk cycles:');
  for (const [a, b] of cycles) {
    const mark = isDodCritical(a, b) ? ' CRITICAL' : '';
    console.log(`  ${a} ↔ ${b}${mark}`);
  }
} else {
  console.log('No mutual chunk cycles.');
}

console.log('vendor-shared imports:', graph['vendor-shared'] || []);

if (critical.length) {
  console.error(
    '\nFAIL: vendor-shared must not mutually import app-shell, app-context, or plugin-* (TDZ risk).',
  );
  process.exit(1);
}

console.log('\nOK: no DoD-critical vendor-shared cycles.');
