# 个人研发效能助手 — 跨对话上下文

> **给后续 Agent / 新对话**：开场先读本文件，再读 `docs/10001/技术方案.md`；若要对照代码消化全系统，读 [系统消化文档.md](./10001/系统消化文档.md)。  
> **维护约定**：每次对话只要产生需求变更、技术决策、实现进度或待办变化，必须在结束前更新本文件（追加「变更日志」并改「当前状态」）。

## 项目标识

| 项 | 值 |
|----|------|
| 工作区 | `d:\工作\code\assistant` |
| Git | 已 `git init -b master`；单人开发 |
| featId | `10001` |
| 技术方案 | [docs/10001/技术方案.md](./10001/技术方案.md) |
| 系统消化文档 | [docs/10001/系统消化文档.md](./10001/系统消化文档.md) |

## 一句话目标

本地可运行的个人研发效能 Web：登录后，(1) 工时 Excel → AI 周报；(2) 配置洞察（参数 Excel → 可检索可视化表 + AI 分析/对话）；(3) AI/系统配置。Angular 19.2 + ng-zorro + NestJS + SQLite(sql.js)。

## 已确认决策（勿再追问除非用户改口）

1. Monorepo：`apps/web` + `apps/api` 目录分离。
2. 登录：单用户，预置管理员，无注册。
3. 工时周报：只吃本地 Excel；表头自动识别；不要版本标签；不接 Worktile。
4. 缺陷归类：Excel「任务类型」列。
5. 不按自然周切分：整次导入生成一份周报。
6. 周报可编辑；复制富文本 + Markdown；AI 字段失败则空。
7. 配置洞察（原系统参数）：物理行、空/重复 key、Excel 行号、全量覆盖、提图；AI 支持全量/多选整行分析 + 右侧对话；分析与对话均为 Markdown 预览 + SSE 流式。
8. AI：DeepSeek 兼容协议，Key 存服务端；chat/completions 支持 stream。
9. DB：sql.js 持久化到 **`apps/data/assistant.sqlite`**（因 Windows 缺 VS 未用 better-sqlite3）。
10. 文件本地存储。
11. 工时 ai小助手对话：Markdown 渲染 + SSE 流式。
12. **（2026-07-29）部署形态：单台云主机 + Docker Compose + nginx 反代，前端静态文件同源托管。**
13. **（2026-07-29）DB 演进：保留 sql.js，后期直接上 PostgreSQL，不中途换 better-sqlite3（避免驱动迁移做两遍）。`synchronize: true` 一并留到上 PG 时再关。**
14. **（2026-07-29）上线原则：只做「影响上线部署」的改动，且所有改动必须兼容本地运行（默认值保持现状，靠环境变量/`isDevMode()` 区分）。**

> ⚠️ **运维铁律（sql.js 期间）**：只能单实例。compose 不得加 `replicas`，不得做新旧进程重叠的滚动发布（每进程持有整份内存 DB 并全量覆写同一文件，并发写=后写者赢、前者全丢）。导入或 AI 分析进行中不要重启容器。

## 当前状态

| 维度 | 状态 |
|------|------|
| 需求澄清 | 已完成 |
| 技术方案 | 已完成 |
| 代码实现 | **MVP 已落地**；2026-07-29 完成上云改造（同源部署 + 密钥强制 + 上传限制 + 导入事务） |
| 部署就绪 | 产物齐备（Dockerfile×2 / compose / nginx.conf）；待服务器侧配证书与 `.htpasswd` |
| 默认管理员 | `admin` / `admin123`（见 README） |
| 联调 | 登录、工时导入、规则周报生成已用样例验证；AI 需自行配置 Key |

## 目录

```text
apps/web/          Angular 19.2 + ng-zorro
apps/api/          NestJS + TypeORM + sql.js
apps/data/         ★ 真实运行数据：assistant.sqlite + uploads/
data/              仅 sample-worktime.xlsx + .gitkeep（非运行数据）
docs/10001/技术方案.md
docs/10001/系统消化文档.md
docs/CONTEXT.md
README.md
```

> ⚠️ **数据目录易错点**：`common/paths.ts` 的 `ROOT_DIR = join(__dirname,'..','..','..')` 从 `apps/api/src/common` 上溯三级实际落在 `<repo>/apps`，故运行数据在 **`apps/data/`**，不是根目录 `data/`。实测：`apps/data/assistant.sqlite` 1.1MB、`apps/data/uploads` 162 文件 34.5MB。配置持久卷时若照旧文档挂 `data/` 会挂到空目录，数据留在容器可写层，`docker compose down` 即丢且全程不报错。

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

- [x] **导入事务**（`sys-params.service.ts`）：`dataSource.transaction` + `manager.clear(SysParam)`；失败时 `rmSync` 清理本次新建的图片目录，避免孤儿目录。
- [x] **上传 limits**（`common/upload.ts`）：50MB + 仅 `.xlsx`（扩展名在 `decodeMulterFilename` 之后判断）；新增 `MulterExceptionFilter` 把 `LIMIT_FILE_SIZE` 映射为 400 中文提示（否则是 500）。

### 明确推迟

sql.js → PG（连 `synchronize` 关闭 + 初始 migration 一起做）、`/uploads` 签名 URL（Basic Auth 暂兜）、AI 限流、AI HTML 消毒、周报对话 `taskName` bug、导入图片目录清理。

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

## 下一对话建议开场动作

1. 读本文件 + 技术方案；深入读代码时打开系统消化文档。  
2. 若要增强：真实图1/图3 Excel 联调、AI Key 联调、改密、PG 迁移等。  
3. 本地启动见 README 双终端命令。
