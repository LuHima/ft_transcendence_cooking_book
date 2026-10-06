import { NestFactory, APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalNotEmptyBodyPipe } from './common/pipes/global-not-empty-body.pipe';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http.exeption.filter';
import { PrismaExceptionFilter } from './common/filters/prisma.exception.filter';
import { join } from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Spegnimanto pulito in caso di SIGINT ecc..
  app.enableShutdownHooks();
  // Assicura che la directory uploads/recipes esista e serve i file statici
  fs.mkdirSync(join(process.cwd(), 'uploads/recipes'), { recursive: true });
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });
  // Al posto di scrivere http://localhost:3000 si srive /api/
  app.setGlobalPrefix('api');
  // Per lavorare con i cookie
  app.use(cookieParser(process.env.COOKIE_SECRET));
  // Uso il mio filtro per gestire l'errore
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());
  app.useGlobalPipes(
    // Blocca {} vuoti su tutti i body
    new GlobalNotEmptyBodyPipe(),
    new ValidationPipe({
      // Ignora i campi non presenti nel DTO
      whitelist: true,
      // Dà errore se riceve campi non esistenti per i DTO
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: ['http://localhost:5173', 'https://localhost:8443'],
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
