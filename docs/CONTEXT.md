# 个人研发效能助手 — 跨对话上下文

> **给后续 Agent / 新对话**：开场先读本文件，再读 `docs/10001/技术方案.md`；若要对照代码消化全系统，读 [系统消化文档.md](./10001/系统消化文档.md)。  
> **维护约定**：每次对话只要产生需求变更、技术决策、实现进度、学习练习或待办变化，必须在结束前更新本文件（追加「变更日志」并改相关小节）。用户明确要求：**每次互动都要提炼进 CONTEXT**。

## 项目标识

| 项 | 值 |
|----|------|
| 工作区 | `d:\工作\code\assistant` |
| Git | 已 `git init -b master`；单人开发 |
| featId | `10001` |
| 技术方案 | [docs/10001/技术方案.md](./10001/技术方案.md) |
| 系统消化文档 | [docs/10001/系统消化文档.md](./10001/系统消化文档.md) |

## 一句话目标

本地可运行的个人研发效能 Web：登录后，(1) 工时 Excel → AI 周报；(2) 配置洞察（参数 Excel → 可检索可视化表 + AI 分析/对话）；(3) AI/系统配置。Angular 19.2 + ng-zorro + NestJS Fastify + Prisma SQLite。

## 已确认决策（勿再追问除非用户改口）

1. Monorepo：`apps/web` + `apps/api` 目录分离。
2. 登录：单用户，预置管理员，无注册。
3. 工时周报：只吃本地 Excel；表头自动识别；不要版本标签；不接 Worktile。
4. 缺陷归类：Excel「任务类型」列。
5. 不按自然周切分：整次导入生成一份周报。
6. 周报可编辑；复制富文本 + Markdown；AI 字段失败则空。
7. 配置洞察（原系统参数）：物理行、空/重复 key、Excel 行号、全量覆盖、提图；AI 支持全量/多选整行分析 + 右侧对话；分析与对话均为 Markdown 预览 + SSE 流式。
8. AI：DeepSeek 兼容协议，Key 存服务端；chat/completions 支持 stream。
9. DB：**Prisma + SQLite 文件** `apps/data/assistant.prisma.sqlite`（已弃用 sql.js/TypeORM；旧库备份为 `assistant.sqljs.bak`，**不自动迁业务数据**，启动仅 seed）。
10. 文件本地存储。
11. 工时 ai小助手对话：Markdown 渲染 + SSE 流式。
12. **（2026-07-29）部署形态：单台云主机 + Docker Compose + nginx 反代，前端静态文件同源托管。**
13. **（2026-08-07）DB 演进：当前 Prisma SQLite；上云后再切 PostgreSQL。HTTP 层为 Nest Fastify。**  
    **（2026-08-19）本机已装 PostgreSQL 17.11**，目录 `D:\software\PostgreSQL\17`（`bin\psql.exe`）。迁库仍走练习 14–15，**尚未改 schema / 不迁旧 SQLite 业务数据**。
14. **（2026-07-29）上线原则：只做「影响上线部署」的改动，且所有改动必须兼容本地运行（默认值保持现状，靠环境变量/`isDevMode()` 区分）。**

> ⚠️ **运维建议（Prisma SQLite 期间）**：仍建议单实例（并发写友好度有限）。compose 勿加 `replicas`；多实例等迁 PG。

## 当前状态

| 维度 | 状态 |
|------|------|
| 需求澄清 | 已完成 |
| 技术方案 | 已完成 |
| 代码实现 | **MVP 已落地**；2026-07-29 上云改造；**2026-08-07 底层迁 Prisma SQLite + Nest Fastify** |
| 部署就绪 | 产物齐备（Dockerfile×2 / compose / nginx.conf）；待服务器侧配证书与 `.htpasswd` |
| 默认管理员 | `admin` / `admin123`（见 README） |
| 联调 | 登录、工时导入、规则周报生成已用样例验证；AI 需自行配置 Key |

## 目录

```text
apps/web/          Angular 19.2 + ng-zorro
apps/api/          NestJS Fastify + Prisma
apps/data/         ★ 真实运行数据：assistant.prisma.sqlite + uploads/
data/              仅 sample-worktime.xlsx + .gitkeep（非运行数据）
docs/10001/技术方案.md
docs/10001/系统消化文档.md
docs/CONTEXT.md
README.md
```

> ⚠️ **数据目录易错点**：`common/paths.ts` 的 `ROOT_DIR = join(__dirname,'..','..','..')` 从 `apps/api/src/common` 上溯三级实际落在 `<repo>/apps`，故运行数据在 **`apps/data/`**，不是根目录 `data/`。DB 文件现为 `assistant.prisma.sqlite`；`DATABASE_URL` 未设时由 `ensureDatabaseUrl()` 按 `DATA_DIR` 拼出。配置持久卷时若挂错目录，数据留在容器可写层，`docker compose down` 即丢且全程不报错。

## 菜单与路由

- `/login`
- `/weekly-report`（工时周报）
- `/system-config-params`（配置洞察）
- `/settings`（系统配置）

## 实现进度清单

- [x] Monorepo 骨架 + README 本地启动
- [x] 鉴权（预置 admin + JWT）+ Layout 三菜单
- [x] AI 配置读写 + DeepSeek 代理
- [x] 工时 Excel 导入解析（任务号/任务类型等）
- [x] 周报生成（规则聚合 + AI）+ 编辑 + 双复制
- [x] 配置洞察导入（物理行、图片、全量覆盖）
- [x] 参数表查询/过滤/详情 + 模块视图
- [x] 参数 AI 分析（全部/多选整行）+ 右侧自由对话

## 上线改动清单（2026-07-29 收窄版，按「只改影响部署的 + 兼容本地」原则）

### 关键前提：nginx 整站 Basic Auth

在 nginx server 块加 `auth_basic` + `auth_basic_user_file`。零代码改动、不影响本地，一举兜住：`/uploads` 公网裸奔、伪造 JWT 摸到登录接口、AI 接口被外人刷 token、上传 DoS。
**对 `<img>` 有效**（浏览器同源自动附带 Basic 凭证，图片不裂）——这正是它优于「给 `/uploads` 套 JwtAuthGuard」的原因，后者会让详情弹框全裂图。前提：必须 HTTPS。

### 必须改代码（3 项，均保持本地行为不变）— ✅ 已完成

- [x] **数据目录环境化**（`common/paths.ts`）：`DATA_DIR` 支持环境变量，未设时仍为 `<repo>/apps/data`，本地行为不变。
- [x] **前端改相对路径**：`API_BASE='/api'`、`UPLOADS_BASE=''`；新增 `apps/web/proxy.conf.json`，`angular.json` serve 挂 `proxyConfig`。
  - 附带收益：本地亦为同源 → **CORS 未改动**，`main.ts` 的 `enableCors` 保留无害。
  - 已验证：`5173/` → 200、`5173/api/auth/me` → 401（经代理），`3000` 直连 → 401。
- [x] **密钥生产强制、开发兜底**：`requiredEnv()` 在 `NODE_ENV=production` 缺失时抛错；登录页预填改 `isDevMode()`。
  - 已验证：生产模式缺 `JWT_SECRET` 时 exit 1，且在触碰数据库前退出。

### 必须做配置（不动代码）— ✅ 已完成

- [x] **nginx**（`deploy/nginx.conf`）：`proxy_buffering off` + `proxy_cache off` + `proxy_read_timeout/send_timeout 600s`；SPA `try_files`；整站 `auth_basic`；`client_max_body_size 50m`；80 → 443 跳转与 ACME 挑战路径。
- [x] **`.dockerignore`**：排除 `apps/data`、`data`、`node_modules`、`.git`、`.env`、`deploy/.htpasswd`、`deploy/certs`。
- [x] **compose**（`docker-compose.yml`）：api **不声明 `ports`**；`TZ=Asia/Shanghai`；命名卷挂 `/app/data`；`JWT_SECRET`/`ADMIN_PASS` 用 `${VAR:?}` 强制。
- [x] **Dockerfile ×2**：api 多阶段（构建阶段装 python3/make/g++ 供 bcrypt 回退编译，`npm prune --omit=dev` 后复制 node_modules，避免运行阶段二次安装）；web 构建后交 `nginx:1.27-alpine`（产物路径 `dist/web/browser`，已确认）。
- [x] `.env.example`；`.gitignore` 补 `deploy/.htpasswd`、`deploy/certs/`。
- [ ] HTTPS 证书（需在服务器上用 certbot 签发并放入 `deploy/certs/`，本地无法代办）。

### 建议顺手做 — ✅ 已完成

- [x] **导入事务**（`sys-params.service.ts`）：现为 `prisma.$transaction` 内 `deleteMany` + `createMany`；失败时 `rmSync` 清理本次新建的图片目录。
- [x] **上传 limits**（`common/upload.ts`）：50MB + 仅 `.xlsx`（Fastify multipart + `readExcelUpload`）；超限映射为 400 中文提示。

### 明确推迟

Prisma SQLite → PostgreSQL、`/uploads` 签名 URL（Basic Auth 暂兜）、AI 限流、AI HTML 消毒、周报对话 `taskName` bug、导入图片目录清理。

> ⚠️ 推迟项中 **「分析行数上限」有自伤风险**：Basic Auth 挡不住自己手滑点全量分析，单次即数万 token。

## 待修问题（2026-07-29 代码评审；优先级已按上云重排，见上方清单）

> 详细分析见当次对话；以下为核对源码后确认成立的问题，非纸面推测。

**P0（数据/正确性，建议先修）**

1. `worktime.service.ts` `chatStream` 拼上下文取 `r.taskName`（不存在字段，实际为 `taskTitle`/`requirementName`），且取 `remark` 而非 `description` → 周报对话的工时明细上下文近乎空壳。
   - **实现约束**：`description` 是正文主体，补进去会让输入膨胀一两个数量级，而输入侧目前无任何截断（`maxTokens: 2048` 只限输出）。必须与 P1-5 的 token 预算一起做，否则可能撞上游 context length。
2. `sys-params.service.ts` 导入为 `clear()` + `save()` **无事务**，save 失败即整表数据永久丢失；违反技术方案 §7「事务 + 回滚」约定。
   - **已查证可行**：`SqljsQueryRunner` 仅在最外层 `commitTransaction` 与 `release` 时 `flush()`→`autoSave()`，普通 query 只置 `isDirty`；故事务中间态不落盘，回滚后 release 写回的是已恢复的旧数据。`clearTable` 对 sqlite 是 `DELETE FROM`（TypeORM 注释中的 TRUNCATE 说明不适用），可回滚。
   - **陷阱**：必须用事务的 EntityManager（`em.clear(SysParam)`）；沿用注入的 `this.params.clear()` 会走独立 queryRunner，脱离事务并立即落盘，原子性静默失效。
   - 副作用：图片已 `writeFileSync` 落盘，回滚不删除 → 孤儿目录（既有债，会更显眼）。
   - 验证方式：备份 sqlite 后，在 `save` 前故意抛异常，确认旧数据仍在。
3. `optimizeSection` 返回的 AI HTML 未消毒，经 `syncRichBoxes` 直接 `innerHTML=` 写入 contenteditable（Markdown 路径有 DOMPurify，HTML 路径漏了）。
   - **实现约束**：只能在 optimize 响应回填处消毒一次。放进 `syncRichBoxes`（`ngAfterViewChecked` 每轮都跑）会反复吃掉用户在 contenteditable 手工编辑产生的标记，表现为「编辑时格式莫名丢失」。
   - 白名单需显式对齐 `tasksToHtml` 产出（`p`/`strong`/`ol`/`ul`/`li`/`br`/`em`/`span` + `style`），勿直接套 `MdViewComponent` 的 `USE_PROFILES`，否则损伤「复制富文本保留层级」这一核心价值。建议前端消毒（后端需引 jsdom）。
4. 上传无 `limits`/扩展名校验；`app.listen(3000)` 实际监听 `0.0.0.0`（技术方案 §9.4 承诺仅 localhost）。
   - **改动前须确认访问方式**：若从 WSL/容器/其它设备访问，绑 `127.0.0.1` 会立即不可用。写成 `process.env.HOST ?? '127.0.0.1'`，勿硬编码。
   - 扩展名校验放在 `decodeMulterFilename` 之后（中文名 latin1 态易误判）；`fileSize` 建议 50MB（带内嵌图的参数 Excel 很大），并把 multer 超限异常映射为中文提示（默认抛 500）。

**P1（结构限制）**

5. 分析侧 Prompt 无 token 预算：`prepareAnalyze` 全量 `raw` 一次性注入，对话侧有 `slice(0,80)` 而分析侧无截断。
6. `latest()` import/report 各取最新一条，不保证配对。
7. 前端无 API Service 层，URL 散落组件；`API_BASE` 硬编码；`sys-params.component.ts` 789 行需拆分。

**P2（有外部使用需求再做）**

8. sql.js + `autoSave` 全量非原子重写整个 DB，无并发控制 → 迁 PG 或 `better-sqlite3` 可一并解决。
9. `synchronize: true` 无 migration；改密未做。
10. 零测试，且 `apps/api/test/app.e2e-spec.ts` 断言 `GET /` 返回 `Hello World!`（无根控制器）必然失败。建议先补纯函数单测：`buildColumnMap` / `parseDescriptionDetails` / `aggregateByRules`。

## 文档与实现偏差（待同步）

- 技术方案 §3.2 / §4.4 仍写完整六段周报；实际 `goalRate` / `summary` / `nextWeekIdeas` / `needsHelp` 被 `generateReport` 硬编码为 `''`，prompt 明确不生成，前端模板也不渲染（源于 07-27 15:25「仅保留完成工作+下周计划」决策，未回写方案）。
- 技术方案 §9.4 三条安全约定仅「Key 打码」落地，「上传限制」「仅监听 localhost」未实现。

## 已知注意点

- 工时/参数 Excel 靠表头别名映射，勿写死列号。
- 无 AI Key 时周报仍可按任务号规则生成，AI 字段为空并提示。
- Excel 内嵌图提取依赖 exceljs 锚点，失败不阻断整表。
- 复制富文本写 `text/html` + `text/plain`。
- API 默认 `http://localhost:3000`，Web `http://localhost:5173`。
- 菜单「配置洞察」= 原「系统参数配置」。
- 前端组件用 `templateUrl` / `styleUrl` 外提 html/scss；不写显式 `standalone: true`（Angular 19 默认）。
- SSE 流式统一走 `SseClient`（`apps/web/src/app/shared/sse-client.service.ts`）+ `HttpClient`，鉴权靠 `authInterceptor`，勿再手写 `fetch`。
- Markdown 预览复用 `MdViewComponent`（`marked` + `dompurify`）。

## 变更日志

| 时间 | 摘要 |
|------|------|
| 2026-08-07 16:35 | 学习：`main.ts` 的 `bootstrap()` 是 NestJS CLI 官方脚手架约定入口（非语言标准），`async` 启动 + 顶层调用。 |
| 2026-07-27 13:40 | 初始化 git；确认需求；技术方案 `10001`；CONTEXT。 |
| 2026-07-27 14:20 | MVP 实现：Nest API + Angular 三页；sql.js；样例工时导入/规则周报验证通过；README 启动说明。 |
| 2026-07-27 14:26 | 前端端口由 4200 改为 **5173**（CORS 同步）。 |
| 2026-07-27 14:38 | 3000 端口被旧 API 占用导致 EADDRINUSE；已结束 PID 39172。 |
| 2026-07-27 14:50 | 系统参数页：模块标签汇总改为 ECharts 柱状图 + 饼图；点击可筛选。 |
| 2026-07-27 14:55 | 系统参数页拆为三 Tab：表格模式 / 汇总模式 / AI 分析；图表点击跳转对应模块表格。 |
| 2026-07-27 14:58 | 表格详情改为独立「详情」列 + Modal，去掉行点击抽屉。 |
| 2026-07-27 15:02 | 修复详情 Modal 空白（补 *nzModalContent）；字段异常仅在对应 cell 提示，不阻塞弹框。 |
| 2026-07-27 15:05 | 详情弹框限制高度，内容在弹框内部滚动，避免整页滚动。 |
| 2026-07-27 15:06 | 详情「原始字段」隐藏空值行，减少无信息列占用。 |
| 2026-07-27 15:08 | 表格模式开启分页（默认 20 条，可切换每页条数），修复只显示前 10 条。 |
| 2026-07-27 15:15 | 工时周报改为图2式汇总展示；新增可多轮的 AI 周报对话（含快捷追问）。 |
| 2026-07-27 15:25 | 周报按任务标识+需求名称/缺陷规则聚合；仅保留完成工作+下周计划富文本；左右并排 AI 对话。 |
| 2026-07-27 15:32 | 明细行首编号剥离；支持本周完成/下周计划分别导出 Markdown 与富文本。 |
| 2026-07-27 15:37 | 分区导出不再附带「本周完成工作/下周工作计划」大标题。 |
| 2026-07-27 15:48 | 本周完成/下周计划支持「原始 / AI 润色」切换，可一键生成 AI 润色版。 |
| 2026-07-27 15:55 | 对话角色改为「ai小助手」；系统配置 Provider 可选主流厂商并级联 BaseURL/模型，模型支持手输。 |
| 2026-07-27 15:58 | 补全各厂商模型列表；DeepSeek 增加 deepseek-v4-pro / deepseek-v4-flash。 |
| 2026-07-27 16:10 | 「系统参数配置」更名为「配置洞察」；AI 支持全部/多选整行分析；左右布局（报告+对话）。 |
| 2026-07-27 16:15 | AI 分析区固定视口高度避免整页滚动；选中分析改为弹框勾选，主页面仅展示已选数量。 |
| 2026-07-27 16:45 | 分析结果 Markdown 预览；配置洞察分析/对话与工时对话均支持 SSE 流式输出；助手气泡 Markdown 渲染。 |
| 2026-07-27 17:15 | 系统配置页展示 AI Token 累计/最近一次用量，支持清零；流式请求开启 stream_options.include_usage。 |
| 2026-07-28 13:21 | Angular 组件外提模板/样式：`main-layout` / `login` / `md-view` 改用 `templateUrl`+`styleUrl`，去掉显式 `standalone: true`。 |
| 2026-07-28 13:21 | 同上：`sys-params` / `weekly-report` / `settings` 三页外提 html/scss，去掉显式 `standalone: true`。 |
| 2026-07-28 13:29 | `settings.component.ts` 补全中文 JSDoc（文件/类、接口、常量、公开成员与私有字段）。 |
| 2026-07-28 13:30 | `sys-params.component.ts` 补全中文 JSDoc（类、类型/接口、公开成员与私有 helper）；逻辑未改。 |
| 2026-07-28 13:35 | 前端 Angular 源码统一补中文 JSDoc：core/auth、shared、layout、login、app 入口与三业务页。 |
| 2026-07-28 13:40 | SSE 由原生 `fetch` 改为 Angular `HttpClient`（`observe: 'events'` + `reportProgress`）；抽为 `SseClient` 根服务。 |
| 2026-07-28 13:43 | 文件名对齐为 `sse-client.service.ts`；配置洞察分析/对话、工时周报对话均已改用该服务。 |
| 2026-07-28 13:46 | 补齐技术方案与 CONTEXT；提交前端外提模板/样式、JSDoc、SseClient 改造。 |
| 2026-07-28 15:17 | 新增 `docs/10001/系统消化文档.md`（架构～AI～技术债六章，供原作者对照代码消化）。 |
| 2026-07-29 16:20 | 全量代码评审（未改代码）：新增「待修问题」与「文档与实现偏差」两节。关键新发现：周报对话上下文 `taskName` 字段名 bug、配置洞察导入无事务、AI HTML 未消毒、监听地址与上传限制未按 §9.4 落地。 |
| 2026-07-29 16:34 | P0 四项修改的风险评估（仍未改代码）：查证 `SqljsQueryRunner` 源码确认事务方案安全可行，并为四项补「实现约束/陷阱/验证方式」。建议拆四个独立提交，改事务前备份 sqlite。 |
| 2026-07-29 17:58 | **上线改动全部落地并本地验证**：paths 环境化 + 密钥生产强制（缺失 exit 1）、前端相对路径 + dev proxy（5173 代理 401 通过）、上传 limits + multer 中文错误、导入事务 + 失败清图；新增 Dockerfile×2 / compose / nginx.conf / .dockerignore / .env.example；README 补部署章节与数据目录纠正。前后端生产构建均通过。**剩余需在服务器上做：certbot 证书、`htpasswd` 生成、`.env` 填值。** |
| 2026-07-29 17:35 | **决策：即将上云**（单云主机 + Docker Compose + nginx，后期上 PG）。风险模型重排：新增「上线改动清单（收窄版）」——nginx 整站 Basic Auth 兜住多数安全项；必须改代码仅 3 项（数据目录环境化 / 前端相对路径 + dev proxy / 密钥生产强制）；CORS 因 dev proxy 转同源而免改。新发现运行数据实际在 `apps/data/` 而非文档所写 `data/`（挂错卷会静默丢数据）。 |
| 2026-08-05 15:32 | **学习计划**：用户开始手写 NestJS；约定每次互动都提炼进 CONTEXT。首个练习需求定为「健康检查 Health 模块」（见下方「NestJS 手写练习」），当前仅提需求、未实现。 |
| 2026-08-05 17:07 | 练习 1 代码已写：`HealthController` + `HealthModule`（文件名 `healty.module.ts`）已挂 `AppModule`。终端在跑 `npm run start`（非 watch）→ 改代码需**手动重启**；学习期建议 `npm run start:dev`。 |
| 2026-08-05 17:09 | 练习 1 **验收通过**（Network 见 `GET health` → `{ ok, service, time }`）。用户反馈太简单；已开练习 2 需求（只读查库）。 |
| 2026-08-05 18:03 | 练习 2 进行中：已有 `HealthService.getStatsSummary` + `GET /api/health/stats/summary`（JWT 暂注释；Controller 里先 `return {a:111}` 短路）。用户问「总是跳转到系统中」——多为在 **5173 前端地址**测 API，被 Angular SPA 吃掉路由进业务壳；应打 **3000** 或用 curl/Apifox。 |
| 2026-08-05 18:17 | 练习 2：服务端 console 已打出统计，但 **Apifox Web** 看不到响应。根因高度可疑：`main.ts` CORS 仅放行 `5173`，浏览器里的 Apifox 跨域读不到 body（请求其实已进 Nest）。建议改用 Apifox 桌面版 / curl，或临时扩大 CORS。接口已加 JWT Guard。 |
| 2026-08-05 18:27 | Apifox 打 `5173/api/health/stats/summary` 带 Authorization 仍 **401**。排查：Header 拼写无误；优先改打 **3000** 排除 proxy；重新 `POST /api/auth/login` 换新 `accessToken`；清掉无关 Cookie/`If-None-Match`；看本次请求是否还有 `getStatsSummary` 日志（无日志=Guard 拒掉）。 |
| 2026-08-05 18:31 | 仍 401（已改 3000）：截图显示 `Authorization` 值只有 JWT，**缺少 `Bearer ` 前缀**。本项目 `JwtStrategy` 用 `fromAuthHeaderAsBearerToken()`，必须是 `Bearer <token>`。 |
| 2026-08-05 18:32 | 已加 Bearer 仍 401。高度可疑：Token 不是本项目 `POST /api/auth/login` 签发的（Apifox 残留 `vue_admin_template_token`）。签名密钥不一致 → Passport 统一返回 Unauthorized。下一步：现场重新 login 取 `accessToken` 再测；或临时去掉 Guard 验证业务代码。 |
| 2026-08-05 18:35 | 本机脚本验证：新鲜 login + `Bearer` → stats **200**（业务已通）。用户 Apifox 仍不通 → 配置问题。常见坑：Auth 选 Bearer 后又在 Header 手写 `Bearer` 变成双前缀；或 Token 非本项目签发。新增 `scripts/test-health-stats.ps1` 自检。 |
| 2026-08-05 18:37 | Apifox 已通；完成练习 1+2 **代码 review**。主路径正确；待清理：文件名 `healty`、无用 import、`console.log`、health `time` 写死、`aiConfigured` 未排除空串。练习 2 标完成。 |
| 2026-08-05 18:47 | 用户问 P2：`aiConfigured` 可否兼容 null/空串等。答：可以；推荐查出后用 JS 判断 trim 非空，或 DB 层排除 null+空串（注意仅空格需应用层 trim）。 |
| 2026-08-05 18:50 | 用户追问：若 `ai_settings` 只有一条且 `id !== 1`。答：不要写死 `id: 1`；用 `find({ take: 1 })` 或查「任意 apiKey trim 非空」更稳。本项目 `AiService.getSetting` 虽偏好 id=1，但练习统计接口不必绑死。 |
| 2026-08-05 18:51 | 用户追问多行时 `take:1` 是否够用。答：单行表才适合 take1；多行要先定业务语义——任一有效 Key / 指定 id / 最新一条，再用 `some` 或对应 where，不能瞎 take1。 |
| 2026-08-05 18:52 | 用户问 P3 文件名拼写在哪：`apps/api/src/health/healty.module.ts`（少字母 h），`app.module.ts` 第 18 行 import 也指向该文件。 |
| 2026-08-05 18:54 | 用户问错拼文件名为何不报错：import 路径与磁盘文件名一致即可；类名 `HealthModule` 与文件名无强制校验。已改为 `health.module.ts`。 |
| 2026-08-05 18:56 | 提交并 push：`540573d` — Health 模块（health + JWT stats）、CONTEXT、`scripts/test-health-stats.ps1`。 |
| 2026-08-06 09:33 | 开练习 3 需求：学习用「备忘录 Notes」模块（新建 Entity + POST 校验写库 + GET 列表），须 JWT；不动 AI/工时业务表。 |
| 2026-08-07 13:52 | 练习 3 联调通过：空 title→400；合法 POST→201；GET 倒序列表。代码 review：主路径 OK；`title` 上 `@IsOptional`+`@IsNotEmpty` 对「缺字段」偏松；列表字段名代码为 `item`（需求为 `items`）；DTO 宜抽到独立文件；清理无用 import/`console.log`。练习 3 标完成。 |
| 2026-08-07 13:58 | 用户问 DTO 目录放哪：本项目尚无统一 dto 目录；推荐按模块放 `notes/dto/create-note.dto.ts`（Nest 常见）；小模块也可与 controller 同级单文件。 |
| 2026-08-07 14:00 | 用户已按 review 改 notes（含 dto 外置）；问 JSDoc 快速生成：Cursor 内可用扩展 Document This / AI 选中生成；约定中文 JSDoc 与仓库前端风格一致。 |
| 2026-08-07 14:01 | JSDoc 可跳转类型：用 `{@link CreateNoteDto}` 或 `@param {CreateNoteDto} dto`（文件须已 import）；勿写 `@param dto: @class ...`。TS 签名上的类型本身也可 Ctrl+点击。 |
| 2026-08-07 14:04 | 复杂返回类型勿塞进 `{@link {total, items}}`；用 `@returns {{ total: number, items: Note[] }}` 描述，或抽命名 interface 再 `{@link Xxx}`。 |
| 2026-08-07 14:06 | Controller 类型：参数用 `@Body() dto: CreateNoteDto`；返回可用 `Promise<ReturnType<NotesService['getAllNotes']>>` 或与 Service 共用命名类型；JSDoc 可简写并 `{@link}` 到 DTO/Service。 |
| 2026-08-07 14:09 | notes 二次 review：结构/类型/DTO 外置已明显改进；剩 P3：`title?` 宜改为 `title: string`；方法上重复 Guard；`@param dto:` 冒号多余；content 可补 MaxLength/默认 `''`。 |
| 2026-08-07 14:26 | DTO `title: string` TS 报未初始化：因属性由 ValidationPipe 注入、无构造赋值；Nest 惯例写 `title!: string`（definite assignment）。 |
| 2026-08-07 14:28 | 提交并 push：`5d0dc32` — Notes 模块（Entity/DTO/CRUD 列表+创建）、CONTEXT。 |
| 2026-08-07 15:05 | **底层迁移落地**：TypeORM+sql.js+Express → **Prisma 6 + SQLite 文件 + Nest Fastify**。旧 `assistant.sqlite` 备份为 `assistant.sqljs.bak`；新库 `assistant.prisma.sqlite`；业务数据重建（仅 seed）。去掉 Entity/`TypeOrmModule`；`PrismaModule` 全局；上传改 `@fastify/multipart`；SSE 改 `FastifyReply.hijack`+`raw`；静态 `/uploads` 用 `@fastify/static`。Dockerfile 含 `prisma generate` + 启动 `migrate deploy`。冒烟：login / health / notes / settings / 工时 import（Node FormData）通过；SSE 协议未改前端。 |
| 2026-08-07 15:12 | `start:dev` 报 TS7016：`@fastify/static` 声明找不到（包自带 types，但 nodenext + default import 不稳定）。`main.ts` 改为 `createRequire` 加载 multipart/static。 |
| 2026-08-07 15:18 | 用户问 Prisma 新建表：答「改 schema.prisma 加 model → `npm run db:migrate:dev` → 代码里 `prisma.xxx`」。 |
| 2026-08-07 15:36 | DeepSeek「测试连接」400：`AI 返回为空`。根因 deepseek-v4-flash 默认 thinking，`max_tokens:16` 被推理占满。`testConnection` 改为 `disableThinking` + `maxTokens:64`。 |
| 2026-08-07 15:40 | 用户终端 `EADDRINUSE :3000`：释放占用进程后可再 `npm run start:dev`。 |
| 2026-08-07 16:02 | 提交并 push：`44bcda3` — Prisma SQLite + Nest Fastify 迁移；DeepSeek v4 测试连接关 thinking。 |
| 2026-08-07 16:08 | 再次 EADDRINUSE:3000（旧 node 占用），杀掉后需重跑 `start:dev`。 |
| 2026-08-07 16:12 | 用户问是否 Nest「更严格 TS」：api 是（有 strictNullChecks/noImplicitAny 等，但未开完整 `strict:true`）；web 已 `strict:true`。 |
| 2026-08-07 16:17 | 开练习 4 需求：学习用「小文件上传」模块（Fastify multipart + 落盘 + 元数据入库），须 JWT；勿改工时/配置洞察导入。 |
| 2026-08-10 08:58 | 用户打招呼续聊；练习 4 仍待实现。 |
| 2026-08-12 15:46 | 用户再次开始练习 4；仓库仍无 `files` 模块实现，继续按 CONTEXT 需求手写。 |
| 2026-08-13 09:34 | 用户续聊；`schema.prisma` 已加 `UploadedFile` 模型（`storeName`），尚未 migrate / 未建 `files` 模块。 |
| 2026-08-13 09:36 | 用户再次打招呼；练习 4 进度不变。 |
| 2026-08-14 18:20 | 提交练习 4 进度：`UploadedFile` 模型入 schema；files 模块尚未实现。 |
| 2026-08-17 10:30 | 用户要求重述练习 4 需求；进度仍停在 schema 已加 `UploadedFile`、未 migrate、未建 files 模块。 |
| 2026-08-17 10:36 | 用户问现切 PostgreSQL 改动大不大：业务代码小、基础设施与 migration 中等；建议练习 4 做完再切。 |
| 2026-08-17 10:38 | 用户问何时上云合适：产物已齐；单实例个人用可先 SQLite 上；证书/htpasswd/.env 是服务器侧门槛；PG 可后做。 |
| 2026-08-17 10:40 | 用户确认用途为**自己用**：可单实例 SQLite 上云，不必先切 PG；服务器侧仍需证书 / htpasswd / `.env`。 |
| 2026-08-17 10:41 | 用户问「先上云 SQLite、再切 PG」是否来得及：来得及。Prisma 已抽象；先学 compose/nginx/证书，再学 PG 换引擎。 |
| 2026-08-17 13:31 | 练习 4 代码 review：主路径（模块/JWT/multipart/Prisma）已通；P0：大小判成下限、toBuffer 读两次、落盘路径与 url 不对、列表升序。 |
| 2026-08-17 13:45 | 用户问 `ensureDataDirs` 如何建 `files` 子目录：在现有数组里加 `join(UPLOADS_DIR, 'files')`。 |
| 2026-08-17 14:01 | 练习 4 二次 review：列表倒序、UPLOADS_DIR、url 形态已改；P0 剩「磁盘用原名、库用 uuid」对不上，以及大小提示文案仍写「不能小于」。 |
| 2026-08-17 14:05 | 练习 4 三次 review：P0 已齐（uuid 写盘、relativePath、上限文案）；剩 P1 参数名 minSize/默认 0、多余 .exe 判断。可按验收清单自测。 |
| 2026-08-17 14:08 | 练习 4 四次 review：P1 已改（maxSize、去掉 .exe）。用户问仓库根 `data/uploads` vs `apps/data/uploads`：运行时只用后者。 |
| 2026-08-17 14:10 | 提交并 push 练习 4：`FilesModule` + migration + Fastify 上传落盘。 |
| 2026-08-17 14:15 | 开练习 5 需求：学习用 SSE（Fastify hijack + `common/sse.ts`），须 JWT；勿改工时/配置洞察现有 stream。 |
| 2026-08-17 15:39 | 练习 5 代码 review：模块/JWT/SSE 主路径已有；P0：`n:0` 被当成默认 5、`i` 从 0 起、缺 try/catch；间隔 1300ms 非 300ms。 |
| 2026-08-17 15:46 | 练习 5 二次 review：校验/`initSse`/try-catch/300ms 已改；P0 剩 tick 的 `i` 仍从 0 起，且 stream 没用校验后的 `n`。 |
| 2026-08-17 15:48 | 练习 5 三次 review：`i` 已从 1 到 n；需求满足。剩 P1：stream 应传校验后的 `n`、Service 仍注入无用 Prisma/reply。 |
| 2026-08-17 16:09 | 练习 5 四次 review：已传校验后的 `n`、去掉 Prisma；可标完成。 |
| 2026-08-17 16:10 | 提交并 push 练习 5：`TicksModule` + JWT SSE ticks stream。 |
| 2026-08-17 16:38 | 开练习 6 需求：在现有 `NotesModule` 上补 GET/PATCH/DELETE by id（`ParseIntPipe` + `NotFoundException`）。 |
| 2026-08-17 17:08 | 练习 6 代码 review：路由/JWT/`ParseIntPipe`/DELETE 的 404 已有。P0：GET 不存在返回 200+null；PATCH 不存在会 500；DELETE 成功是 200 不是 204；PATCH 用 truthy 判断字段。 |
| 2026-08-17 17:14 | 练习 6 二次 review：GET/PATCH 的 404 已改。P0 剩：DELETE 仍 200+null；PATCH 复用 CreateNoteDto（title 必填）导致不能只改 content；Service 仍用 truthy 判断字段。 |
| 2026-08-17 17:21 | 练习 6 三次 review：DELETE 204、UpdateNoteDto、PATCH 404 已齐。P0：`in` 在 class DTO 上恒真（会误清空未传字段）；UpdateNoteDto.title 仍缺非空/最长 100。 |
| 2026-08-17 17:28 | 练习 6 答疑：`@IsOptional()` + `@IsNotEmpty()` 不是必填；缺省/undefined 跳过，传了空字符串才 400。 |
| 2026-08-17 17:29 | 练习 6 答疑：若产品允许清空 title 就不能加 `@IsNotEmpty()`；本次练习标题不可置空，与创建规则一致。 |
| 2026-08-17 17:30 | 练习 6 四次 review：DTO/`!== undefined`/404/204 已齐。P0 剩 Controller 仍用 `"title" in dto`，空 PATCH `{}` 会 200 而不是 400。 |
| 2026-08-17 17:31 | 练习 6 已改 `!== undefined`；提交并 push：Notes GET/PATCH/DELETE by id。 |
| 2026-08-17 17:32 | 开练习 7 需求：Notes 列表分页 + 可选关键词（Query DTO、`skip`/`take`、`count`）。 |
| 2026-08-17 17:34 | 学习轨校准：目标是熟练本仓库用到的 Nest（非无限刷题）。1–6 已覆盖模块/CRUD/DTO/上传/SSE/404；尚未达标。计划 7 分页 Query、8 拦截器、9 自定义装饰器后收束。 |
| 2026-08-17 18:03 | 练习 7 代码 review：Query DTO/`@Type`/`skip`/`take`/OR contains 已有。P0：`total` 用了当前页 `items.length`（缺 `count`）；Controller 把 `q=foo` 写死成 400。 |
| 2026-08-17 18:08 | 练习 7 二次 review：count + Promise.all、去掉 foo 特判、IsOptional 已改。需求满足。剩 P1：where 条件重复、未使用的 IsNumber。 |
| 2026-08-17 18:10 | 练习 7 三次 review：where 已抽变量、IsNumber 已删。可标完成。 |
| 2026-08-17 18:11 | 练习 7 答疑：列表 `where` 类型用 `Prisma.NoteWhereInput`（可 `| undefined`）。 |
| 2026-08-17 18:12 | 答疑：`prisma generate` 后每个 model 都有 `Prisma.<Model>WhereInput` 等配套类型。 |
| 2026-08-17 18:15 | 提交并 push 练习 7：Notes 列表分页 + Query DTO + `count`/`skip`/`take`。 |
| 2026-08-18 08:52 | 开练习 8 需求：仅挂在 Notes 上的拦截器（耗时日志 + `X-Response-Time`），禁止全局、禁止改 JSON 包一层。 |
| 2026-08-18 09:55 | 练习 8 代码 review：`NestInterceptor` + 仅 Notes 挂载 + `next.handle().pipe(tap)` 已有，log 已打出。P1：头值缺 `ms`；`tap` 不覆盖 404；可用 `Date.now()` / 实例 Logger。 |
| 2026-08-18 09:59 | 练习 8 二次 review：request 只取一次、实例 Logger 已改。头值仍是纯数字（缺 `ms`）。可标完成。 |
| 2026-08-18 10:01 | 练习 8 三次 review：Logger 升为类字段，`X-Response-Time` 已带 `ms`。可标完成。 |
| 2026-08-18 10:03 | 提交并 push 练习 8：Notes 耗时拦截器 + `X-Response-Time`。 |
| 2026-08-18 10:21 | 用户问练习 9 与总数：本轨共 **9** 项；9 为自定义参数装饰器（如 `@CurrentUser()`），做完收束。 |
| 2026-08-18 10:23 | 澄清「对这个项目够用」：指本仓库用到的 Nest 原语练完，不是 Nest 全集学完。 |
| 2026-08-18 10:25 | 用户问「练常用 Nest 要扩展什么功能」：不为此硬加 GraphQL/微服务；若要练，优先 AI 限流、改密、Config、异步任务、定时、测试。 |
| 2026-08-18 10:45 | 用户新目标：掌握 HTTP 全链路（Middleware→Guard→Interceptor→Pipe→Controller→Service→ORM→DB）并结合 JWT/DTO/校验/异常/PG/Redis/Queue/Docker。已写入「进阶轨」设计；基础轨仍先完成练习 9。技术方案暂不改（尚未开工迁 PG）。 |
| 2026-08-18 10:48 | 提交并 push 进阶轨设计（练习 9–18 与 AI 任务中心）；练习暂缓。 |
| 2026-08-18 14:10 | 开练习 9 需求：`createParamDecorator` 的 `@CurrentUser()`；改 `GET /api/auth/me`，Notes 增加 `GET /api/notes/me`。 |
| 2026-08-18 14:57 | 练习 9 代码 review：装饰器/`auth/me`/`GET notes/me` 在 `:id` 前已有。P0：`from 'src/...'` 应改相对路径。P1：缺 `JwtUser` 类型、无用 import、方法上重复 JWT Guard。 |
| 2026-08-18 15:02 | 练习 9 二次 review：相对路径、auth/me、notes/me 顺序已齐。可标完成。P1：`JwtUser` 未 export；`data` 应可选；装饰器返回类型不能写成永远是 `JwtUser`。 |
| 2026-08-18 15:08 | 练习 9 三次 review：已 export `JwtUser`、`data` 可选、返回类型覆盖字段/整对象。可标完成。 |
| 2026-08-18 15:10 | 提交并 push 练习 9：`@CurrentUser()` + `/api/notes/me`。开练习 10 需求：全局 Request-Id 中间件。 |
| 2026-08-18 18:41 | 练习 10 代码 review：`NestMiddleware` + `forRoutes('*')` + `next()` + 沿用/生成 id 已有。P0：未把 id 挂到 `req`。P1：无用 `getHeaders`、未 `implements NestModule`。 |
| 2026-08-18 18:49 | 练习 10 二次 review：已挂 `req.requestId`、`implements NestModule`、`node:crypto`。P0：入站头应读 `x-request-id`（Node 会把头名转小写），现在读 `X-Request-Id` 会永远生成新 id。 |
| 2026-08-18 18:51 | 练习 10 答疑：`res.setHeader('X-Request-Id')` 是把 id 回给客户端，和挂到 `req` 给服务端后续用不是一回事。 |
| 2026-08-18 18:52 | 练习 10 答疑：`req.requestId = ...` 把 id 挂在同一请求对象上，供后面 Guard/Interceptor/日志读取。 |
| 2026-08-18 18:53 | 练习 10 答疑：`req.requestId` 不是请求头，客户端看不到；客户端能看到的是响应头 `X-Request-Id`。 |
| 2026-08-18 18:54 | 练习 10 答疑：中间件把 `req` 标成 `FastifyRequest['raw']`（IncomingMessage）时 `url` 可选且 Fastify 不一定写回 raw；路径在 FastifyRequest.url。 |
| 2026-08-18 18:57 | 练习 10 排错：终端是 `GET+/+my-id-1`，`url` 实际是 `/` 不是 undefined。Nest `forRoutes('*')` + 全局前缀 `/api` 会剥路径；中间件应读 `originalUrl`。 |
| 2026-08-18 19:00 | 练习 10 答疑：解释全局前缀 + `forRoutes('*')` 如何把中间件里的 `req.url` 剥成 `/`。 |
| 2026-08-18 19:03 | 练习 10 答疑：只剥 `/api` 应得 `/notes`；实际是 `/` 因为 `{*path}` 把后面整段也匹配掉了。 |
| 2026-08-18 19:04 | 练习 10 答疑：`forRoutes('*')` 改写法也难让 `req.url` 变成 `/notes`；Nest 是按整条路由匹配，不是 Express 的 `app.use('/api')`。完整路径用 `originalUrl`。 |
| 2026-08-18 19:06 | 提交并 push 练习 10：全局 Request-Id 中间件（沿用入站头、挂 `req.requestId`、响应头回传）。 |
| 2026-08-19 13:40 | 用户本机已装 PostgreSQL **17.11**（`D:\software\PostgreSQL\17`）。进阶轨阶段 B（练习 14–15）可用此实例；当前仍 SQLite，下一练习仍是 11（Guard）。 |
| 2026-08-19 13:42 | 开练习 11 需求：自写 `AiQuotaGuard`（JWT 之后、内存计数、超额 429），挂在 `POST /api/ticks/stream`。 |
| 2026-08-19 14:31 | 练习 11 代码 review：CanActivate + 429 + 方法级挂载已有。P0：`user.id` 应为 `userId`（JWT 没有 `id`），无 user 时会 500 而不是 401。 |
| 2026-08-19 14:34 | 练习 11 答疑：JWT Guard 在本路由上会先拦无 Token；配额 Guard 仍校验 user 是防漏挂 JWT、以及 TypeScript/运行时 `user` 可能为空。P1 剩：`Logger.log(user)`、Map 键类型。 |
| 2026-08-19 14:35 | 练习 11 二次 review：`userId`、无 user 401、`Map<number,number>`、`>= 3`、providers 已齐。可标完成。P1：仍有 `Logger.log(user)`。 |
| 2026-08-19 14:37 | 提交并 push 练习 11：`AiQuotaGuard` 挂 `POST /api/ticks/stream`。开练习 12 需求：自写 `TrimPipe`。 |

## NestJS 手写练习（学习轨）

> 目的：在现有 `apps/api` 上亲手写代码学 Nest，不另起仓库。  
> 约定：Agent **只先给需求**；用户自己实现；卡住再问。每次进度必须回写本文件。  
> **熟练标准（本仓库）**：能独立加一个与现网风格一致的功能模块（Module / Controller / Service / DTO / JWT / Prisma / 合适的 HTTP 状态码）。不是要学完 Nest 全集（微服务、GraphQL、CQRS 等本项目不用）。  
> **进度（2026-08-19）**：1–11 完成。练习 12（TrimPipe）需求已开。PG 17 已装、尚未切库。

### 练习 1 — 健康检查 ✅ 已完成

### 练习 2 — 只读查库 ✅ 已完成

### 练习 3 — 带校验的写接口 ✅ 已完成

### 练习 4 — 小文件上传 ✅ 已完成

目标：学会 **Fastify multipart** 收文件、校验、落盘，并把元数据写入 Prisma（对照现有 `readExcelUpload`，但**不要改**工时/配置洞察业务导入）。

#### 功能需求

1. **新模块** `FilesModule`（或 `UploadsModule`，目录自定，建议 `apps/api/src/files/`）。
2. **Prisma 新表**（自己改 `schema.prisma` + `npm run db:migrate:dev`），建议字段至少：
   - `id`、`originalName`、`storedName`、`mimeType`、`size`、`relativePath`、`createdAt`
   - 表名可用 `@@map("uploaded_files")`
3. **接口**（均需 JWT）：
   - `POST /api/files`：`multipart/form-data`，字段名 **`file`**  
     - 仅允许：`.png` / `.jpg` / `.jpeg` / `.txt`（扩展名用 `decodeMulterFilename` 后再判断）  
     - 大小上限：**2MB**（超限 → 400，中文提示）  
     - 无文件 / 空文件 → 400  
     - 成功：文件写到 `UPLOADS_DIR/files/`（可参考 `paths.ts` 的 `UPLOADS_DIR`），DB 写一条元数据  
     - 响应示例：`{ id, originalName, url, size, createdAt }`，其中 `url` 形如 `/uploads/files/xxx.png`（能用现有静态挂载访问）
   - `GET /api/files`：按 `id` 倒序列表，返回 `{ total, items: [...] }`
4. **禁止**：改 `worktime` / `sys-params` 的 import；不要引入 Express Multer / `FileInterceptor`。
5. **可参考**：`common/upload.ts` 的 `req.file()` + `toBuffer()`；`main.ts` 里已注册 multipart 与 `/uploads` 静态目录。

#### 验收（自己用 Apifox / curl）

- 未带 Token → 401  
- 上传 `.exe` 或超 2MB → 400  
- 合法小图/文本 → 201/200 + DB 有记录；浏览器打开返回的 `url` 能访问  
- `GET /api/files` 倒序看到刚传的条目  

卡住再问；做完说一声做 review。

### 练习 5 — SSE 流式输出 ✅ 已完成

目标：学会 Fastify 下用 **SSE**（`text/event-stream`）分段推数据。协议与现网一致：`data: JSON\n\n`，最后 `{"type":"close"}`。

**不要改** `worktime` / `sys-params` 的 chat/analyze stream。

#### 功能需求

1. **新模块**（建议 `apps/api/src/ticks/`）：`TicksModule` + Controller + Service，挂到 `AppModule`。
2. **不必新建 Prisma 表。**
3. **接口**（JWT）：
   - `POST /api/ticks/stream`
   - Body：`{ n?: number }`  
     - `n` 缺省为 **5**；必须是 1～20 的整数  
     - **校验失败要在 `initSse` 之前**抛 `BadRequestException`（400 JSON）。hijack 之后就发不了普通 400 了。
   - 成功：`@Res() reply: FastifyReply`，调用已有 `initSse` / `writeSse` / `endSse`（`common/sse.ts`）
   - 每隔约 **300ms** 推一条：`{ "type": "tick", "i": 1, "n": 5 }`（`i` 从 1 到 `n`）
   - 全部推完后 `endSse(reply)`（会再写 `{"type":"close"}` 并结束）
   - `try/catch`：异常时 `writeSse(reply, { type: 'error', message: '...' })` 再 `endSse`（可参考 `worktime.controller.ts` 的 `chatStream`）
4. Service 建议用 `async function*` 生成 tick（Controller 里 `for await`），延时用 `setTimeout` 包一层 Promise，不要同步死循环占满 CPU。
5. **禁止**：改工时/配置洞察 stream；不要用 Express `Response`。

#### 验收

```bash
curl -N -X POST http://127.0.0.1:3000/api/ticks/stream -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d "{\"n\":3}"
```

- 无 Token → 401（普通 JSON，不是 SSE）
- `n: 0` / `n: 99` → 400 JSON
- `n: 3` → `text/event-stream`，依次 tick i=1,2,3，最后 close

卡住再问；做完喊 review。

### 练习 6 — 按 id 查改删（404 + 路径参数） ✅ 已完成

目标：把练习 3 的备忘录从「只有列表 + 创建」补成完整 REST；学会 **`@Param` + `ParseIntPipe`**、**`NotFoundException`**、**PATCH 部分更新**、**DELETE 204**。

在现有 `NotesModule` 上扩展，**不要新建模块**。不必改 Prisma schema。

#### 功能需求

1. **保留**现有接口：
   - `GET /api/notes`（列表）
   - `POST /api/notes`（创建）
2. **新增**（均需 JWT）：
   - `GET /api/notes/:id`  
     - `:id` 用 `ParseIntPipe` 转成 number（非法如 `abc` → 框架自动 400）  
     - 存在 → 返回该条 Note  
     - 不存在 → `NotFoundException`，中文提示如「备忘录不存在」（HTTP 404）
   - `PATCH /api/notes/:id`  
     - 同样 `ParseIntPipe` + 不存在 404  
     - Body 用新 DTO（建议 `UpdateNoteDto`）：`title`、`content` 都可选  
       - `title` 若出现：规则与创建相同（非空字符串、最长 100）  
       - `content` 若出现：字符串；允许传 `null` 清空（若不好做可只支持字符串，但不要把「没传」当成清空）  
     - **至少提供一个字段**，否则 400（中文提示）  
     - 成功返回更新后的整条 Note
   - `DELETE /api/notes/:id`  
     - 不存在 → 404（同上）  
     - 成功 → **204 无 body**（`@HttpCode(HttpStatus.NO_CONTENT)` 或 `204`）
3. Service 里用 `findUnique` / `findFirst` 判断存在，再 `update` / `delete`；不要吞掉 Prisma 的未知错误。
4. **禁止**：改工时/配置洞察/files/ticks；不要为练习加新表。

#### 可参考（只看用法，别抄业务）

- `worktime.controller.ts`：`@Param('id', ParseIntPipe)`
- `worktime.service.ts` / `sys-params.service.ts`：`throw new NotFoundException('...')`
- 现有 `CreateNoteDto`：class-validator 写法

#### 验收

- 无 Token → 401
- `GET /api/notes/abc` → 400
- `GET /api/notes/999999`（不存在）→ 404 JSON
- 先 `POST` 一条，再 `GET /api/notes/:id` 能拿到
- `PATCH` 只改 `title`，`content` 保持原值；空 body `{}` → 400
- `DELETE` 成功 → 204；再 GET 同一 id → 404

卡住再问；做完喊 review。

### 练习 7 — 列表分页与查询参数 ✅ 已完成

目标：学会 **`@Query()` + Query DTO**（query 默认是字符串，要转成 number）、以及 Prisma **`skip` / `take` + `count`**。不要把全表查出来再在内存里切片。

改造现有 `GET /api/notes`（仍走 `NotesModule`）。**不要新建模块、不要改 schema。** 练习 6 的 GET/PATCH/DELETE by id 保持不变。

#### 功能需求

1. **接口**（JWT）：`GET /api/notes`
   - Query（建议 `ListNotesQueryDto` + `@Query()`）：
     - `page`：缺省 **1**；整数且 ≥ 1
     - `pageSize`：缺省 **10**；整数，范围 **1～50**
     - `q`：可选字符串；有值时在 **title 或 content** 里模糊匹配（Prisma `contains` 即可；SQLite 一般大小写敏感，不必强求 insensitive）
   - 非法 `page` / `pageSize`（如 `0`、`abc`、`pageSize=99`）→ **400**（交给 class-validator，中文或默认信息均可）
2. **响应**：
   ```json
   { "total": 23, "page": 1, "pageSize": 10, "items": [ /* 当前页 */ ] }
   ```
   - `total` 是**过滤后的总条数**（不是当前页 `items.length`）
   - `items` 仍按 `id` **倒序**
   - `skip = (page - 1) * pageSize`，`take = pageSize`
3. `count` 与 `findMany` 建议 `Promise.all` 一起查，条件要一致。
4. **禁止**：全表 `findMany` 再 `slice`；改工时/配置洞察/files/ticks；为练习加新表。

#### 提示

- `main.ts` 已有 `ValidationPipe({ transform: true })`。数字 query 要用 `class-transformer` 的 `@Type(() => Number)`，否则 `"1"` 进不了 `@IsInt()`。
- `@IsOptional()` 对缺省 query 生效；缺省值可在 DTO 里写 `page = 1`，或在 Service 里兜底。
- 配置洞察的 `list(@Query('q') q?)` 是散装 query，这次请用 **一个 DTO**，不要学它拆成多个 `@Query('page')`。

#### 验收

- 无 Token → 401
- `GET /api/notes` → `page=1`、`pageSize=10`，`total` 与全量条数一致
- 至少造 12 条后：`pageSize=5&page=2` → 5 条，且与第 6～10 条（按 id 倒序）对得上
- `q` 能筛到标题或内容里包含关键字的记录；`total` 随筛选变
- `page=0` / `pageSize=99` / `page=foo` → 400
- `GET /api/notes/:id` 不受影响

卡住再问；做完喊 review。

### 练习 8 — 拦截器（Interceptor） ✅ 已完成

目标：学会 Nest 的 **`NestInterceptor`**：在 Controller **之前/之后**插一刀，返回值是 **RxJS Observable**（必须 `return next.handle()...`）。这次只做副作用（日志 + 响应头），**不要改 JSON 形状**。

#### 功能需求

1. **新建**拦截器（建议 `apps/api/src/notes/notes-log.interceptor.ts`，实现 `NestInterceptor`）。
2. **只挂在 `NotesController` 上**：类上 `@UseInterceptors(...)`。  
   **禁止** `app.useGlobalInterceptors` / `APP_INTERCEPTOR`（会作用到工时、登录、健康检查）。
3. 行为：
   - 用 `ExecutionContext.switchToHttp().getRequest()` 取 method、url（Fastify request 即可）
   - 记录开始时间，**必须** `return next.handle().pipe(...)`
   - 响应发出前/发出时：
     - 响应头 **`X-Response-Time`**，值形如 `12ms`
     - 用 Nest `Logger` 打一行：`GET /api/notes?page=1 12ms`（格式自定，但要有方法、路径、毫秒）
   - 用 `tap`（只关心成功）或 `finalize`（成功/失败都记耗时）都可以；**404 仍应是 404**，不要吞异常
4. **JSON body 保持原样**（列表仍是 `{ total, page, pageSize, items }`，不要包 `{ data: ... }`）。
5. **禁止**：改工时/配置洞察/files/ticks 业务；改 `main.ts` 全局拦截器；用 Express `Response`。

#### 提示

- 拦截器里忘记 `return next.handle()`，请求会一直挂起。
- `tap` 在 Observable **成功发出**时跑；`NotFoundException` 走 error 通道，若希望 404 也有耗时头，用 `finalize`。
- 现有 `UploadExceptionFilter` 是 **Filter**（抓异常），和 Interceptor 不是一回事，不要改它。
- 无依赖的拦截器不必写进 `NotesModule.providers`；需要注入时才登记。

#### 验收

- `GET /api/notes`（带 Token）：body 与练习 7 相同；响应头有 `X-Response-Time`
- 跑 api 的终端能看到对应 log 行
- `GET /api/health`：**没有** `X-Response-Time`（证明不是全局）
- `GET /api/notes/999999` → 仍 404（不是 200、不是被拦截器改成别的）

卡住再问；做完喊 review。

### 练习 9 — 自定义参数装饰器 `@CurrentUser()` ✅ 已完成

目标：学会 **`createParamDecorator`**：Guard 把 JWT 用户挂到 `request.user` 之后，Controller 用 `@CurrentUser()` 取出，不再写 `@Req() req` 再 `req.user`。

Passport JWT 已经在 `jwt.strategy.ts` 的 `validate()` 里返回 `{ userId, username }`，Guard 通过后这就是 `request.user`。装饰器只是把它取出来。

#### 功能需求

1. **新建**（建议 `apps/api/src/common/current-user.decorator.ts` 或 `auth/` 下同名）：
   - `export type JwtUser = { userId: number; username: string }`（与 `validate()` 返回值对齐）
   - `export const CurrentUser = createParamDecorator(...)`
   - 从 `ExecutionContext.switchToHttp().getRequest()` 取 `user`
   - **支持可选参数**：`@CurrentUser()` 返回整个 `JwtUser`；`@CurrentUser('userId')` 只返回 `userId`（用 decorator 的 `data` 参数）
2. **改** `GET /api/auth/me`：去掉 `@Req()` / `req.user`，改为 `@CurrentUser()`（或 `@CurrentUser('userId')`）。响应仍是 `{ id, username }`，行为与现在一致。
3. **Notes 用一处**（证明装饰器可跨模块）：新增  
   `GET /api/notes/me`（JWT）  
   - 返回 `{ userId, username }`（来自装饰器，不必再查库）  
   - **路由必须写在 `GET /api/notes/:id` 前面**，否则 `me` 会被当成 id
4. 这些接口仍要 `AuthGuard('jwt')`。无 Token → 401。
5. **禁止**：改 `JwtStrategy` 的 payload 形状；改登录接口；改密（以后的题）；给 Note 加 `userId` 字段；改工时/配置洞察。

#### 提示

- 装饰器在 **Guard 之后** 才有 `request.user`。没有 JWT Guard 的路由上用 `@CurrentUser()` 会拿到 `undefined`。
- Fastify 的 request 一样有 `.user`（Passport 挂上的），不要上 Express 类型硬转一堆。
- `createParamDecorator` 的回调是 `(data, ctx) => ...`，`data` 就是 `@CurrentUser('userId')` 里的 `'userId'`。

#### 验收

- 无 Token 调 `/api/auth/me`、`/api/notes/me` → 401
- 带 Token：`GET /api/auth/me` 仍返回当前用户 `{ id, username }`
- 带 Token：`GET /api/notes/me` 返回 `{ userId, username }`，与 token 里的人一致
- `GET /api/notes/1` 仍按 id 查备忘录（没有被 `me` 抢走）
- `auth.controller.ts` 里不再出现 `req.user`

卡住再问；做完喊 review。

### 练习 10 — Middleware（Request-Id） ✅ 已完成

目标：学会 Nest **中间件**（在 Guard / Interceptor **之前**）。全站每个请求一个 `X-Request-Id`，和练习 8 只挂在 Notes 上的拦截器区分开。

链路位置：`Request → Middleware → Guard → Interceptor → Pipe → Controller`。

#### 功能需求

1. **新建** `NestMiddleware`（建议 `apps/api/src/common/request-id.middleware.ts`）。
2. 在 **`AppModule` 实现 `NestModule`**，`configure(consumer)` 里 `apply(...).forRoutes('*')`（或等价的全路由）。这是全局的，**包括** `/api/health`、登录。
3. 行为：
   - id：若请求头已有 `x-request-id`（任意大小写按 HTTP 惯例读取）则沿用，否则 `crypto.randomUUID()`（`node:crypto`，不要为这个加 uuid 包）
   - 写入响应头 **`X-Request-Id`**
   - 把 id 挂到 request 上（如 `req.requestId`），后面拦截器/日志能拿到
   - Nest `Logger` 打一行：方法 + url + requestId（**只记进入，不要在中间件里算耗时**，耗时仍是练习 8 拦截器的事）
   - **必须调用 `next()`**，否则请求会挂住
4. **禁止**：只用 Fastify `addHook` 代替 Nest 中间件（本练习就是为了 `NestMiddleware` + `NestModule`）；不要改练习 8 的 JSON；不要改工时/配置洞察业务；不要拆掉 JWT。

#### 提示

- Fastify 下 `res` 更像 FastifyReply，设头用 `res.header(...)` 或适配层提供的 `setHeader`，以你本机能设上为准。
- 中间件参数是 `(req, res, next)`，不是 `ExecutionContext`（那是 Guard/Interceptor/装饰器）。
- `GET /api/health` **应该有** `X-Request-Id`（证明全局）；练习 8 的 `X-Response-Time` 在 health 上仍然 **没有**。

#### 验收

- `GET /api/health`：响应头有 `X-Request-Id`；终端有对应 log
- `GET /api/notes`（带 Token）：同时有 `X-Request-Id` 和 `X-Response-Time`
- 请求自带 `X-Request-Id: my-id-1` 时，响应原样回传 `my-id-1`（不要再生成新的）
- 忘记 `next()` 会表现为接口一直转圈 —— 别忘了

卡住再问；做完喊 review。

### 练习 11 — 自写 Guard（配额） ✅ 已完成（可按 P1 小清理）

目标：学会自己实现 **`CanActivate`**。JWT 是**使用**现成 `AuthGuard('jwt')`；这次要**手写**一个 Guard。位置在 Middleware **之后**、Interceptor **之前**。

先不接 Redis（练习 16 再换）。计数放 **内存**（进程一重启就清零）。

不要改工时/配置洞察的 AI 接口。用练习 5 的 ticks 当作「贵」的接口来限流。

#### 功能需求

1. **新建** `AiQuotaGuard`（建议 `apps/api/src/common/ai-quota.guard.ts`），`implements CanActivate`，加 `@Injectable()`。
2. `canActivate(context: ExecutionContext): boolean`：
   - 从 `context.switchToHttp().getRequest()` 取 `user`（即 JWT 的 `JwtUser`）
   - **没有 `user` → 401**（说明没走 JWT 或 JWT 失败）。正常情况不应发生：必须把本 Guard 写在 JWT **后面**
   - 按 `userId` 在内存 `Map` 里计数；每个 userId、当前进程内，调用超过 **3** 次 → `throw new HttpException('AI 调用次数已达上限', HttpStatus.TOO_MANY_REQUESTS)`（HTTP **429**）
   - 未超限：次数 +1，`return true`
3. **只挂在** `POST /api/ticks/stream` 上，例如：  
   `@UseGuards(AuthGuard('jwt'), AiQuotaGuard)`  
   顺序必须是 **JWT 在前、配额在后**。类上若已有 JWT，方法上再补配额 Guard 即可（不要把配额接到整个 Notes/Health）。
4. Guard 若要注入依赖，在 `TicksModule.providers` 登记；无依赖时 Nest 也能实例化，但写上更稳妥。
5. **禁止**：`@nestjs/throttler`（本练习就是自己写）；Redis；改 worktime/sys-params；改登录/health；把配额做成全局 APP_GUARD。

#### 提示

- Guard 里 `return false` 默认变成 403，配额超额应明确 **429**，所以用 `throw`，不要只 `return false`。
- 内存 Map 放在 Guard 实例上即可（Nest 默认单例）。
- 调试：连续打 4 次 `POST /api/ticks/stream`（带 Token、`{"n":1}` 较快），第 4 次 429；重启 `start:dev` 后计数归零。

#### 验收

- 无 Token → 401（JWT，还没到配额）
- 带 Token：前 3 次 `POST /api/ticks/stream` 成功（SSE 正常）
- 第 4 次 → **429**，中文提示
- `GET /api/health`、`GET /api/notes` 不受影响（没有配额 Guard）

卡住再问；做完喊 review。

### 练习 12 — 自写 Pipe（Trim）

目标：学会 **`PipeTransform`**。位置在 Guard **之后**、Controller **之前**。全局已有 `ValidationPipe`（校验 DTO）；这次手写一个去掉字符串首尾空格的 Pipe。

`ParseIntPipe` 是**使用**现成的；这次要**自己写**。

#### 功能需求

1. **新建** `TrimPipe`（建议 `apps/api/src/common/trim.pipe.ts`），`implements PipeTransform`。
2. `transform(value)`：
   - 值是 **string** → `value.trim()`
   - 值是 **普通对象**（如 JSON body）→ 只处理**第一层**的 string 字段（`title` / `content`），不要递归、不要改非 string
   - 其它（number、undefined、文件上传那类）→ **原样返回**（避免弄坏 multipart）
3. **只挂在备忘录写接口**，不要全局、不要改 `main.ts` 的 ValidationPipe：
   - `POST /api/notes`：`create(@Body(TrimPipe) dto: CreateNoteDto)`
   - `PATCH /api/notes/:id`：同样 `@Body(TrimPipe)`
4. **禁止**：改工时/配置洞察；给上传接口挂 TrimPipe；用 class-transformer 的 `@Transform` 代替本练习（可以以后再用，这次必须是 Pipe 类）。

#### 提示

- 参数上的 Pipe 和全局 `ValidationPipe` 都会跑。常见顺序是**先全局校验、再参数 Pipe**，所以 `"   "`（全空格）可能先通过 `@IsNotEmpty()`，再被 trim 成 `""`。本练习验收只要求「有字的标题去掉首尾空格」即可。
- 不要 `return false`；Pipe 是改值或 `throw`，不是 Guard。

#### 验收

- `POST /api/notes`，body `{ "title": "  周报  ", "content": "  内容  " }` → 库里 / 响应里 `title` 为 `"周报"`，`content` 为 `"内容"`（无首尾空格）
- `GET /api/notes` 的 `q`、文件上传、ticks **不要**被 TrimPipe 改掉
- 非法 DTO 仍 400（ValidationPipe 还在）

卡住再问；做完喊 review。

## 进阶轨（2026-08-18 目标：全链路 + 基础设施）

> **一条业务主线，不要拆成互不相关的玩具。**  
> 产品：**AI 任务中心** — 周报生成 / 配置洞察分析改为可排队的后台任务；带 JWT、限流、进度查询。  
> 本地仍可先 SQLite 把链路跑通；PG 用本机 **17.11**（`D:\software\PostgreSQL\17`）或 Compose。Redis 用 Compose。  
> 约定仍是：Agent 只先给当阶段需求；用户实现；review。未开工前不改 `docs/10001/技术方案.md` 的默认 DB。

### 缺口对照

| 链路 / 能力 | 现状 | 进阶怎么补 |
|-------------|------|------------|
| HTTP Request | Fastify | 保持 |
| Middleware | 无 | Request-Id，写入 log |
| Guard | **使用**现成 JWT，没自己写 | 自写 `AiQuotaGuard`（配额） |
| Interceptor | Notes 耗时头 | 可复用；任务接口打 Request-Id |
| Pipe | **使用** ValidationPipe / ParseIntPipe | 自写 Trim 或日期 Pipe |
| Controller / Service / ORM | 已熟 | 任务模块 |
| Database | Prisma **SQLite** | 迁 **PostgreSQL** |
| JWT / DTO / Validation | 已熟 | 任务创建 DTO；`@CurrentUser()` |
| Exception | 抛 Nest 异常 + 上传 Filter | Prisma/队列错误统一 Filter |
| Redis | 无 | 配额、任务状态、限流 |
| Queue | 无 | BullMQ：AI 生成进 worker |
| Docker | api+web+nginx，无 DB/Redis | compose 加 postgres、redis、worker |

不做：GraphQL、微服务拆仓库、多租户角色（仍单用户）。

### 阶段 A — 补全 Nest 请求链（仍 SQLite）

业务：给 Notes 或即将出现的「任务」接口走完整链；**改密**用上 `@CurrentUser()`。

| 练习 | 练什么 | 落在产品上 |
|------|--------|------------|
| **9** | `createParamDecorator` + JWT `request.user` | `@CurrentUser()`；`GET /api/auth/me` 与 Notes 各用一处 |
| **10** | Middleware | 每个请求生成 `X-Request-Id`，Logger 带上 |
| **11** | 自写 Guard | `AiQuotaGuard`：未登录 401（仍 JWT）；超额 429。先把计数放 SQLite/内存，C 阶段再换 Redis |
| **12** | 自写 Pipe | 例如 TrimPipe，挂在创建任务/改密的字符串字段 |
| **13** | Exception Filter | Prisma `P2025` → 404；未知错 500 中文；**不要拆掉**现有上传 Filter |

验收：一张请求从进到出能在 log 里看到 requestId；无 Token 停在 Guard；非法 body 停在 Pipe；Controller 不再手写 `req.user`。

### 阶段 B — PostgreSQL + Docker 数据面

业务：库换成 PG，compose 可一键起。**不迁旧 SQLite 业务数据**（与现决策一致，seed 即可）。

| 练习 | 练什么 | 落在产品上 |
|------|--------|------------|
| **14** | Prisma datasource PG；新 migration 基线 | `DATABASE_URL`；本地 compose `postgres` 或 `D:\software\pg` |
| **15** | Docker | compose：`postgres` + 现有 `api`/`web`；api 等 PG healthy 再启动 |

验收：`docker compose up` 能登录；SQLite 文件不再作为生产路径（本地无 compose 时可用 env 切回 SQLite **仅若你仍要双引擎，否则 B 之后只保留 PG**）。

### 阶段 C — Redis + Queue（AI 任务中心）

业务（真正扩展）：

1. `POST /api/jobs/weekly-report`（JWT + DTO + QuotaGuard）：入队「生成周报」，立即返回 `{ jobId, status: queued }`  
2. Worker 调现有 AI 逻辑，结果写入 PG  
3. `GET /api/jobs/:id` 查状态：`queued | active | completed | failed`  
4. 前端周报页可轮询或继续用 SSE 订阅进度（二选一，先轮询更简单）  
5. Redis：任务状态/限流计数；BullMQ 用同一 Redis

| 练习 | 练什么 | 落在产品上 |
|------|--------|------------|
| **16** | Redis | 配额计数从 A 的内存/SQLite 迁到 Redis |
| **17** | Queue + Worker | compose 加 `redis`、`worker`（可与 api 同镜像不同 `command`） |
| **18** | 联调全链路 | 带 Token 入队 → worker 跑 → GET 完成；超额 429；非法 DTO 400 |

现有同步 `generate-report` 可保留作开发开关，或逐步改成入队，避免两套长期分叉。

### 建议顺序

**9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18**  
先把请求链在现有进程里看清楚，再引入 PG/Redis，最后才是队列（否则排错时分不清是 Nest 还是基础设施）。

下一步：练习 12 需求已开（TrimPipe）。

## 下一对话建议开场动作

1. 用户实现练习 12，或卡住提问。  
2. PG 17 已装，迁库仍待练习 14；勿提前改 schema。  
3. 上云剩余：证书 / htpasswd / 服务器 `.env`。  
4. `npm run start:dev`（注意勿多开占 3000）。