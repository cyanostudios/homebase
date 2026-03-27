// scripts/check-tenant-guards.js
// Guardrails for tenant/public schema safety in runtime code.

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_DIRS = ['server', 'plugins', 'packages'];
const EXTRA_FILES = ['plugin-loader.js'];
const CODE_EXT = new Set(['.js', '.ts']);

const ALLOW_SET_SEARCH_PATH = new Set(['server/index.ts']);

const SEARCH_PATH_RE = /SET\s+search_path\s+TO/gi;
const UNQUALIFIED_AUTH_RE =
  /\b(FROM|JOIN|INTO|UPDATE|DELETE\s+FROM)\s+(?!public\.)(users|tenants|tenant_memberships|tenant_plugin_access|user_settings|user_mfa|sessions)\b/gi;

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (
        ['node_modules', '.git', 'dist', 'client', 'docs', 'mcps', '.cursor'].includes(entry.name)
      ) {
        continue;
      }
      walk(full, out);
      continue;
    }
    if (!CODE_EXT.has(path.extname(entry.name))) continue;
    out.push(rel);
  }
}

function collectFiles() {
  const files = [];
  for (const dir of TARGET_DIRS) {
    const abs = path.join(ROOT, dir);
    if (fs.existsSync(abs)) walk(abs, files);
  }
  for (const extra of EXTRA_FILES) {
    const abs = path.join(ROOT, extra);
    if (fs.existsSync(abs)) files.push(extra);
  }
  return files;
}

function main() {
  const files = collectFiles();
  const failures = [];

  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    const content = fs.readFileSync(abs, 'utf8');
    const scanContent = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    if (!ALLOW_SET_SEARCH_PATH.has(rel) && SEARCH_PATH_RE.test(scanContent)) {
      failures.push(`${rel}: contains forbidden session-level 'SET search_path TO'`);
    }
    SEARCH_PATH_RE.lastIndex = 0;

    let match;
    while ((match = UNQUALIFIED_AUTH_RE.exec(scanContent)) !== null) {
      const snippet = match[0].replace(/\s+/g, ' ').trim();
      failures.push(`${rel}: unqualified auth table reference '${snippet}'`);
    }
    UNQUALIFIED_AUTH_RE.lastIndex = 0;
  }

  if (failures.length) {
    console.error('Tenant guardrail check failed:\n');
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }

  console.log('Tenant guardrail check passed.');
}

main();
