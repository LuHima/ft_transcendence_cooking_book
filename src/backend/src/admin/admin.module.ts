import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCommentsController } from './admin-comments.controller';
import { AdminRecipesController } from './admin-recipes.controller';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ImageProcessingService } from '../common/services/image-processing.service';
import { ReportsModule } from '../reports/reports.module';
import { RecipeModule } from '../recipe/recipe.module';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [PrismaModule, ReportsModule, RecipeModule, CatalogModule],
  controllers: [
    AdminController,
    AdminCommentsController,
    AdminRecipesController,
    AdminCatalogController,
  ],
  providers: [AdminService, ImageProcessingService],
  exports: [AdminService],
})
export class AdminModule {}
