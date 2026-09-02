import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';



// SI IMPORTA IL FILE SPECIFICANDO IL PERCORSO QUI IN CIMA (non si mette .ts alla fine)
// import { nome della classe nel file scelto } from './percorso del file';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RecipeModule } from './recipe/recipe.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';


@Module({
  // NELL'ARRAY SI METTE SOLO IL NOME DELLA CLASSE, NON LA STRINGA DEL PERCORSO!
  imports: [PrismaModule, AuthModule, UsersModule, RecipeModule,
    ThrottlerModule.forRoot([{ttl: 1000, limit: 4,}]), ], 
  // gli import degli altri module creati
  controllers: [AppController], //qui ci vanno i file controller
  providers: [AppService, {provide: APP_GUARD, useClass: ThrottlerGuard,}], //qui ci vanno i file service 
})
export class AppModule {}
