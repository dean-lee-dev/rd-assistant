# NestJS 手写练习要点（1–18，除 15）

> 仓库：个人研发效能助手 `apps/api`（Nest Fastify + Prisma）+ `apps/web`（Angular 19）。  
> 约定：Agent 给需求，自己实现，卡住再问，做完 review。  
> 熟练标准：能独立加一个与现网风格一致的功能模块（Module / Controller / Service / DTO / JWT / Prisma / 合适的 HTTP 状态码）。  
> 练习 **15**（腾讯云 2C2G compose）需求已开，见 `docs/CONTEXT.md`。本地开发路径不变。  
> 整理日期：2026-08-26。

读法：每一块先看 **知识串**（这一块在整条学习轨上干什么），每道题先看 **在串上的位置 + 知识**（把概念讲开），最后看加粗的 **要点**（要记住、review 里反复踩的那几句）。文末再把四块收成一条总链。

测接口打 **3000**（curl / Apifox 桌面版），不要打前端 **5173** 的业务路由，否则会被 Angular SPA 吃掉。全局前缀 `api`，完整路径形如 `/api/health`。JWT 必须是 `Authorization: Bearer <token>`，token 须由本项目 `POST /api/auth/login` 签发。只开一个 `start:dev`（端口 3000）。不要把真实密码、API Key 写进文档或 Git。

---

## 总览：四块其实是一条链

```text
怎么接到 Nest 上？          1–7   模块、路由、DTO、JWT、Prisma、HTTP 语义
请求在框架里怎么走？        8–13  Middleware → Guard → Interceptor → Pipe → Controller → Filter
数据存在哪、怎么换引擎？    14    SQLite 文件 → 本机 PostgreSQL（15 = 换到容器里，上云再做）
慢活怎么从 HTTP 里拆出去？  16–18 配额进 Redis → 任务进队列 → 前端只轮询
```

前一块的产出是后一块的输入：没有 Notes 模块，请求链没地方挂；没有稳定的 HTTP 语义，换 PG / 加队列时分不清 400、404、429；没有 Redis，BullMQ 没地方放任务状态。

请求进入后的顺序（第二块会展开，这里先钉死）：

```text
Request → Middleware → Guard → Interceptor → Pipe → Controller → Service
                                                              ↓ 抛错
                                                         Exception Filter
```

---

## 第一块：模块与 CRUD（练习 1–7）

### 知识串

Nest 的基本单元是 **Module**。一个功能 = 一个目录 + `XxxModule` 登记到 `AppModule.imports`。请求打进来，先命中 **Controller** 上的路由，再交给 **Service** 做业务。Controller 不写 SQL、不读文件流；Service 不拼 HTTP 状态码细节（状态码用异常和装饰器表达）。

这一块按「越来越像真实接口」往上叠：

1. 先有一个**无鉴权**的 `GET`，证明模块挂上了（练习 1）。  
2. Service **读库**，需要登录的接口再套 JWT（练习 2）。  
3. **写入**必须先过 DTO：不合法的 body 在进 Service 之前变成 400（练习 3）。  
4. JSON 之外还有 **multipart 文件** 和 **SSE 长连接**，HTTP 语义和劫持时机不同（练习 4、5）。  
5. 列表 + 创建不够，按 id 查改删才是 REST；路径参数、404、PATCH、204 是一套（练习 6）。  
6. 列表不能全表拉进内存再 `slice`，query 还是字符串，要 DTO 转数字再 `skip`/`take`（练习 7）。

沙盒是 **Notes / Files / Ticks**，不要改工时周报、配置洞察的导入和 AI stream。练的是「怎么接」，不是「怎么改产品」。

本仓库 HTTP 层是 **Fastify** 不是 Express：上传用 `@fastify/multipart` 的 `req.file()`，SSE 用 `FastifyReply.hijack`，静态目录用 `@fastify/static`。看到 `FileInterceptor` / Express `Response` 就要停手。

### 练习 1 — 健康检查

**在串上的位置**：证明「新建目录 → Module → AppModule → 路由能打到」。还没有库、没有 JWT。

**知识**：`@Controller('health')` 加上全局前缀 `api`，完整路径是 `/api/health`。`HealthModule` 必须出现在 `AppModule.imports` 里，否则 Controller 根本不会被扫描。Nest **不校验**类名和文件名是否一致，只认 `import` 路径和磁盘是否对得上——`HealthModule` 放在 `healty.module.ts` 里也能跑，只是以后不好找。

开发时 `npm run start` 没有 watch，改代码要手动重启；学习期用 `start:dev`。

**要点**：

- 模块不进 `AppModule` = 路由不存在。  
- 路径永远带全局前缀：`/api/health`。  
- 文件名跟 import 走，不跟类名走。

### 练习 2 — 只读查库

**在串上的位置**：Service 第一次碰 Prisma；「要登录才能看」第一次碰 JWT。Controller 仍然只 `return this.healthService.xxx()`。

**知识**：Passport JWT 从请求头取 token 的方式是 `fromAuthHeaderAsBearerToken()`，所以头必须是 `Bearer <token>`，少前缀、双前缀、用别的项目签发的 token，一律 401。`JwtStrategy.validate()` 的返回值会挂到 `request.user`，本仓库形状是 `{ userId, username }`（`userId` 来自 payload 的 `sub`），**没有** `user.id`。

测 API 必须打后端 3000。打前端 5173 的 `/health` 会进 Angular 壳，看起来像「总是跳转到系统中」。浏览器里的 Apifox Web 还可能被 CORS 卡住 body（当时只放行 5173），桌面版或 curl 更干净。

查库时不要写死 `id: 1`。单行配置表可以用 `take: 1`；多行必须先定义语义（任一有效 Key / 最新一条），再写 `where`。空串、null、只含空格的 `apiKey` 都不算「已配置」。

**要点**：

- Controller 不写 SQL；JWT 字段是 `userId` 不是 `id`。  
- 测 API 用 3000；头是 `Bearer ` + 本项目 login 的 `accessToken`。  
- 查询条件跟业务语义走，不跟「第一条记录的主键碰巧是 1」走。

### 练习 3 — 带校验的写接口

**在串上的位置**：第一次 **写库**。写入和读取的分水岭是：读可以宽松，写必须先过 **DTO + ValidationPipe**，非法数据不得进 Service。

**知识**：`main.ts` 已有全局 `ValidationPipe({ whitelist: true, transform: true })`。`whitelist` 会剥掉 DTO 上没声明的字段，防止随便往库里塞键；`transform` 会按 DTO 类型做转换（练习 7 的 query 数字依赖它）。DTO 用 `class-validator` 装饰器描述规则，校验失败框架给 **400**，不必在 Controller 里手写一堆 `if`。

DTO 按模块放 `notes/dto/create-note.dto.ts` 是 Nest 常见结构。属性由 Pipe 注入、没有构造赋值，TypeScript 要写成 `title!: string`（definite assignment），写成 `title: string` 会报未初始化。`@IsOptional()` + `@IsNotEmpty()` 叠在一起，对「字段根本没传」偏松，必填标题不要标成 optional。

**要点**：

- 非法 body → **400**，发生在进 Service 之前。  
- 必填用 `title!: string` + 非 optional 校验；列表字段名与约定对齐（`items`）。  
- DTO 和 Controller 同模块，不要在 Controller 里堆校验 if。

### 练习 4 — 小文件上传

**在串上的位置**：body 不再是 JSON。文件是 **磁盘上的字节**，数据库只存 **元数据**（原名、存储名、大小、相对路径）。两套存储必须指向同一文件。

**知识**：Fastify multipart 用 `req.file()` 拿到 part，`toBuffer()` 把流读完。流只能消费一次，读两遍第二遍是空的。扩展名要在 `decodeMulterFilename` 之后再判断（原始文件名可能是编码过的）。磁盘名用 uuid（`storedName`），`url` 形如 `/uploads/files/xxx.png`，由已有静态挂载 `/uploads` 对外提供；`relativePath` 必须和磁盘文件对得上。

运行时上传目录是 **`apps/data/uploads/`**（`paths.ts` 的 `ROOT_DIR` 上溯三级落在 `apps`），不是仓库根 `data/`。新表流程：`schema.prisma` 加 model → `npm run db:migrate:dev` → 代码 `prisma.uploadedFile`。大小是**上限** 2MB → 400 中文，不是下限。

**要点**：

- 文件在磁盘，元数据在 PG；`url` 和落盘路径必须是同一份。  
- `toBuffer()` 只读一次；扩展名先解码再判断。  
- 新表 = schema + migrate + `prisma.xxx`，三步缺一不可。

### 练习 5 — SSE 流式输出

**在串上的位置**：响应不再是「一次 JSON 完事」，而是 **hijack 连接后分段推**。一旦劫持，普通 HTTP 状态码通道就关了——所以 **校验和 401 必须发生在劫持之前**。

**知识**：协议与现网周报对话相同：`data: JSON\n\n`，结束时 `{"type":"close"}`。复用 `common/sse.ts` 的 `initSse` / `writeSse` / `endSse`。无 Token 时 JWT Guard 在进 Controller 前就 401 JSON，此时还没 SSE。`n` 非法要 `BadRequestException`（400 JSON）；写在 `initSse` 之后就只能往流里塞 `{ type: 'error' }`，客户端按 SSE 解析，Apifox 也看不到标准 400。

Service 用 `async function*` 产出 tick，Controller `for await` 消费。延时用 Promise 包 `setTimeout`，同步 `while` + 空转会占满 CPU。流中途异常：先 `writeSse({ type: 'error', message })` 再 `endSse`，不要让连接裸断。

后面练习 11 把配额挂在这个接口上，正因为它「贵」且路径单一，适合当限流沙盒。

**要点**：

- **先校验 / 先 JWT，再 `initSse`。** hijack 之后没有普通 400/401。  
- 无 Token → 401 JSON；`n` 非法 → 400 JSON；成功才是 `text/event-stream`。  
- 异步生成器 + 定时 Promise，不要同步死循环。

### 练习 6 — 按 id 查改删

**在串上的位置**：练习 3 只有「集合」（列表 + 创建）。现在补「资源」（某一个 id）。REST 的状态码在这里定型：**400 参数废、404 没有这个资源、204 删掉且无 body**。

**知识**：`@Param('id', ParseIntPipe)` 把路径里的字符串变成 number，`abc` 过不了 Pipe，框架直接 400，进不了 Service。资源不存在用 `NotFoundException` → 404 中文（练习 13 会改成让 Prisma 自己抛 `P2025`，Filter 再转 404，语义不变）。

PATCH 是部分更新：字段都可选，但「一个都不传」没有意义，要 400；没出现的字段保持原值，不要把 `undefined` 写成清空。DELETE 成功应 `@HttpCode(HttpStatus.NO_CONTENT)`，默认 200 带 body 不符合「删掉了」。

路由顺序：静态路径要写在参数路径前面。练习 9 的 `GET /notes/me` 若写在 `GET /notes/:id` 后面，`me` 会被 `ParseIntPipe` 当成 id 变成 400。

**要点**：

- 非法 id → Pipe **400**；不存在 → **404**；删除成功 → **204**。  
- PATCH「没传」≠「清空」；至少要有一个字段。  
- 静态路由（`me`）必须写在 `:id` 前面——练习 9 会再踩一次。

### 练习 7 — 列表分页与查询参数

**在串上的位置**：列表从「全表倒序」变成「可检索的页」。query 和 body 一样要进 DTO，但 query **默认全是字符串**，这是和 POST JSON 最大的差别。

**知识**：`@Query() query: ListNotesQueryDto` 收一整包，不要拆成多个 `@Query('page')`（配置洞察那样是历史写法，这次要学 DTO）。`page`、`pageSize` 要 `@Type(() => Number)`，否则 `"1"` 进不了 `@IsInt()`——全局 `transform: true` 只在你标明类型后才转。

Prisma 侧：`skip = (page - 1) * pageSize`，`take = pageSize`，`count` 与 `findMany` 用**同一** `where`（有 `q` 时 title/content `contains`），建议 `Promise.all`。`total` 是过滤后的总条数，不是当前页 `items.length`。禁止 `findMany()` 全表再 `slice`——数据一多就炸内存，也不是数据库分页。

**要点**：

- query 是字符串，数字必须 `@Type(() => Number)`。  
- `skip`/`take`/`count` 条件一致；`total` ≠ `items.length`。  
- 一个 Query DTO，不要散装 `@Query('page')`。

### 第一块收束

**串**：Module 挂上 → Service 读库 + JWT → DTO 管写入 → 文件/SSE 是特殊 HTTP → REST 补齐资源语义 → query 分页在数据库做。

**要点**：

- Controller 调度，Service 干活，DTO 挡非法输入。  
- 400 校验、401 没登录、404 没资源、204 删成功——后面请求链只是换「谁来抛」，语义不变。  
- Fastify 上传和 SSE 都有「时机」：流读一次；劫持前完成校验。

---

## 第二块：请求处理链（练习 8–13）

### 知识串

第一块已经能写出接口。第二块问的是：同样一个 `POST /api/notes`，框架在进你的 `create()` **之前和之后**还插了哪些层？这些层不是装饰，是职责划分：

| 层 | 它决定什么 | 它不该干什么 |
|----|------------|--------------|
| Middleware | 每个请求的公共标记（Request-Id） | 不算耗时、不做业务拒绝 |
| Guard | **能不能进**：401 / 429 / true | 不改 body、不算耗时 |
| Interceptor | 包住调用：记耗时、加响应头 | 不改 JSON 形状（本次约定） |
| Pipe | **参数长什么样**：改值或 400 | 不负责「谁来访」 |
| 参数装饰器 | 从 request 上抠已经放好的东西 | 不鉴权；没有 Guard 就可能是 undefined |
| Controller / Service | 业务 | 少手写 `req.user`、少手写 404 拼装 |
| Filter | 异常变成哪一种 HTTP | 不要第二个 `@Catch()` 把 401/429 吃掉 |

练习编号是 8→9→11…，但真正运行顺序是 **10 → 11 → 8 → 12 → 9 → Controller → 13**。先学 Interceptor（8）是因为它和 Controller 最近、容易看见耗时头；再补「从哪取 user」（9）；然后才补更靠前的 Middleware / Guard，以及更靠后的 Pipe / Filter。读的时候按**运行顺序**串，按**练习号**对照代码。

每一层都有一个「忘了调用下一环」的坑：Middleware 忘 `next()`、Interceptor 忘 `return next.handle()`，请求会一直转圈。Guard 则相反：该拒绝时不能只 `return false`（变成 403），要按语义 `throw`。

挂载范围也是知识点：Request-Id 是全站的（health 也要有）；Notes 耗时头只挂 Notes（health 必须没有）；配额只挂贵接口。**全局还是局部，用验收接口对照**，不要凭感觉。

### 练习 8 — Interceptor

**在串上的位置**：Guard 已经放行之后，包住 Controller 的前后。适合做耗时、日志、统一包装（本次**禁止改 JSON 形状**，只做副作用）。

**知识**：`intercept` 必须 `return next.handle().pipe(...)`。`next.handle()` 返回 RxJS Observable，Controller 的返回值（含 Promise）会被 Nest 转成这条流。不 return，后面的层不会跑，客户端一直 pending。

`tap` 只在 **next 成功发出**时跑；`NotFoundException` 走 error 通道，只用 `tap` 则 404 没有耗时头。成功失败都要记，用 `finalize`。设头用 Fastify 的 `response.header(...)`。

Interceptor ≠ Filter：Filter 只在**抛错之后**改响应；Interceptor 在成功路径上也能跑。现有 `UploadExceptionFilter` 不要改、不要当成拦截器。

只挂 `NotesController` 的 `@UseInterceptors`。`APP_INTERCEPTOR` / `useGlobalInterceptors` 会让 health 也带 `X-Response-Time`，验收就失败。

**要点**：

- **必须 `return next.handle()`**，否则一直转圈。  
- `tap` 看不到 404；要覆盖失败用 `finalize`。  
- 只挂 Notes；health **没有** `X-Response-Time` 才证明不是全局。

### 练习 9 — `@CurrentUser()`

**在串上的位置**：Pipe 之后、方法参数绑定之时。它不创造 user，只从 `request.user` 读取——而 `user` 是 **JWT Guard 的 `validate()` 挂上去的**。

**知识**：`createParamDecorator((data, ctx) => ...)`。`ctx.switchToHttp().getRequest().user` 就是 `JwtUser`。`data` 对应 `@CurrentUser('userId')` 里的 `'userId'`；不传 `data` 则返回整个对象。没有 JWT Guard 的路由上 `user` 是 `undefined`，装饰器不会自动 401。

这是「使用 JWT」和「手写 Guard」的分界：练习 2 起我们**使用** `AuthGuard('jwt')`；练习 11 才**手写**配额 Guard。装饰器属于使用侧：Controller 不再 `@Req() req.user`。

`GET /api/notes/me` 必须写在 `GET /api/notes/:id` 前面，否则进入练习 6 的 `ParseIntPipe`，`me` → 400。不要改 `JwtStrategy` 的 payload 形状，装饰器与 `validate()` 对齐即可。

**要点**：

- 装饰器只读 `request.user`，不鉴权；没 Guard 就是 `undefined`。  
- `@CurrentUser()` 整对象，`@CurrentUser('userId')` 用 `data`。  
- `me` 写在 `:id` 前面。

### 练习 10 — Middleware（Request-Id）

**在串上的位置**：整条链**最早**。Guard 还没跑，health、登录也会经过。适合给每个请求打一个贯穿日志的 id，不适合做「拒绝访问」（那是 Guard）。

**知识**：`AppModule implements NestModule`，`configure(consumer).apply(RequestIdMiddleware).forRoutes(...)`。参数是 Express 风格 `(req, res, next)`，**不是** `ExecutionContext`（那是 Guard / Interceptor / 装饰器）。必须 `next()`，否则链中断。

三件套容易混：

| 东西 | 谁看得见 | 干什么 |
|------|----------|--------|
| 入站头 `x-request-id` | 客户端带来 | 沿用，便于前后端对账 |
| `req.requestId` | 仅服务端后续层 | Guard/Interceptor/日志读取 |
| 响应头 `X-Request-Id` | 客户端 | 回传同一个 id |

Node 把头名转成**小写**，必须读 `x-request-id`；读 `X-Request-Id` 会永远认为没有入站头，每次生成新 id。没有入站头再用 `crypto.randomUUID()`（`node:crypto`，不要为这加 uuid 包）。

Nest 加上全局前缀后，中间件里的 `req.url` 可能被剥成 `/`。打日志的完整路径用 `originalUrl`。本练习要的是 `NestMiddleware`，不要只用 Fastify `addHook` 代替——那学不到 `NestModule.configure`。

对照练习 8：health **有** `X-Request-Id`（全局中间件），**没有** `X-Response-Time`（局部拦截器）。

**要点**：

- 必须 `next()`；参数是 `(req, res, next)`。  
- 入站小写头 / `req.requestId` / 响应头，三件不是一回事。  
- health 有 Request-Id、无耗时头，用来区分全局 vs 局部。

### 练习 11 — 自写 Guard（配额）

**在串上的位置**：Middleware 之后、Interceptor 之前。JWT Guard 先把 `user` 挂上；配额 Guard 再决定「这个 user 还能不能调用这个贵接口」。

**知识**：`CanActivate`。`return true` 放行；`return false` 框架变成 **403 Forbidden**。配额超额的语义是 **429 Too Many Requests**，所以必须 `throw new HttpException('AI 调用次数已达上限', HttpStatus.TOO_MANY_REQUESTS)`，不能只 return false。

无 `user` 应 401：正常情况 JWT 已经挡掉无 token；配额 Guard 再判一次，是防漏挂 JWT，以及运行时 `user` 为空。读的是 `user.userId`，不是 `user.id`（和练习 2、9 同一套形状）。

挂载：`@UseGuards(AuthGuard('jwt'), AiQuotaGuard)`，**JWT 在前**。只挂 `POST /api/ticks/stream`。做成 `APP_GUARD` 会让 notes/health 一起限流。需要注入时在 `TicksModule.providers` 登记。不要用 `@nestjs/throttler`——本练习就是自己写。

计数先放实例上的 `Map`（Nest 默认单例，进程内共享）。重启 `start:dev` 归零。这不是缺陷，是为练习 16 对比「内存 vs Redis」预留的：同一套 Guard 接口，换存储。

**要点**：

- **`return false` → 403；429 必须 `throw`。**  
- JWT 在前、配额在后；字段是 `userId`。  
- 只挂 ticks；不要全局 APP_GUARD。内存 Map 重启即丢，这是 16 要修的。

### 练习 12 — 自写 Pipe（Trim）

**在串上的位置**：Guard 已放行，参数即将进 Controller。全局已经有 ValidationPipe 做**校验**；TrimPipe 做**改值**。Pipe 的两种合法结局：返回新值，或 throw（400）。它不是 Guard，不要 `return false`。

**知识**：`PipeTransform.transform(value)`。string 就 `trim()`；普通对象只扫**第一层**，且必须 `typeof === 'string'` 才 trim——`content` 没传是 `undefined`，对其 `.trim()` 会抛 TypeError 变成 500。number、文件、数组原样返回，以免弄坏 multipart。

和全局 ValidationPipe 的顺序：常见是先全局校验、再参数 Pipe。于是 `"   "` 可能先通过 `@IsNotEmpty()`，再被 trim 成 `""` 入库。本练习验收只要求「有字的标题去掉首尾空格」，不必处理这种边界。不要用 class-transformer 的 `@Transform` 代替这个 Pipe 类（以后可以并用，这次必须是 Pipe）。

只挂 Notes 的 POST/PATCH：`@Body(TrimPipe)`。不要全局，不要挂上传、不要挂 `GET` 的 `q`。

`ParseIntPipe`（练习 6）也是 Pipe：非法 id → 400。Trim 是同一类机制的「手写版」。

**要点**：

- Pipe **改值或 throw**，不是放行/拒绝。  
- 只 trim 第一层 string；`undefined` 不能 `.trim()`。  
- 只挂写 Notes；全局 ValidationPipe 仍负责 400 校验。

### 练习 13 — Exception Filter（Prisma P2025）

**在串上的位置**：Service / ORM 已经抛错，链路的最后一公里。Filter 决定客户端看到的 **HTTP 状态和中文消息**。练习 6 的「先 findUnique 再 `NotFoundException`」是业务里手动 404；现在改成「让 Prisma 抛、Filter 统一翻成 404」，Notes 可以不再 import `NotFoundException`。

**知识**：`findUnique` 找不到返回 `null`，**不抛**。`findUniqueOrThrow` / `update` / `delete` 找不到才抛 `PrismaClientKnownRequestError`，`code === 'P2025'`。所以要改 NotesService：GET 用 `OrThrow`，PATCH/DELETE 直接 `update`/`delete`，不要先查再抛，也不要自己 `new PrismaClientKnownRequestError`。DELETE 只调一次 `delete`：先删成功再删一次，第二次就是 P2025，存在的 id 会变成 404。

`@Catch(Prisma.PrismaClientKnownRequestError)` 只接这一种错。再写一个无参 `@Catch()` 且没把 `HttpException` 原样写出，校验 400、JWT 401、配额 429 全会坏掉。`P2025` → 404 中文「记录不存在」（Filter 是全局的，不要写死「备忘录」）；其它 Prisma known error → 500 中文，不要把英文 / SQL 回给客户端。`P2025` 是 Prisma 的 `code` 字符串，不是 HTTP 状态码。

`main.ts` 里 `useGlobalFilters(UploadExceptionFilter, PrismaExceptionFilter)` **两个都留**。上传超限仍 400 中文，证明上传 Filter 还在。

**要点**：

- 谁抛 P2025：`OrThrow` / `update` / `delete`；`findUnique` 不抛。  
- `@Catch` 要窄；宽了会吃掉 400/401/429。  
- DELETE 只删一次；P2025 → 404，其它 Prisma → 500 中文。

### 第二块收束

**串（运行顺序）**：Middleware 打 id → Guard 决定进不进（401/429）→ Interceptor 包耗时 → Pipe 改/校验参数 → 装饰器取 user → Controller/Service → 抛错进 Filter。

**要点**：

- 忘 `next()` / 忘 `return next.handle()` → 一直转。  
- Guard 要 429 就 `throw`，不要 `return false`（那是 403）。  
- 全局 vs 局部用 health 对照：Request-Id 有、耗时头无、配额无。  
- 404 可以由 `NotFoundException` 或 P2025 Filter 产生，客户端语义相同。

---

## 第三块：数据面（练习 14；15 已开）

### 知识串

第一、二块默认「有一个库能读写」。库最初是进程旁边的 **SQLite 文件**，Prisma 用 `file:...` 指过去。练习 14 把这句话改成：库是 **另一台服务上的 PostgreSQL**，连接串来自环境变量 `DATABASE_URL`。应用不再「碰巧旁边有个文件」，而是「配置说连谁就连谁」。

换引擎有三件必须一起动，缺一就会在运行或迁移时炸：

1. `schema.prisma` 的 `datasource.provider`  
2. `prisma/migrations/` 里的 SQL **方言**（`migration_lock.toml` 的 provider）  
3. 运行时 `DATABASE_URL`

SQLite 的旧 migration **不能** `migrate deploy` 到 PG。空库 + 现有 seed（admin、默认 AI 配置）即可，**不迁**旧业务数据。上传文件仍在磁盘，`DATA_DIR` 不再承载数据库文件。

练习 15 是同一句话的下一半：PostgreSQL 不装在开发者电脑上，而装在 **Docker Compose 的 postgres 服务**里，api 容器等它 healthy 再起，Dockerfile CMD 用真正的 `DATABASE_URL` 跑 `migrate deploy`，而不是再拼 sqlite。本地日常仍不用 Docker；15 在腾讯云 2C2G 上做。

### 练习 14 — Prisma 迁本机 PostgreSQL

**在串上的位置**：HTTP 链已经完整（练习 13 的 P2025 在 PG 上同样成立）。换的是「Service 下面那一层」。

**知识**：`provider = postgresql` 后，模型里的 `Json` 会变成 jsonb，这是期望行为。Notes 的 `contains` 在 PG 上默认大小写敏感（SQLite 往往不敏感），本练习不要求改。

`ensureDatabaseUrl()` 禁止再默认拼 `file:...sqlite`：没配 `DATABASE_URL` 应明确失败，避免「以为在 PG、其实又写回 sqlite 文件」。`.env` 不提交；`.env.example` 只放占位串。Dockerfile **构建**阶段 `prisma generate` 不连真实库，用占位 `postgresql://...` 即可，**不要写真实密码**。运行阶段 CMD 仍拼 sqlite——那是 15 的活。

旧 sqlite 文件可以留着当备份，进程不再读它。seed 仍会在空库写入 admin，登录账号与开发兜底一致。

**要点**：

- provider、migration 方言、`DATABASE_URL` 三者必须一致。  
- 没配连接串要失败，不要静默回 sqlite。  
- 不迁旧数据；不提交密码；P2025 Filter 在 PG 上继续有效。

### 练习 15 — Docker（已开 / 腾讯云 2C2G）

**在串上的位置**：把 14 的「本机 PG」换成「compose 网络里的 PG」，并带上 16–18 需要的 redis 与 worker。

**知识**：hostname 用服务名 `postgres` / `redis`，不要 `localhost`。api 与 worker 同一镜像、不同 CMD；只有 api 跑 `migrate deploy`。2C2G 不要在云主机上编译 Angular（易 OOM），加 swap 或本机 build 镜像。安全组只开 22/80/443。完整条目见 CONTEXT 练习 15。

**要点**：

- CMD 不再拼 sqlite；compose 有 postgres + redis + worker。  
- Worker 不要进 `AppModule`；5432/6379/3000 不对公网。  
- 本地 `start:dev` 不变。

### 第三块收束

**串**：业务代码几乎不动，变的是「库在哪」和「迁移脚本是哪种 SQL」。

**要点**：连接串来自环境；方言跟引擎走；文件上传目录 ≠ 数据库文件。

---

## 第四块：Redis、队列、前端联调（练习 16–18）

### 知识串

到这里，同步 HTTP 已经能走完「校验 → 鉴权 → 写 PG」。但生成周报要调 AI，可能几十秒。把这段放在 `POST /api/worktime/generate-report` 里，HTTP 连接一直占着，前端按钮一直转，进程一重启还可能把活弄丢。

拆法是三步，对应三道题：

1. **先限制谁能调用**（练习 16）：配额从「进程内存 Map」换成 Redis。同一套 `AiQuotaGuard`，存储换了，语义不变（3 次 / 429）。重启 api 不再清零——因为计数不在这个进程里了。  
2. **再把慢活挪出 HTTP 进程**（练习 17）：API 只 `Queue.add`，立刻返回 `jobId`；另一个 Node 进程里的 `Worker` 调现成的 `generateReport`，结果写入 **同一张 PG 周报表**。Redis 在这里身兼两职：配额 key，以及 BullMQ 的任务列表/状态。周报正文仍只在 PG。  
3. **前端按任务状态渲染**（练习 18）：不要等同步接口，POST jobs 后轮询 GET；`completed` 用 `reportId` 再拉周报；`failed` 展示 `error`。浏览器不跑生成，只问「好了没」。

三个进程：`start:dev`（HTTP）、`start:worker`（消费队列）、前端。只开 api 时任务一直 `queued`——这不是 bug，是证明活不在 HTTP 里。

同步 `generate-report` 保留作对照，配额**不**挂在它上面。页面改走 jobs 之后，生成才消耗配额（和 ticks 共用 `ai-quota:{userId}`）。

### 练习 16 — Redis（配额计数）

**在串上的位置**：练习 11 的 Guard **接口不变**（仍 `CanActivate`、仍 429 文案、仍只挂 ticks），变的是 `Map.set` 换成 Redis `INCR`。这是「同一层、换存储」，和 14「同一 ORM、换引擎」是同一类迁移。

**知识**：`INCR` 是原子的：并发两个请求不会都读到 3 再都写成 4。先 GET 再 SET 有竞态，两个人可能都过。`INCR` 之后 **> 3** 再 429（第 1、2、3 次分别变成 1、2、3，放行；第 4 次变成 4，拒绝）。`canActivate` 必须 `async`，因为要等 Redis。

连不上 Redis 不能装死成「无限调用」：启动时 PING 失败就 throw，或配额接口 503。静默退回 Map 会让你以为限流还在。key 约定 `ai-quota:{userId}`。不要 TTL（以后再说），不要 compose 加 redis，不要提交密码。重测：`redis-cli DEL ai-quota:1`。

**要点**：

- Guard 语义不变；**原子 `INCR`**，不要 GET+SET。  
- 重启 api 计数还在，这才叫换成 Redis。  
- 连不上要失败，不要退回内存。

### 练习 17 — Queue + Worker

**在串上的位置**：HTTP 进程从「做完再响应」变成「记账再响应」。真正干活的是第二个 Nest 应用上下文（`NestFactory.createApplicationContext`，不 `listen` 端口）。

**知识**：包名是 **`bullmq`**。`Queue.add` 入队，`Worker` 消费。`@nestjs/bullmq` 只是把这两样封进 Nest 模块，不是第三种队列。不要用浏览器 Web Worker，也不要 `worker_threads`——那些还在同一操作系统进程里，重启 HTTP 照样一起没。

两个入口各自是一套 DI 容器：

| 进程 | 入口文件 | 根 Module | 做什么 |
|------|----------|-----------|--------|
| API | `main.ts` | `AppModule` | `new Queue` + HTTP；**不** `new Worker` |
| Worker | `worker.ts` | `WorkerModule` | `new Worker`；调 `WorktimeService` |

HTTP 里 `PrismaModule` 是全局的，只对 **这个进程** 全局。Worker 必须自己 `imports: [PrismaModule, WorktimeModule]`，且 `WorktimeModule` 要 `exports: [WorktimeService]`。漏了 Prisma，AiService / WorktimeService 会在 worker 启动时拿不到依赖。

BullMQ 的 Redis 连接：`new Redis(REDIS_URL, { maxRetriesPerRequest: null })`。不要 `{ url: REDIS_URL }`，也不要复用配额那条 ioredis（blocking 命令和 BullMQ 要求冲突）。队列名两端必须一致，建议 `weekly-report`。

状态：BullMQ 的 `waiting` 对外映射成 `queued`。`completed` 时 GET 带 `reportId`，来自 worker `return { reportId: report.id }`，读 `job.returnvalue.reportId`。不要把 `job.id` 当成周报 id，也不要把整份周报塞进 returnvalue（那是 Redis，不是业务库）。`failed` 带可读 `error`；无导入时 `generateReport` 抛「请先导入工时 Excel」，任务失败、**worker 进程继续活**。

DTO：`importId` 可选 `@IsInt` + `@Type(() => Number)`，保持 number，不要 `String(importId)`。配额挂在 POST jobs 上，和 ticks 同一把 key——测之前可能要 DEL。只开 api：GET 一直 queued。

**要点**：

- API 只入队；Worker 在**另一进程**；两边队列名相同。  
- Worker 自己 import Prisma / 导出 WorktimeService。  
- `reportId` = 周报表主键，不是 jobId；失败是任务状态，不是进程崩溃。  
- 配额与 ticks 共用；同步 generate-report 仍无配额。

### 练习 18 — 前端入队 + 轮询

**在串上的位置**：用户看不见 jobId。页面要把练习 17 的状态机翻成 loading / 周报 / Toast。生成逻辑仍在 worker，前端只问。

**知识**：`generate()`：`POST /api/jobs/weekly-report` → 用 `jobId` 每秒 `GET /api/jobs/:id`。`queued`/`active` 保持 `generating`。HTTP **立刻**返回，所以按钮应马上进 loading，而不是等 AI。

`completed` 只带 `reportId`，要用 `GET /api/worktime/latest` 且 `report.id === reportId`（或加 `GET reports/:id`）。不要把周报塞回队列。拉到之后走原来的 `normalizeReport`、重置对话——和同步成功时一致。

**`aiUsed === false` 不是 job 失败。** `generateReport` 在 AI 挂掉时仍写规则周报，`aiError` 有文案，页面已有黄条 Alert。任务是 `completed`。把 `!aiUsed` 当成失败且 `return`，用户既看不到周报，Alert 也出不来。`generating = false` 靠赋值；`return` 只跳过赋值周报，不负责停 loading。

`failed` 展示接口的 `error`，不要写死「请先导入」。POST 的 429/400 在**开始轮询之前**处理，复用 `fail()` 读服务端 message。组件销毁必须停 `interval`（`takeUntilDestroyed`），否则切页还在打接口。

`HttpClient` 泛型 = `next` 的参数类型。POST jobs 不要标成 `Report`；latest 用 `LatestResponse`；GET job 的类型要包含可选 `reportId`/`error`。标错再写 `any`，等于没标。

三个进程都要开。只开 api 时按钮一直转，说明活不在浏览器里（可选超时提示 worker）。

**要点**：

- 入队后只轮询状态；周报内容从 PG 再拉。  
- `completed` + 规则周报 = 成功展示；`aiUsed` 只影响 Alert，不影响 job 成败。  
- 400/429 不开轮询；销毁必停 interval；泛型对齐 JSON，不要 `any`。

### 第四块收束

**串**：限流计数离开进程（Redis）→ 慢活离开 HTTP 进程（Worker）→ UI 离开「死等一次 POST」（轮询）。三份存储：配额和任务状态在 Redis，周报在 PG，文件仍在磁盘。

**要点**：

- 同一 Redis，两种用法：`INCR` 配额；BullMQ 队列。连接不要混。  
- 同一 `generateReport`，两种入口：同步对照；worker 消费。不要复制一份 AI。  
- 前端成功条件是 **job completed 且拉到对应 report**，不是 `aiUsed === true`。

---

## 总体总结

### 总链（把四块读成一句）

先学会把功能接到 Nest 上（模块、DTO、JWT、Prisma、REST 语义），再看清请求在框架里经过哪些层、每层该 `next` / `throw` / 改值，再把数据库从「旁边的文件」换成「配置里的服务」，最后把贵操作拆成「HTTP 记账、另一进程干活、前端问进度」。

```text
浏览器 / Apifox
    │
    │  JWT Bearer、可选 X-Request-Id
    ▼
Middleware          打 requestId，next()
    ▼
Guard               JWT → request.user；配额 INCR → 超限 throw 429
    ▼
Interceptor         return next.handle()，成功路径加耗时头
    ▼
Pipe                ValidationPipe 400；TrimPipe 改字符串；ParseIntPipe 转 id
    ▼
Controller          @CurrentUser() 只是取值
    │                 POST jobs：Queue.add，马上 { jobId, queued }
    │                 POST ticks：SSE（校验已在 hijack 前完成）
    ▼
Service / Prisma    业务数据进 PostgreSQL；文件进 apps/data/uploads
    │
    ├─ 抛错 → Filter：HttpException 原样；P2025 → 404；其它 Prisma → 500
    │
    └─ 周报生成（异步）
            Queue ─Redis─► Worker 进程 generateReport ─► PG weekly_reports
            前端 interval GET /jobs/:id ─► completed 再 GET latest
```

练习 15 将把图中的 PG / Redis / Worker 放进 compose；现在它们是本机进程和本机服务。

### 突出要点（整条轨就记这些）

1. **分层**：Controller 不写 SQL；Service 不拼校验 if；DTO/Pipe 管形状；Guard 管进不进；Filter 管抛错后的 HTTP。  
2. **接上下一环**：Middleware 必 `next()`，Interceptor 必 `return next.handle()`，否则一直转。  
3. **拒绝要对码**：没登录 401，校验失败 400，没资源 404，删成功 204，配额 429（`throw`，不是 `return false` 的 403）。  
4. **JWT 形状**：`validate()` → `{ userId, username }`；装饰器和 Guard 都读 `userId`。  
5. **时机**：SSE/上传先校验再劫持/读流；流只读一次。  
6. **Prisma**：`findUnique` 不抛；`OrThrow`/`update`/`delete` 才 P2025。Filter `@Catch` 必须窄。  
7. **换存储不换语义**：11→16 配额仍 3 次 429，只是 Map 变 `INCR`；同步生成变入队，仍调用同一个 `generateReport`。  
8. **进程边界**：HTTP 的 `AppModule` 全局 Prisma 帮不到 worker；另一个入口自己 import。Queue 与 Worker 队列名一致，connection 用 `new Redis(url, { maxRetriesPerRequest: null })`。  
9. **三份数据**：PG = 业务；磁盘 = 文件；Redis = 配额 + 任务状态。周报 HTML 不进 Redis。  
10. **前端**：泛型 = JSON 形状；轮询必取消；`aiUsed` 不是任务成败。

### 状态码谁产生

| 码 | 谁 | 例子 |
|----|----|------|
| 200/201 | 业务成功 | 入队、创建 |
| 204 | `@HttpCode` | DELETE Note |
| 400 | ValidationPipe / ParseIntPipe / 上传 Filter / 空 PATCH | 非法 body、id=`abc`、文件过大 |
| 401 | JWT Guard（或配额 Guard 发现无 user） | 没 Bearer / 假 token |
| 403 | Guard `return false`（本轨不用它表示配额） | — |
| 404 | `NotFoundException` 或 P2025 Filter | 没有这条 Note / Job |
| 429 | `AiQuotaGuard` throw | ticks 或 jobs 第 4 次 |
| 500 | Filter 兜底 | 非 P2025 的 Prisma、未知错 |

### 本地怎么跑（18 之后）

```text
本机 PostgreSQL     DATABASE_URL
本机 Redis          REDIS_URL
终端 1  api         npm run start:dev       HTTP :3000
终端 2  api         npm run start:worker    消费 weekly-report
终端 3  web         ng serve                :5173 代理 /api
```

Worker 不要登记进 `AppModule`。测配额前按需 `redis-cli DEL ai-quota:1`。

### 和产品的关系

Notes / Files / Ticks 是沙盒。接到产品上的只有：配额（ticks → jobs）、Worker 复用 `generateReport`、周报页默认入队轮询。配置洞察 AI 还未入队。同步 generate-report 可留作对照，不要再分叉规则。

### 上云（练习 15，进行中）

compose 加 postgres / redis / worker，改 Dockerfile CMD，证书 / htpasswd / 服务器 `.env`。2C2G 控内存。本地 `start:dev` 不变。

不做：GraphQL、拆微服务、多租户。

### 独立加一个模块时过一遍

1. 有 Module 吗？进了 **当前进程** 的根 Module 吗（api vs worker）？  
2. 要登录吗？读的是 `userId` 吗？  
3. 写入有 DTO 吗？非法是 400 吗？路径 id 过了 ParseIntPipe 吗？  
4. 找不到是 404 而不是 500 吗？直接 update/delete 能进 P2025 Filter 吗？  
5. 贵操作该配额还是该入队？HTTP 还在同步死等吗？  
6. 密钥只在 `.env` 吗？  
7. 前端若轮询，销毁停了吗？`HttpClient<T>` 的 T 等于响应吗？

能不翻本文走完这 7 问，本仓库 Nest 手写轨（除 15）即收束。
