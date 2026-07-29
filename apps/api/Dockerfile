# 构建上下文为仓库根目录（见 docker-compose.yml 的 context: .）
# 基础镜像用 bookworm-slim 而非 alpine：bcrypt 等原生模块在 musl 下需额外适配，易在构建期卡住
FROM node:22-bookworm-slim AS build
# bcrypt 若无对应平台预编译包则回退本地编译，故构建阶段备好工具链
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json ./
COPY apps/api/src ./src
# 编译后就地裁掉 devDependencies，保留已编译的原生模块，避免运行阶段二次安装
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
# DATA_DIR 显式指向挂载卷，不再依赖 __dirname 上溯（否则随构建产物目录结构漂移）
ENV DATA_DIR=/app/data
WORKDIR /app
COPY apps/api/package.json ./
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/dist ./dist
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 3000
CMD ["node", "dist/main"]
