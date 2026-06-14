/**
 * audit_runner.js - CodeInsight automated audit script
 * Run: node audit_runner.js  (from the project root)
 * Saves results to audit/RUNTIME_AUDIT.md
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const BACKEND = join(ROOT, 'backend');
const FRONTEND = join(ROOT, 'frontend');
const REPORT = join(ROOT, 'audit', 'RUNTIME_AUDIT.md');

const results = [];
const log = (msg) => { console.log(msg); results.push(msg); };

// ─── Utilities ────────────────────────────────────────────────────────────────

function httpGet(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function httpPost(url, payload, token = null, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: timeoutMs,
    };
    const lib = urlObj.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Checks ───────────────────────────────────────────────────────────────────

async function checkFiles() {
  log('\n## 1. File System Checks\n');
  const checks = [
    [join(BACKEND, 'node_modules'), 'Backend node_modules'],
    [join(FRONTEND, 'node_modules'), 'Frontend node_modules'],
    [join(BACKEND, '.env'), 'Backend .env'],
    [join(FRONTEND, 'src', 'components', 'Spinner.tsx'), 'Spinner.tsx (correct name)'],
  ];
  for (const [p, label] of checks) {
    const ok = existsSync(p);
    log(`- ${ok ? '✅' : '❌'} ${label}: ${ok ? 'EXISTS' : 'MISSING'}`);
  }
  // Check the old double-dot file
  const badSpinner = existsSync(join(FRONTEND, 'src', 'components', 'Spinner..tsx'));
  log(`- ${badSpinner ? '⚠️  STILL EXISTS (should be deleted)' : '✅ GONE'} Spinner..tsx (typo file)`);

  // Check GEMINI_API_KEY is set
  const env = readFileSync(join(BACKEND, '.env'), 'utf8');
  const geminiLine = env.split('\n').find(l => l.startsWith('GEMINI_API_KEY'));
  const geminiVal = geminiLine?.split('=')[1]?.trim();
  const geminiSet = geminiVal && geminiVal !== 'your_gemini_api_key_here' && geminiVal.length > 10;
  log(`- ${geminiSet ? '✅' : '⚠️  PLACEHOLDER'} GEMINI_API_KEY: ${geminiSet ? 'SET (not shown)' : geminiVal}`);

  const jwtLine = env.split('\n').find(l => l.startsWith('JWT_SECRET'));
  const jwtVal = jwtLine?.split('=')[1]?.trim();
  const jwtWeak = jwtVal?.includes('supersecret') || jwtVal?.includes('replace');
  log(`- ${jwtWeak ? '⚠️  WEAK' : '✅'} JWT_SECRET: ${jwtWeak ? 'Still default placeholder' : 'Custom value set'}`);
}

async function checkPackageJson() {
  log('\n## 2. Package.json Dependency Check\n');
  const pkg = JSON.parse(readFileSync(join(BACKEND, 'package.json'), 'utf8'));
  const required = ['express', 'mongoose', 'jsonwebtoken', 'bcryptjs', 'cors', 'dotenv', '@google/generative-ai', 'express-rate-limit'];
  for (const dep of required) {
    const ok = dep in (pkg.dependencies || {});
    log(`- ${ok ? '✅' : '❌'} backend: ${dep}`);
  }

  const fpkg = JSON.parse(readFileSync(join(FRONTEND, 'package.json'), 'utf8'));
  const freq = ['react', 'react-dom', 'react-router-dom', 'axios', 'tailwindcss', 'lucide-react'];
  for (const dep of freq) {
    const ok = dep in (fpkg.dependencies || {}) || dep in (fpkg.devDependencies || {});
    log(`- ${ok ? '✅' : '❌'} frontend: ${dep}`);
  }
}

let backendProc = null;

async function startBackend() {
  log('\n## 3. Backend Server Start\n');
  return new Promise((resolve) => {
    backendProc = spawn('node', ['server.js'], {
      cwd: BACKEND,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    let started = false;

    backendProc.stdout.on('data', (d) => {
      output += d.toString();
      if (!started && output.includes('Server running on port')) {
        started = true;
        log('- ✅ Backend started successfully');
        log('- Output:\n```\n' + output.trim() + '\n```');
        resolve(true);
      }
    });

    backendProc.stderr.on('data', (d) => {
      output += d.toString();
      if (!started && (output.includes('Error') || output.includes('error'))) {
        // don't resolve yet — might still start
      }
    });

    backendProc.on('exit', (code) => {
      if (!started) {
        log(`- ❌ Backend process exited with code ${code}`);
        log('- Output:\n```\n' + output.trim() + '\n```');
        resolve(false);
      }
    });

    // Timeout after 20s
    setTimeout(() => {
      if (!started) {
        log('- ❌ Backend did not start within 20 seconds');
        log('- Output so far:\n```\n' + output.trim() + '\n```');
        resolve(false);
      }
    }, 20000);
  });
}

async function testBackendRoutes(token) {
  log('\n## 4. API Route Tests\n');

  // Health check
  try {
    const r = await httpGet('http://localhost:5000/');
    log(`- ${r.status === 200 ? '✅' : '❌'} GET / → ${r.status} ${r.body?.message || ''}`);
  } catch (e) { log(`- ❌ GET / → ${e.message}`); }

  // Register new test user
  const testEmail = `audit_${Date.now()}@test.com`;
  let authToken = token;
  try {
    const r = await httpPost('http://localhost:5000/api/auth/register', {
      name: 'Audit Bot',
      email: testEmail,
      password: 'Test@12345',
      targetDailySolved: 2,
    });
    if (r.status === 201 && r.body?.data?.token) {
      authToken = r.body.data.token;
      log(`- ✅ POST /api/auth/register → ${r.status} (token obtained)`);
    } else {
      log(`- ❌ POST /api/auth/register → ${r.status}: ${JSON.stringify(r.body).slice(0,120)}`);
    }
  } catch (e) { log(`- ❌ POST /api/auth/register → ${e.message}`); }

  // Login
  try {
    const r = await httpPost('http://localhost:5000/api/auth/login', {
      email: testEmail,
      password: 'Test@12345',
    });
    if (r.status === 200 && r.body?.data?.token) {
      authToken = r.body.data.token;
      log(`- ✅ POST /api/auth/login → ${r.status} (token refreshed)`);
    } else {
      log(`- ❌ POST /api/auth/login → ${r.status}: ${JSON.stringify(r.body).slice(0,120)}`);
    }
  } catch (e) { log(`- ❌ POST /api/auth/login → ${e.message}`); }

  // GET /api/auth/me (protected)
  if (authToken) {
    try {
      const r = await httpGet('http://localhost:5000/api/auth/me');
      log(`- ${r.status === 401 ? '✅' : '❌'} GET /api/auth/me (no token) → ${r.status} (expected 401)`);
    } catch (e) { log(`- ❌ GET /api/auth/me (no token) → ${e.message}`); }

    // GET /api/auth/me with token
    try {
      const urlObj = new URL('http://localhost:5000/api/auth/me');
      const r = await new Promise((resolve, reject) => {
        const req = http.get({
          hostname: urlObj.hostname, port: urlObj.port || 80, path: urlObj.pathname,
          headers: { Authorization: `Bearer ${authToken}` }, timeout: 8000,
        }, (res) => {
          let d = ''; res.on('data', c => d += c); res.on('end', () => {
            try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
            catch { resolve({ status: res.statusCode, body: d }); }
          });
        });
        req.on('error', reject);
      });
      log(`- ${r.status === 200 ? '✅' : '❌'} GET /api/auth/me (with token) → ${r.status}`);
    } catch (e) { log(`- ❌ GET /api/auth/me (with token) → ${e.message}`); }
  }

  // GET /api/problems (protected)
  if (authToken) {
    try {
      const r = await new Promise((resolve, reject) => {
        const req = http.get({
          hostname: 'localhost', port: 5000, path: '/api/problems',
          headers: { Authorization: `Bearer ${authToken}` }, timeout: 8000,
        }, (res) => {
          let d = ''; res.on('data', c => d += c); res.on('end', () => {
            try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
            catch { resolve({ status: res.statusCode, body: d }); }
          });
        });
        req.on('error', reject);
      });
      log(`- ${r.status === 200 ? '✅' : '❌'} GET /api/problems (with token) → ${r.status}, count: ${r.body?.count ?? '?'}`);
    } catch (e) { log(`- ❌ GET /api/problems → ${e.message}`); }

    // POST /api/problems — create a manual problem
    try {
      const r = await httpPost('http://localhost:5000/api/problems', {
        title: 'Two Sum', difficulty: 'Easy', status: 'Solved',
        category: 'Arrays', notes: 'Use hashmap', timeComplexity: 'O(N)', spaceComplexity: 'O(N)',
      }, authToken);
      log(`- ${r.status === 201 ? '✅' : '❌'} POST /api/problems → ${r.status} (title: ${r.body?.data?.title})`);
    } catch (e) { log(`- ❌ POST /api/problems → ${e.message}`); }
  }

  // Unauthenticated sync (should 401)
  try {
    const r = await httpPost('http://localhost:5000/api/sync', {});
    log(`- ${r.status === 401 ? '✅' : '❌'} POST /api/sync (no token) → ${r.status} (expected 401)`);
  } catch (e) { log(`- ❌ POST /api/sync (no token) → ${e.message}`); }

  // Unauthenticated analytics (should 401)
  try {
    const r = await httpGet('http://localhost:5000/api/analytics/summary');
    log(`- ${r.status === 401 ? '✅' : '❌'} GET /api/analytics/summary (no token) → ${r.status} (expected 401)`);
  } catch (e) { log(`- ❌ GET /api/analytics/summary (no token) → ${e.message}`); }

  return authToken;
}

async function testExtensionEndpoint(token) {
  log('\n## 5. Extension Ingestion Endpoint\n');
  if (!token) { log('- ⚠️  Skipped (no auth token)'); return; }

  // Valid extension submission
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  try {
    const r = await httpPost('http://localhost:5000/api/extensions/leetcode/submission', {
      problemSlug: 'two-sum',
      submissionId: '1234567890',
      title: 'Two Sum',
      verdict: 'Accepted',
      language: 'python3',
      code: 'def twoSum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target-n], i]\n        seen[n] = i',
      submittedAt: new Date().toISOString(),
      _nonce: nonce,
      _ts: Date.now(),
    }, token);
    log(`- ${r.status === 201 || r.status === 200 ? '✅' : '❌'} POST /api/extensions/leetcode/submission → ${r.status}: ${r.body?.message}`);
    if (r.body?.data?.problemId) log(`  - problemId: ${r.body.data.problemId}`);
  } catch (e) { log(`- ❌ Extension POST → ${e.message}`); }

  // Replay attack test (same nonce)
  try {
    const r = await httpPost('http://localhost:5000/api/extensions/leetcode/submission', {
      problemSlug: 'two-sum', submissionId: '1234567890', title: 'Two Sum',
      verdict: 'Accepted', language: 'python3',
      code: 'def twoSum(nums, target): pass',
      submittedAt: new Date().toISOString(),
      _nonce: nonce, _ts: Date.now(),
    }, token);
    log(`- ${r.status === 409 ? '✅' : '❌'} Replay attack (duplicate nonce) → ${r.status} (expected 409)`);
  } catch (e) { log(`- ❌ Replay test → ${e.message}`); }
}

async function testFrontendBuild() {
  log('\n## 6. Frontend TypeScript / Build Check\n');
  try {
    const out = execSync('npx tsc --noEmit 2>&1', { cwd: FRONTEND, timeout: 60000, encoding: 'utf8' });
    if (out.trim().length === 0) {
      log('- ✅ TypeScript: No type errors');
    } else {
      log('- ❌ TypeScript errors:\n```\n' + out.trim().slice(0, 2000) + '\n```');
    }
  } catch (e) {
    log('- ❌ TypeScript check failed:\n```\n' + (e.stdout || e.message || '').slice(0, 2000) + '\n```');
  }
}

async function testFrontendDev() {
  log('\n## 7. Frontend Vite Dev Server\n');
  return new Promise((resolve) => {
    const proc = spawn('npx', ['vite', '--port', '5173', '--host', 'localhost'], {
      cwd: FRONTEND,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let output = '';
    let started = false;

    proc.stdout.on('data', (d) => {
      output += d.toString();
      if (!started && output.includes('Local:') && output.includes('5173')) {
        started = true;
        log('- ✅ Vite dev server started on port 5173');
        log('- Output:\n```\n' + output.trim().slice(0, 500) + '\n```');
        resolve({ started: true, proc });
      }
    });

    proc.stderr.on('data', (d) => { output += d.toString(); });

    proc.on('exit', (code) => {
      if (!started) {
        log(`- ❌ Vite exited with code ${code}`);
        log('- Output:\n```\n' + output.trim().slice(0, 1000) + '\n```');
        resolve({ started: false, proc: null });
      }
    });

    setTimeout(() => {
      if (!started) {
        log('- ❌ Vite did not start within 25 seconds');
        log('- Output:\n```\n' + output.trim().slice(0, 1000) + '\n```');
        proc.kill();
        resolve({ started: false, proc: null });
      }
    }, 25000);
  });
}

async function testFrontendPage() {
  log('\n## 8. Frontend Page Load (HTTP check)\n');
  try {
    const r = await httpGet('http://localhost:5173/');
    const ok = r.status === 200;
    log(`- ${ok ? '✅' : '❌'} GET http://localhost:5173/ → ${r.status}`);
    if (ok && typeof r.body === 'string') {
      const hasReact = r.body.includes('type="module"') || r.body.includes('main.tsx') || r.body.includes('main.jsx') || r.body.includes('src="/src/');
      log(`- ${hasReact ? '✅' : '⚠️'} HTML response contains React module script: ${hasReact}`);
    }
  } catch (e) { log(`- ❌ Frontend page load → ${e.message}`); }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

log('# CodeInsight Runtime Audit\n');
log(`**Run at:** ${new Date().toISOString()}\n`);

await checkFiles();
await checkPackageJson();

const backendStarted = await startBackend();

let authToken = null;
let frontendProc = null;

if (backendStarted) {
  await sleep(2000); // let DB connect
  authToken = await testBackendRoutes(null);
  await testExtensionEndpoint(authToken);
} else {
  log('\n⛔ Backend failed to start — skipping API tests');
}

await testFrontendBuild();
const { started: feStarted, proc: feProc } = await testFrontendDev();
frontendProc = feProc;

if (feStarted) {
  await sleep(2000);
  await testFrontendPage();
}

// ─── Summary ─────────────────────────────────────────────────────────────────
log('\n---\n## Summary\n');
const passCount = results.filter(r => r.includes('✅')).length;
const failCount = results.filter(r => r.includes('❌')).length;
const warnCount = results.filter(r => r.includes('⚠️')).length;
log(`- ✅ Passed: ${passCount}`);
log(`- ❌ Failed: ${failCount}`);
log(`- ⚠️  Warnings: ${warnCount}`);

// Write report
writeFileSync(REPORT, results.join('\n'));
console.log(`\n\n📄 Report written to: ${REPORT}`);

// Cleanup
setTimeout(() => {
  if (backendProc) backendProc.kill();
  if (frontendProc) frontendProc.kill();
  process.exit(0);
}, 500);
