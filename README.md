# 个人研发效能助手

本地个人工具：工时周报生成、系统参数配置可视化、AI 配置。

- 前端：Angular 19.2 + ng-zorro（`apps/web`）
- 后端：NestJS + **Fastify** + **Prisma**（PostgreSQL，`apps/api`）
- 文档：[docs/CONTEXT.md](docs/CONTEXT.md) · [docs/10001/技术方案.md](docs/10001/技术方案.md) · [docs/10001/系统消化文档.md](docs/10001/系统消化文档.md)

## 环境

- Node.js 20+
- 本机 PostgreSQL 17（已装路径示例 `D:\software\PostgreSQL\17`）
- Windows / macOS / Linux 均可

> 数据库为 Prisma 管理的 **PostgreSQL**。`apps/api/.env` 设置 `DATABASE_URL`（见根目录 `.env.example`）。旧 SQLite 文件若仍在 `apps/data/` 仅作备份，进程不读。Docker Compose 加 postgres 推迟到上云。

## 安装

```bash
cd apps/api
npm install          # postinstall 会 prisma generate
# 可选：npm run db:migrate:dev

cd ../web
npm install
```

本地 API 需要 `DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/assistant`（见 `apps/api/.env` / 根目录 `.env.example`）。未配置则启动失败。首次空库会 seed admin。

## 启动

开两个终端：

```bash
# 终端 1 — API http://localhost:3000
cd apps/api
npm run start:dev

# 终端 2 — Web http://localhost:5173
cd apps/web
npm start
```

浏览器打开 http://localhost:5173

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

nginx 是唯一公网入口，前端静态文件与 `/api`、`/uploads` 同源，因此无需 CORS。API 容器**不映射端口**，仅通过内部网络供 nginx 访问。

```bash
# 1. 生成密钥与管理员密码
cp .env.example .env
openssl rand -base64 48        # 填入 JWT_SECRET，ADMIN_PASS 自行设强密码

# 2. 生成整站 Basic Auth 凭据（在应用登录之外再加一道门）
htpasswd -c deploy/.htpasswd <用户名>

# 3. 放置证书（certbot 签发后）
#    deploy/certs/fullchain.pem
#    deploy/certs/privkey.pem

# 4. 启动
docker compose up -d --build
```

`JWT_SECRET` / `ADMIN_PASS` 在 `NODE_ENV=production` 下缺失会**直接启动失败**，这是刻意设计，避免静默退回开发兜底密钥。

容器启动前会执行 `prisma migrate deploy`。当前 Dockerfile 运行阶段仍拼 sqlite（练习 15 / 上云时再改成 postgres）。本地开发请用本机 PostgreSQL，不要依赖 compose。

### 部署注意事项

- **本地已是 PostgreSQL。** 现有 compose 尚未包含 postgres 服务，上云前不要加 `replicas`。
- **Basic Auth 必须配合 HTTPS**：凭证只是 base64 编码。它同时保护了 `/uploads`（浏览器对 `<img>` 会自动附带同源 Basic 凭证），因此内部系统截图不会对公网裸奔。
- **持久卷务必挂到 `DATA_DIR`（容器内 `/app/data`）** 以保存上传文件。若照旧文档挂仓库根的 `data/`，文件会留在容器可写层，`docker compose down` 即丢且全程不报错。
- nginx 已配 `proxy_buffering off` 与 `proxy_read_timeout 600s`，缺任一项都会让 SSE 流式输出表现为「卡很久后一次性全部出现」或长分析被掐断。
- 上传限制 50MB（`MAX_EXCEL_UPLOAD_BYTES` 与 nginx `client_max_body_size` 需保持一致），仅接受 `.xlsx`。
- 数据库含**明文 API Key**，备份包属敏感物，勿放公开可读的对象存储。
