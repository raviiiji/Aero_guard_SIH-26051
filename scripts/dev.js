#!/usr/bin/env node

/**
 * Unified Development Launcher for AERO-SHIELD
 * - Starts FastAPI backend on http://localhost:8000
 * - Starts Vite frontend on http://localhost:5173
 * - Handles working directory automatically
 * - Handles Ctrl+C gracefully and frees ports cleanly
 */

import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

const BACKEND_PORT = 8000;
const FRONTEND_PORT = 5173;
const HOST = '127.0.0.1';

function checkHealth(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 1500 }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function getPortPid(port) {
  try {
    const out = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' }).trim();
    return out ? out.split('\n')[0] : null;
  } catch {
    return null;
  }
}

function getPythonExecutable() {
  const candidates = ['python3', 'python'];
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch {}
  }
  return null;
}

async function main() {
  console.log('\x1b[1m\x1b[36m===================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m   AERO-SHIELD (SIH DRDO 26051) Dev Server Setup   \x1b[0m');
  console.log('\x1b[1m\x1b[36m===================================================\x1b[0m\n');

  let backendProc = null;
  let frontendProc = null;

  // 1. Check or start Backend
  const backendPid = getPortPid(BACKEND_PORT);
  if (backendPid) {
    const healthy = await checkHealth(`http://${HOST}:${BACKEND_PORT}/health`);
    if (healthy) {
      console.log(`\x1b[32m[Backend]\x1b[0m Already running & healthy at http://${HOST}:${BACKEND_PORT} (PID ${backendPid})`);
    } else {
      console.log(`\x1b[33m[Backend]\x1b[0m Port ${BACKEND_PORT} is locked by unresponsive PID ${backendPid}. Terminating...`);
      try {
        process.kill(Number(backendPid), 'SIGTERM');
        await new Promise((r) => setTimeout(r, 800));
        const check = getPortPid(BACKEND_PORT);
        if (check) process.kill(Number(check), 'SIGKILL');
      } catch (e) {}
    }
  }

  // If backend not running, start it
  if (!getPortPid(BACKEND_PORT)) {
    const python = getPythonExecutable();
    if (!python) {
      console.error('\x1b[31m[Error]\x1b[0m Neither python3 nor python was found in PATH.');
      process.exit(1);
    }
    console.log(`\x1b[34m[Backend]\x1b[0m Starting FastAPI backend using ${python}...`);
    backendProc = spawn(
      python,
      ['-m', 'uvicorn', 'main:app', '--host', HOST, '--port', String(BACKEND_PORT), '--reload'],
      {
        cwd: BACKEND_DIR,
        stdio: 'inherit',
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      }
    );
  }

  // 2. Wait for backend to be ready
  let attempts = 0;
  let ready = false;
  process.stdout.write('\x1b[34m[Backend]\x1b[0m Waiting for backend to become ready');
  while (attempts < 20) {
    if (await checkHealth(`http://${HOST}:${BACKEND_PORT}/health`)) {
      ready = true;
      break;
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 500));
    attempts++;
  }
  process.stdout.write('\n');

  if (ready) {
    console.log(`\x1b[32m[Backend]\x1b[0m Ready!`);
    console.log(`  • API Base URL: \x1b[4mhttp://${HOST}:${BACKEND_PORT}/api\x1b[0m`);
    console.log(`  • Swagger Docs: \x1b[4mhttp://${HOST}:${BACKEND_PORT}/docs\x1b[0m\n`);
  } else {
    console.warn(`\x1b[33m[Backend Warning]\x1b[0m Health check not responded within 10s. Continuing with frontend startup...\n`);
  }

  // 3. Check and clean up any stale frontend dev server on port 5173
  const existingFrontendPid = getPortPid(FRONTEND_PORT);
  if (existingFrontendPid) {
    console.log(`\x1b[33m[Frontend]\x1b[0m Port ${FRONTEND_PORT} is occupied by PID ${existingFrontendPid}. Cleaning up duplicate/stale instance...`);
    try {
      process.kill(Number(existingFrontendPid), 'SIGTERM');
      await new Promise((r) => setTimeout(r, 600));
      const check = getPortPid(FRONTEND_PORT);
      if (check) process.kill(Number(check), 'SIGKILL');
    } catch (e) {}
  }

  // 4. Start Frontend
  console.log(`\x1b[35m[Frontend]\x1b[0m Starting Vite dev server on port ${FRONTEND_PORT} in ${FRONTEND_DIR}...`);
  frontendProc = spawn('npm', ['run', 'dev'], {
    cwd: FRONTEND_DIR,
    stdio: 'inherit',
  });

  // 4. Handle process termination
  const cleanup = () => {
    console.log('\n\x1b[33m[Dev Server]\x1b[0m Stopping dev processes cleanly...');
    if (frontendProc && !frontendProc.killed) {
      frontendProc.kill('SIGINT');
    }
    if (backendProc && !backendProc.killed) {
      backendProc.kill('SIGINT');
    }
    setTimeout(() => process.exit(0), 500);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  frontendProc.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`[Frontend] Vite exited with code ${code}`);
    }
    cleanup();
  });
}

main().catch((err) => {
  console.error('[Dev Launcher Error]', err);
  process.exit(1);
});
