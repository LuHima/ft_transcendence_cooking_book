import { Module } from '@nestjs/common';
import { RecipeController } from './recipe.controller';
import { RecipeService } from './recipe.service';
import { TranslationModule } from '../translation/translation.module';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [TranslationModule, CatalogModule],
  controllers: [RecipeController],
  providers: [RecipeService],
})
export class RecipeModule {}
