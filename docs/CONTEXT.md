# 个人研发效能助手 — 跨对话上下文

> **给后续 Agent / 新对话**：开场先读本文件，再读 `docs/10001/技术方案.md`。  
> **维护约定**：每次对话只要产生需求变更、技术决策、实现进度或待办变化，必须在结束前更新本文件（追加「变更日志」并改「当前状态」）。

## 项目标识

| 项 | 值 |
|----|------|
| 工作区 | `d:\工作\code\assistant` |
| Git | 已 `git init -b master`；单人开发 |
| featId | `10001` |
| 技术方案 | [docs/10001/技术方案.md](./10001/技术方案.md) |

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
9. DB：sql.js 持久化到 `data/assistant.sqlite`（因 Windows 缺 VS 未用 better-sqlite3）。
10. 文件本地存储；暂不云部署。
11. 工时 ai小助手对话：Markdown 渲染 + SSE 流式。

## 当前状态

| 维度 | 状态 |
|------|------|
| 需求澄清 | 已完成 |
| 技术方案 | 已完成 |
| 代码实现 | **MVP 已落地**（前后端可本地跑） |
| 默认管理员 | `admin` / `admin123`（见 README） |
| 联调 | 登录、工时导入、规则周报生成已用样例验证；AI 需自行配置 Key |

## 目录

```text
apps/web/          Angular 19.2 + ng-zorro
apps/api/          NestJS + TypeORM + sql.js
data/              sqlite + uploads + sample-worktime.xlsx
docs/10001/技术方案.md
docs/CONTEXT.md
README.md
```

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

## 下一对话建议开场动作

1. 读本文件 + 技术方案。  
2. 若要增强：真实图1/图3 Excel 联调、AI Key 联调、改密、PG 迁移等。  
3. 本地启动见 README 双终端命令。
