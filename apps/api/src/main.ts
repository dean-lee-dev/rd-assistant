import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { createRequire } from 'node:module';
import '@fastify/multipart'; // 仅引入类型扩展（req.file）
import { AppModule } from './app.module';
import { ensureDataDirs, UPLOADS_DIR } from './common/paths';
import { MAX_EXCEL_UPLOAD_BYTES } from './common/upload';
import { UploadExceptionFilter } from './common/upload-exception.filter';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';

/**
 * @fastify/* 在 nodenext 下与 Nest 的 FastifyInstance 类型偶发不兼容：
 * - static 会 TS7016（找不到声明）
 * - multipart default import 注册时报插件类型不匹配
 * 运行时用 createRequire，类型靠上面的 side-effect import。
 */
const nodeRequire = createRequire(__filename);
const multipart = nodeRequire('@fastify/multipart');
const fastifyStatic = nodeRequire('@fastify/static');

async function bootstrap() {
  ensureDataDirs();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(multipart, {
    limits: { fileSize: MAX_EXCEL_UPLOAD_BYTES },
  });
  await fastify.register(fastifyStatic, {
    root: UPLOADS_DIR,
    prefix: '/uploads/',
    decorateReply: false,
  });

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new UploadExceptionFilter(), new PrismaExceptionFilter());

  const port = Number(process.env.PORT ?? 3000);

  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
}
bootstrap();
