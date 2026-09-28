import { NestFactory, APP_GUARD } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalNotEmptyBodyPipe } from './common/pipes/global-not-empty-body.pipe';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http.exeption.filter';
import { PrismaExceptionFilter } from './common/filters/prisma.exception.filter';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.enableShutdownHooks(); // serve per avere uno spegnimanto pulito in caso di SIGINT ecc..
	app.setGlobalPrefix('api');  //al posto di scrivere http://localhost:3000 si srive /api/
	app.use(cookieParser(process.env.COOKIE_SECRET));	// per lavorare con i cookie
	app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter()); // uso il mio filtro per gestire l'errore
		app.useGlobalPipes(
			new GlobalNotEmptyBodyPipe(), // Blocca {} vuoti su tutti i body
			new ValidationPipe({ 
			whitelist: true, // Ignora i campi non presenti nel DTO
			forbidNonWhitelisted: true, // da errore se riceve campi non esistenti per i DTO
			}),
		);
	app.enableCors({
		origin: ['http://localhost:5173', 'https://localhost:8443'],
		credentials: true,
	});
	await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
