import { join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * 本文件所在目录为 `apps/api/{src|dist}/common`，上溯三级得到 `<repo>/apps`。
 * 因此未显式配置时，运行数据目录是 `<repo>/apps/data`（不是仓库根的 `data/`）。
 */
export const ROOT_DIR = join(__dirname, '..', '..', '..');

const isProd = process.env.NODE_ENV === 'production';

/**
 * 读取必需的环境变量。
 * 生产环境缺失时直接抛错阻止启动，避免静默退回开发兜底值（如公开的 JWT 密钥）。
 *
 * @param name 环境变量名
 * @param devFallback 仅开发环境使用的兜底值
 * @throws {Error} 生产环境下变量缺失
 */
function requiredEnv(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd) {
    throw new Error(
      `生产环境缺少必需的环境变量 ${name}，请在部署环境显式配置（不允许使用开发兜底值）`,
    );
  }
  return devFallback;
}

/**
 * 运行数据目录（sqlite + uploads）。
 * 容器部署须设 `DATA_DIR`（如 `/app/data`）并挂载持久卷；不设时保持本地历史路径不变。
 */
export const DATA_DIR = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : join(ROOT_DIR, 'data');
export const UPLOADS_DIR = join(DATA_DIR, 'uploads');
/** Prisma SQLite 文件（相对 prisma/schema 的 DATABASE_URL 默认指向同路径） */
export const DB_FILE = join(DATA_DIR, 'assistant.prisma.sqlite');

/**
 * 未显式配置时，把 DATABASE_URL 指到 DATA_DIR 下的 SQLite 文件。
 * Prisma CLI 仍读 apps/api/.env；运行时 Nest 用此兜底，便于 Docker 设 DATA_DIR。
 */
export function ensureDatabaseUrl(): void {
  if (!process.env.DATABASE_URL) {
    // Prisma file URL：正斜杠；Windows 绝对路径需 file:///C:/...
    const normalized = DB_FILE.replace(/\\/g, '/');
    const url = normalized.startsWith('/')
      ? `file:${normalized}`
      : `file:///${normalized}`;
    process.env.DATABASE_URL = url;
  }
}

export function ensureDataDirs() {
  ensureDatabaseUrl();
  for (const dir of [DATA_DIR, UPLOADS_DIR, join(UPLOADS_DIR, 'sys-params'), join(UPLOADS_DIR, 'worktime'), join(UPLOADS_DIR, 'files')]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

export const JWT_SECRET = requiredEnv('JWT_SECRET', 'rd-assistant-local-secret');
export const DEFAULT_ADMIN_USER = process.env.ADMIN_USER || 'admin';
export const DEFAULT_ADMIN_PASS = requiredEnv('ADMIN_PASS', 'admin123');
