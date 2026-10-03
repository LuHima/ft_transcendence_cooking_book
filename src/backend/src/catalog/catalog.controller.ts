import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { IngredientCategory } from '@prisma/client';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('recipes/metadata')
  getMetadata() {
    return this.catalogService.getMetadata();
  }

  @Get('tags')
  async getTags(@Query('lang') lang?: string) {
    return await this.catalogService.getTags({ lang });
  }

  @Get('ingredients')
  async getIngredients(
    @Query('lang') lang?: string,
    @Query('category') category?: IngredientCategory,
    @Query('search') search?: string,
  ) {
    return await this.catalogService.getIngredients({ lang, category, search });
  }
}
