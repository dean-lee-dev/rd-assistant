/**
 * API 服务根路径（含 `/api` 前缀）。
 * 同源部署：生产由 nginx 反代 `/api`，本地由 dev-server `proxy.conf.json` 代理到 3000。
 */
export const API_BASE = '/api';

/**
 * 静态资源（上传文件等）访问根路径。
 * 同源部署下为空前缀，后端返回的 `/uploads/...` 可直接使用。
 */
export const UPLOADS_BASE = '';
