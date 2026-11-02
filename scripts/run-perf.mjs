
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, 'test-lua-perf.mjs');

console.log('Running performance test in a clean environment...');

const child = spawn('node', [scriptPath], { 
  env: {
    // 仅保留最基础的变量，或者干脆为空
    NODE_SKIP_PLATFORM_CHECK: '1'
  },
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code);
});
