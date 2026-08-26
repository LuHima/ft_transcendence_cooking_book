import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

    app.useGlobalPipes(                                                                 
        new ValidationPipe({                                                              
          whitelist: true,            // Ignora i campi non presenti nel DTO
          forbidNonWhitelisted: true, // da errore se riceve campi non esistenti per i DTO
		}),
	);
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:8443'],
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
