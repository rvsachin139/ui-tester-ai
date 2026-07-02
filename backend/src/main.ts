import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(await AppModule.forRoot());

  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: false }));

  app.useStaticAssets(join(process.cwd(), '..', 'sessions'), {
    prefix: '/sessions',
  });

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);
  console.log(`UI Tester AI API running on http://localhost:${port}/api`);
}

bootstrap();
