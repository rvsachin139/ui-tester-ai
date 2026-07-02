import { mkdirSync, existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';

const SESSIONS_DIR = join(process.cwd(), '..', 'sessions');

export function createSession(name?: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const folderName = name ? `${timestamp}-${name.replace(/[^a-zA-Z0-9_-]/g, '_')}` : timestamp;
  const sessionDir = join(SESSIONS_DIR, folderName);
  const screenshotDir = join(sessionDir, 'screenshots');
  const reportDir = join(sessionDir, 'reports');
  mkdirSync(screenshotDir, { recursive: true });
  mkdirSync(reportDir, { recursive: true });
  return { sessionDir, screenshotDir, reportDir, folderName };
}

export function clearAllSessions() {
  if (existsSync(SESSIONS_DIR)) {
    for (const e of readdirSync(SESSIONS_DIR)) {
      rmSync(join(SESSIONS_DIR, e), { recursive: true, force: true });
    }
  }
}
