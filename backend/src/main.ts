import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(await AppModule.forRoot());

  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);
  console.log(`UI Tester AI API running on http://localhost:${port}/api`);
}

bootstrap();
