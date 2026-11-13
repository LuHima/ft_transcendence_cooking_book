import { NestFactory, APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalNotEmptyBodyPipe } from './common/pipes/global-not-empty-body.pipe';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from './common/filters/global.exception.filter';
import { ContentLanguageInterceptor } from './common/interceptors/content-language.interceptor';
import {
  RECIPE_UPLOADS_DIR,
  AVATAR_UPLOADS_DIR,
} from './common/config/upload-paths';
import { setupSwagger } from './common/config/swagger.config';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Spegnimanto pulito in caso di SIGINT ecc..
  app.enableShutdownHooks();
  // Assicura che le directory uploads esistano
  fs.mkdirSync(RECIPE_UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(AVATAR_UPLOADS_DIR, { recursive: true });
  // Al posto di scrivere http://localhost:3000 si srive /api/
  app.setGlobalPrefix('api');
  // Per lavorare con i cookie
  app.use(cookieParser(process.env.COOKIE_SECRET));
  // Centralized HTTP and WebSocket exception handling
  app.useGlobalFilters(new GlobalExceptionFilter());
  // Standard RFC 9110 Content-Language response header interceptor
  app.useGlobalInterceptors(new ContentLanguageInterceptor());
  app.useGlobalPipes(
    // Blocca {} vuoti su tutti i body
    new GlobalNotEmptyBodyPipe(),
    new ValidationPipe({
      // Ignora i campi non presenti nel DTO
      whitelist: true,
      // Dà errore se riceve campi non esistenti per i DTO
      forbidNonWhitelisted: true,
      // Abilita la trasformazione dei tipi e l'esecuzione di @Transform()
      transform: true,
    }),
  );
  app.enableCors({
    origin: ['https://localhost:8443'],
    credentials: true,
  });

  /* OpenAPI documentation */
  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
