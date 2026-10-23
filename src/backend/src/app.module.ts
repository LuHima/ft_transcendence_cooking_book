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
import { FriendsModule } from './friends/friends.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CaslModule } from './auth/casl/casl-ability.factory/casl-ability.module';
import { CleanExpiredToken } from './common/task/clean-expired-token.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationsModule } from './notifications/notifications.module';
import { ProductionConfigModule } from './common/config/production-config.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    RecipeModule,
    TranslationModule,
    FriendsModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 100, limit: 4 }]),
    CaslModule,
    ProductionConfigModule,
    EventEmitterModule.forRoot(),
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    CleanExpiredToken,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
