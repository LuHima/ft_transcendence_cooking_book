import { Module } from '@nestjs/common';
import { RecipeController } from './recipe.controller';
import { RecipeService } from './recipe.service';
import { RecipeProjection } from './recipe.projection';
import { TranslationModule } from '../translation/translation.module';
import { CatalogModule } from '../catalog/catalog.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TranslationModule, CatalogModule, NotificationsModule],
  controllers: [RecipeController],
  providers: [RecipeService, RecipeProjection],
  exports: [RecipeService, RecipeProjection],
})
export class RecipeModule {}
