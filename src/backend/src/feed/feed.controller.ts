import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { Auth } from '../common/decorators/policies.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FeedQueryDto } from './dto/feed-query.dto';
import { PaginatedRecipeResponseDto } from '../recipe/dto/recipe-response.dto';
import {
  ApiBadRequestResponseDto,
  ApiInternalServerErrorResponseDto,
  ApiUnauthorizedResponseDto,
} from '../common/dto/api-error-response.dto';

/**
 * Controller handling personalized social activity feeds.
 */
@ApiTags('Feed')
@ApiInternalServerErrorResponse({
  type: ApiInternalServerErrorResponseDto,
  description: 'Internal server error',
})
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  /**
   * Retrieve a chronologically ordered paginated activity feed of recipes
   * published exclusively by confirmed friends of the authenticated user.
   */
  @Get()
  @Auth()
  @ApiOperation({
    summary: 'Get friends activity feed',
    description:
      'Returns a chronologically ordered (newest first) paginated collection of recipes published exclusively by confirmed friends of the authenticated user.',
  })
  @ApiOkResponse({
    type: PaginatedRecipeResponseDto,
    description: 'Paginated recipes from confirmed friends',
  })
  @ApiUnauthorizedResponse({
    type: ApiUnauthorizedResponseDto,
    description: 'Missing or invalid authentication token',
  })
  @ApiBadRequestResponse({
    type: ApiBadRequestResponseDto,
    description: 'Invalid pagination or language parameters',
  })
  async getFeed(
    @CurrentUser('id') userId: number,
    @Query() query: FeedQueryDto,
  ): Promise<PaginatedRecipeResponseDto> {
    return this.feedService.getFeed(userId, query);
  }
}
