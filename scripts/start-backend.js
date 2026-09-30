#!/usr/bin/env node

/**
 * Intelligent Backend Starter for AERO-SHIELD
 * - Checks if port 8000 is already in use
 * - Reuses healthy running instance instead of throwing [Errno 48]
 * - Detects and cleans up stale/unresponsive processes on port 8000
 * - Detects python3 vs python automatically
 * - Handles working directory properly regardless of invocation directory
 */

import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');

const PORT = 8000;
const HOST = '127.0.0.1';

// Helper: HTTP health check
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

// Helper: Get PID listening on port
function getPortPid(port) {
  try {
    const out = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' }).trim();
    return out ? out.split('\n')[0] : null;
  } catch {
    return null;
  }
}

// Helper: Detect Python executable
function getPythonExecutable() {
  const candidates = ['python3', 'python'];
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch {
      // Continue searching
    }
  }
  return null;
}

export async function startBackend({ keepProcess = true } = {}) {
  const existingPid = getPortPid(PORT);

  if (existingPid) {
    const isHealthy = await checkHealth(`http://${HOST}:${PORT}/health`);
    if (isHealthy) {
      console.log(`\x1b[32m[Backend]\x1b[0m Aero-Shield backend is already running on http://localhost:${PORT} (PID ${existingPid}).`);
      console.log(`\x1b[36m[Backend]\x1b[0m API Docs available at http://localhost:${PORT}/docs`);
      if (keepProcess) {
        // Keep the process waiting so terminal stays open
        return new Promise(() => {});
      }
      return { pid: existingPid, reused: true };
    } else {
      console.warn(`\x1b[33m[Backend]\x1b[0m Port ${PORT} is occupied by unresponsive process (PID ${existingPid}). Cleaning up...`);
      try {
        process.kill(Number(existingPid), 'SIGTERM');
        await new Promise((r) => setTimeout(r, 1000));
        const checkAgain = getPortPid(PORT);
        if (checkAgain) {
          process.kill(Number(checkAgain), 'SIGKILL');
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (err) {
        console.warn(`[Backend] Could not kill process ${existingPid}: ${err.message}`);
      }
    }
  }

  const python = getPythonExecutable();
  if (!python) {
    console.error('\x1b[31m[Backend Error]\x1b[0m Neither python3 nor python was found in PATH.');
    console.error('Please install Python 3 or ensure it is accessible in your environment.');
    process.exit(1);
  }

  console.log(`\x1b[34m[Backend]\x1b[0m Starting FastAPI backend with ${python} in ${BACKEND_DIR}...`);

  const proc = spawn(
    python,
    ['-m', 'uvicorn', 'main:app', '--host', HOST, '--port', String(PORT), '--reload'],
    {
      cwd: BACKEND_DIR,
      stdio: 'inherit',
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    }
  );

  const cleanup = () => {
    if (proc && !proc.killed) {
      console.log('\n\x1b[33m[Backend]\x1b[0m Shutting down backend...');
      proc.kill('SIGINT');
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  proc.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\x1b[31m[Backend]\x1b[0m Backend exited with code ${code}`);
    }
  });

  return proc;
}

// Standalone execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startBackend({ keepProcess: true }).catch((err) => {
    console.error('[Backend Error]', err);
    process.exit(1);
  });
}
