# 构建上下文为仓库根目录（见 docker-compose.yml 的 context: .）
FROM node:22-bookworm-slim AS build
WORKDIR /build
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/angular.json apps/web/tsconfig*.json ./
COPY apps/web/src ./src
COPY apps/web/public ./public
# 生产构建：isDevMode() 为 false，登录页不再预填默认凭据
RUN npm run build

FROM nginx:1.27-alpine AS runtime
# Angular application builder 的浏览器产物在 dist/<project>/browser
COPY --from=build /build/dist/web/browser /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
