import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MyQueryService } from './handler/query';


// SI IMPORTA IL FILE SPECIFICANDO IL PERCORSO QUI IN CIMA (non si mette .ts alla fine)
// import { nome della classe nel file scelto } from './percorso del file';
import { GetController } from './api/get';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  // 2. NELL'ARRAY SI METTE SOLO IL NOME DELLA CLASSE, NON LA STRINGA DEL PERCORSO!
  controllers: [AppController, GetController],
  providers: [AppService, MyQueryService], //@injection qui dentro
})
export class AppModule {}
