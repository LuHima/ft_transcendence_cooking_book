import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { RecipeModule } from '../recipe/recipe.module';

/**
 * Encapsulates personalized social activity feed features.
 */
@Module({
  imports: [PrismaModule, RecipeModule],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
