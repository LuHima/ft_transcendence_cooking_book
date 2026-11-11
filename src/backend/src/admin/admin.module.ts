import { Module, forwardRef } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCommentsController } from './admin-comments.controller';
import { AdminRecipesController } from './admin-recipes.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ImageProcessingService } from '../common/services/image-processing.service';
import { ReportsModule } from '../reports/reports.module';
import { RecipeModule } from '../recipe/recipe.module';

@Module({
  imports: [PrismaModule, ReportsModule, RecipeModule],
  controllers: [
    AdminController,
    AdminCommentsController,
    AdminRecipesController,
  ],
  providers: [AdminService, ImageProcessingService],
  exports: [AdminService],
})
export class AdminModule {}
