const path = require('path');
const fs = require('fs/promises');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyDir(src, dest) {
  await ensureDir(dest);
  await fs.cp(src, dest, { recursive: true, force: true });
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');

  const migrationsSrc = path.join(repoRoot, 'server', 'migrations');
  const migrationsDest = path.join(repoRoot, 'dist', 'migrations');

  const uiSrc = path.join(repoRoot, 'client', 'dist');
  const uiDest = path.join(repoRoot, 'dist', 'public');

  await copyDir(migrationsSrc, migrationsDest);
  await copyDir(uiSrc, uiDest);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
