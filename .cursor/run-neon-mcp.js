// Load .env.local from project root so NEON_API_KEY is available
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const key = process.env.NEON_API_KEY;
if (!key || !key.trim()) {
  console.error('NEON_API_KEY not set in .env.local');
  process.exit(1);
}
const { spawn } = require('child_process');
const child = spawn('npx', ['-y', '@neondatabase/mcp-server-neon', 'start', key.trim()], {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '..'),
});
child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code || 0));
