import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RecipeModule } from '../recipe/recipe.module';
import { ImageProcessingService } from '../common/services/image-processing.service';

@Module({
  imports: [RecipeModule],
  providers: [UsersService, ImageProcessingService],
  exports: [UsersService, ImageProcessingService],
  controllers: [UsersController],
})
export class UsersModule {}
