// SI IMPORTA IL FILE SPECIFICANDO IL PERCORSO QUI IN CIMA
// (non si mette .ts alla fine)
// import { nome della classe nel file scelto } from './percorso del file';

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthGuard } from './common/guards/auth.guard';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RecipeModule } from './recipe/recipe.module';
import { CatalogModule } from './catalog/catalog.module';
import { TranslationModule } from './translation/translation.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CaslModule } from './auth/casl/casl-ability.factory/casl-ability.module';
import { CleanExpiredToken } from './common/task/clean-expired-token.service';
import { ProductionConfigModule } from './common/config/production-config.module';

@Module({
  // NELL'ARRAY SI METTE SOLO IL NOME DELLA CLASSE, NON LA STRINGA DEL PERCORSO!
  // Gli import degli altri module creati
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    RecipeModule,
    TranslationModule,
    // ScheduleModule cerca in tutti i provider per un @Cron vede quanto
    // manca al tempo stabilito e setta un timer per chiamare quella funzione
    // non appena finisce il sistemma setta in automatico un'altro timer per
    // la volta successiva.
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 100, limit: 4 }]),
    CaslModule,
    ProductionConfigModule,
  ],
  // Qui ci vanno i file controller
  controllers: [AppController],
  // In providers si mettono le classi service di cui si voglio creare le
  // istanze all'avvio.
  providers: [
    AppService,
    CleanExpiredToken,
    {
      // Rende la classe chiamata di default ovunque nelle API (credo solo nelle
      // API), poi si possono personalizzare per singole chiamate i Throttler.
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
