import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { BanHistoryService } from './ban-history.service';
import { PrismaModule } from 'prisma/prisma.module';
import { RecipeModule } from '../recipe/recipe.module';

@Module({
  imports: [PrismaModule, RecipeModule],
  controllers: [ReportsController],
  providers: [ReportsService, BanHistoryService],
  exports: [ReportsService, BanHistoryService],
})
export class ReportsModule {}
