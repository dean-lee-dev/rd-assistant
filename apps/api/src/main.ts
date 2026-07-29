import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ensureDataDirs } from './common/paths';
import { MulterExceptionFilter } from './common/multer-exception.filter';

async function bootstrap() {
  ensureDataDirs();
  const app = await NestFactory.create(AppModule);
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
  app.useGlobalFilters(new MulterExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
