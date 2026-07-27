import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

/** Monorepo root: apps/api/src -> ../../../ */
export const ROOT_DIR = join(__dirname, '..', '..', '..');
export const DATA_DIR = join(ROOT_DIR, 'data');
export const UPLOADS_DIR = join(DATA_DIR, 'uploads');
export const DB_FILE = join(DATA_DIR, 'assistant.sqlite');

export function ensureDataDirs() {
  for (const dir of [DATA_DIR, UPLOADS_DIR, join(UPLOADS_DIR, 'sys-params'), join(UPLOADS_DIR, 'worktime')]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

export const JWT_SECRET = process.env.JWT_SECRET || 'rd-assistant-local-secret';
export const DEFAULT_ADMIN_USER = process.env.ADMIN_USER || 'admin';
export const DEFAULT_ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
