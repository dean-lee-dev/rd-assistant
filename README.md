# 个人研发效能助手

本地个人工具：工时周报生成、系统参数配置可视化、AI 配置。

- 前端：Angular 19.2 + ng-zorro（`apps/web`）
- 后端：NestJS + **Fastify** + **Prisma**（PostgreSQL，`apps/api`）
- 文档：[docs/CONTEXT.md](docs/CONTEXT.md) · [docs/10001/技术方案.md](docs/10001/技术方案.md) · [docs/10001/系统消化文档.md](docs/10001/系统消化文档.md)

## 环境

- Node.js 20+
- 本机 PostgreSQL 17（已装路径示例 `D:\software\PostgreSQL\17`）
- Windows / macOS / Linux 均可

> 数据库为 Prisma 管理的 **PostgreSQL**。本地用 `apps/api/.env` 的 `DATABASE_URL` 连本机库。旧 SQLite 文件若仍在 `apps/data/` 仅作备份，进程不读。上云用仓库根目录 `.env` + Compose（postgres / redis / api / worker / web）。

## 安装

```bash
cd apps/api
npm install          # postinstall 会 prisma generate
# 可选：npm run db:migrate:dev

cd ../web
npm install
```

本地 API 需要 `apps/api/.env` 中的 `DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/assistant`。未配置则启动失败。首次空库会 seed admin。上云 Compose 用仓库根目录 `.env`（主机名是 `postgres` / `redis`），见下方部署节。

## 启动

本地需要本机 PostgreSQL、本机 Redis，以及三个终端（周报「生成」走队列，必须另开 worker）：

```bash
# 终端 1 — API http://localhost:3000
cd apps/api
npm run start:dev

# 终端 2 — Worker（消费 weekly-report 队列）
cd apps/api
npm run start:worker

# 终端 3 — Web http://localhost:5173
cd apps/web
npm start
```

浏览器打开 http://localhost:5173。只开 API、不开 worker 时，生成周报会一直 queued。

## 默认账号

| 用户名 | 密码 |
|--------|------|
| `admin` | `admin123` |

可在启动前用环境变量覆盖：`ADMIN_USER` / `ADMIN_PASS` / `JWT_SECRET`。

> 上表仅为**开发**兜底值，且登录页只在开发构建下预填（`isDevMode()`）。生产构建密码框为空，且 `JWT_SECRET` / `ADMIN_PASS` 缺失时服务拒绝启动。

## 功能入口

1. **工时周报**：上传工时汇总 Excel → 生成周报（无 AI Key 时仍按任务号规则聚合，AI 字段留空）→ 编辑 → 复制 Markdown / 带格式文本  
2. **系统参数配置**：上传配置 Excel（全量覆盖）→ 表格检索 / 模块统计 → 详情含图片 → AI 分析  
3. **系统配置**：填写 DeepSeek `baseUrl` / `model` / `apiKey`，可测试连接  

## 样例数据

仓库内提供 `data/sample-worktime.xlsx` 可用于快速验证工时导入。

## 数据目录

运行文件默认落在 **`apps/data/`**（`common/paths.ts` 从 `apps/api/{src|dist}/common` 上溯三级得到 `<repo>/apps`），不是仓库根的 `data/`：

```text
apps/data/
  uploads/                  # Excel 提取的图片等
  assistant.prisma.sqlite   # 旧库备份（若仍在；进程不读）
  assistant.sqljs.bak       # 更早的 sql.js 备份（若曾迁移）
data/
  sample-worktime.xlsx      # 仅样例，非运行数据
```

可用 `DATA_DIR` 显式指定上传目录（容器部署即用此方式挂载持久卷）。上述文件默认 gitignore，勿提交真实 API Key。

> 从 SQLite 迁到 PostgreSQL 时**不自动迁移业务数据**；空库启动后仅 seed（admin + 默认 AI 配置），需重新导 Excel / 配 AI Key。

## 部署（单台云主机 + Docker Compose + nginx）

nginx 是唯一公网入口，前端静态文件与 `/api`、`/uploads` 同源，因此无需 CORS。API / postgres / redis **不映射到公网**，只走 Compose 内部网络。公网安全组只开 **22 / 80 / 443**。

服务：`postgres`、`redis`、`api`（migrate + HTTP）、`worker`（`node dist/worker`，不再 migrate）、`web`（nginx）。

本地开发继续 `start:dev`，不要用这套 Compose 当日常环境。

```bash
# 1. 在服务器仓库根目录生成 .env（不要提交）
cp .env.example .env
openssl rand -base64 48        # 填入 JWT_SECRET；ADMIN_PASS / POSTGRES_PASSWORD 自行设强密码
# DATABASE_URL 主机名必须是 postgres，用户/库名与 POSTGRES_* 一致
# REDIS_URL=redis://redis:6379
chmod 600 .env

# 2. 生成整站 Basic Auth 凭据（在应用登录之外再加一道门；必须配 HTTPS）
htpasswd -c deploy/.htpasswd <用户名>

# 3. 放置证书（certbot 签发后）
#    deploy/certs/fullchain.pem
#    deploy/certs/privkey.pem

# 4. 启动（仅 api 容器会 prisma migrate deploy）
docker compose up -d --build
```

`JWT_SECRET` / `ADMIN_PASS` / `DATABASE_URL` / `REDIS_URL` / `POSTGRES_*` 缺失时相关容器会启动失败，这是刻意设计。

空库靠 seed：生产管理员是 `.env` 里的 `ADMIN_USER` / `ADMIN_PASS`，不要用开发兜底 `admin123`。不迁本机业务数据，Excel / AI Key 在云上重新配置。

### 部署注意事项

- **不要加 `replicas`。** 一台机一份 postgres / redis / worker 即可。
- **不要**把 3000、5432、6379 映射到宿主机或安全组。
- 2GB 内存上尽量避免同时 `docker compose build` api+web；4GB 一般可在机上构建。构建仍建议保留少量 swap。
- **Basic Auth 必须配合 HTTPS**：凭证只是 base64 编码。它同时保护了 `/uploads`（浏览器对 `<img>` 会自动附带同源 Basic 凭证）。
- **上传卷**挂 `DATA_DIR`（容器内 `/app/data`，volume `assistant-data`）。**数据库**用独立 volume `pg-data`，不要和上传混在一个目录。
- nginx 已配 `proxy_buffering off` 与 `proxy_read_timeout 600s`，缺任一项都会让 SSE 表现为「卡很久后一次性全部出现」或长分析被掐断。
- 上传限制 50MB（`MAX_EXCEL_UPLOAD_BYTES` 与 nginx `client_max_body_size` 需保持一致），仅接受 `.xlsx`。
- 数据库含**明文 API Key**，备份包属敏感物，勿放公开可读的对象存储。
