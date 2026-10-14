# 构建上下文为仓库根目录（见 docker-compose.yml 的 context: .）
# 基础镜像用 bookworm-slim 而非 alpine：bcrypt 等原生模块在 musl 下需额外适配，易在构建期卡住
FROM node:22-bookworm-slim AS build
# bcrypt 若无对应平台预编译包则回退本地编译，故构建阶段备好工具链。
# 国内云主机直连 deb.debian.org 会卡住，改走腾讯云镜像。
RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i 's|deb.debian.org|mirrors.tencentyun.com|g; s|security.debian.org|mirrors.tencentyun.com|g' /etc/apt/sources.list.d/debian.sources; \
    fi \
  && if [ -f /etc/apt/sources.list ]; then \
      sed -i 's|deb.debian.org|mirrors.tencentyun.com|g; s|security.debian.org|mirrors.tencentyun.com|g' /etc/apt/sources.list; \
    fi \
  && apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY apps/api/package.json apps/api/package-lock.json ./
COPY apps/api/prisma ./prisma
# DATABASE_URL 仅供 prisma generate；真实路径由运行时 DATA_DIR 拼出
ENV DATABASE_URL="postgresql://user:password@localhost:5432/assistant"
# lockfile 的 resolved 指向公司 Nexus。npm ci 按这个地址下载，改 registry 不会生效。
# 构建时改写成腾讯云镜像，不改仓库里的 lockfile。
ENV NODE_OPTIONS=--max-old-space-size=512
ENV npm_config_maxsockets=1
RUN sed -i 's|http://nexus.iheatingos.com/repository/npm-group|https://mirrors.tencentyun.com/npm|g' package-lock.json \
  && npm ci --no-audit --no-fund
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json ./
COPY apps/api/src ./src
# 编译后就地裁掉 devDependencies，保留已编译的原生模块与 Prisma Client
RUN npx prisma generate \
  && npm run build \
  && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
# DATA_DIR 显式指向挂载卷，不再依赖 __dirname 上溯（否则随构建产物目录结构漂移）
ENV DATA_DIR=/app/data
WORKDIR /app
# 运行阶段是新的 slim 镜像，没有 openssl。prisma migrate 检测不到就去写 node_modules，而进程是 node 用户，写不进去，容器会反复退出。
RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i 's|deb.debian.org|mirrors.tencentyun.com|g; s|security.debian.org|mirrors.tencentyun.com|g' /etc/apt/sources.list.d/debian.sources; \
    fi \
  && if [ -f /etc/apt/sources.list ]; then \
      sed -i 's|deb.debian.org|mirrors.tencentyun.com|g; s|security.debian.org|mirrors.tencentyun.com|g' /etc/apt/sources.list; \
    fi \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/dist ./dist
# 以 root 运行：命名卷 /app/data 挂载后属主是 root，切到 node 会在启动时写目录失败并退出
RUN mkdir -p /app/data

EXPOSE 3000
# 启动前 migrate，连接串来自环境变量
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
