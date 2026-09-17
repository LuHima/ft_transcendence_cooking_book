import { Injectable, Logger } from '@nestjs/common'; 
import { Cron, CronExpression } from'@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';

// serve a cancellare i token scaduti dal database faccio il controllo una volta al giorno

@Injectable()
export class CleanExpiredToken
{
	constructor (private prisma : PrismaService){}

	@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // Cron vience cercato da schedule per settare il timer dato a @Cron in questo caso la mezza notte 
	async cleanExpiredSessions() {
		await this.prisma.jwtSession.deleteMany({
			where: {
				expire_time_jwt: {
					lt: new Date(), // lt sta per less than, prende le date inferiore che trova a ora (in questo caso sarà sempre mezza notte)
				},
			},
		});
	}
}
