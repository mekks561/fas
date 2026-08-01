#!/usr/bin/env node
/**
 * Negative 类型检查器：确保 tests/types/leaderboard-negative.ts 中的故意错误
 * 一定会被 tsc 捕获到。如果 tsc 不报任何错误 -> 类型防线被突破 -> FAIL
 */
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'tests', 'types', 'leaderboard-negative.ts');

function findTsc() {
  const candidates = [
    path.join(ROOT, 'node_modules', '.bin', 'tsc.cmd'),
    path.join(ROOT, 'node_modules', '.bin', 'tsc'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'tsc';
}

const tsc = findTsc();
const args = [
  '--noEmit',
  '--strict',
  '--target', 'ES2022',
  '--module', 'ESNext',
  '--moduleResolution', 'bundler',
  '--esModuleInterop',
  '--skipLibCheck',
  '--ignoreConfig',
  TARGET,
];

let exitCode = 0;
let stdout = '';
let stderr = '';

if (process.platform === 'win32') {
  const result = spawnSync(tsc, args, { encoding: 'utf8', cwd: ROOT, shell: true });
  stdout = result.stdout;
  stderr = result.stderr;
  exitCode = result.status ?? -1;
} else {
  const result = spawnSync(tsc, args, { encoding: 'utf8', cwd: ROOT });
  stdout = result.stdout;
  stderr = result.stderr;
  exitCode = result.status ?? -1;
}

const combined = (stdout + '\n' + stderr).trim();
const hasOutput = combined.length > 0;

console.log('========== typecheck:leaderboard:negative ==========');
console.log(`tsc exit code: ${exitCode}`);
if (hasOutput) {
  console.log('--- tsc output (captured intentional errors) ---');
  console.log(combined);
  console.log('---------------------------------------------------');
}

if (exitCode !== 0 && hasOutput) {
  console.log('✅ PASS: tsc correctly caught intentional type errors');
  process.exit(0);
} else if (exitCode === 0) {
  console.error('❌ FAIL: tsc exited 0 — type safety line breached! Intentionally bad file did not error.');
  process.exit(1);
} else {
  console.error('❌ FAIL: tsc exited non-zero but produced no output — tsc install may be broken');
  process.exit(2);
}
