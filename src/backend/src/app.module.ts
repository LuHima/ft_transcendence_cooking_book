import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthGuard } from './common/guards/auth.guard';   


// SI IMPORTA IL FILE SPECIFICANDO IL PERCORSO QUI IN CIMA (non si mette .ts alla fine)
// import { nome della classe nel file scelto } from './percorso del file';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RecipeModule } from './recipe/recipe.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CaslModule } from './auth/casl/casl.module';



@Module({
  // NELL'ARRAY SI METTE SOLO IL NOME DELLA CLASSE, NON LA STRINGA DEL PERCORSO!
  imports: [PrismaModule, AuthModule, UsersModule, RecipeModule,
   ThrottlerModule.forRoot([{ttl: 100, limit: 4,}]),
   CaslModule,
  ], 
  // gli import degli altri module creati
  controllers: [AppController], //qui ci vanno i file controller
  providers: [AppService, 
    {provide:
      APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard, 
    },


  ], //qui ci vanno i file service 
})
export class AppModule {}
