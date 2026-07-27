# 个人研发效能助手

本地个人工具：工时周报生成、系统参数配置可视化、AI 配置。

- 前端：Angular 19.2 + ng-zorro（`apps/web`）
- 后端：NestJS + TypeORM + sql.js（SQLite 文件，`apps/api`）
- 文档：[docs/CONTEXT.md](docs/CONTEXT.md) · [docs/10001/技术方案.md](docs/10001/技术方案.md)

## 环境

- Node.js 20+
- Windows / macOS / Linux 均可

> 说明：本机若无 Visual Studio C++ 构建工具，后端使用 **sql.js**（纯 JS SQLite）而非 `better-sqlite3`。

## 安装

```bash
cd apps/api
npm install

cd ../web
npm install
```

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

## 功能入口

1. **工时周报**：上传工时汇总 Excel → 生成周报（无 AI Key 时仍按任务号规则聚合，AI 字段留空）→ 编辑 → 复制 Markdown / 带格式文本  
2. **系统参数配置**：上传配置 Excel（全量覆盖）→ 表格检索 / 模块统计 → 详情含图片 → AI 分析  
3. **系统配置**：填写 DeepSeek `baseUrl` / `model` / `apiKey`，可测试连接  

## 样例数据

仓库内提供 `data/sample-worktime.xlsx` 可用于快速验证工时导入。

## 数据目录

```text
data/
  assistant.sqlite   # 自动生成
  uploads/           # Excel 提取的图片等
```

上述文件默认 gitignore，勿提交真实 API Key。
