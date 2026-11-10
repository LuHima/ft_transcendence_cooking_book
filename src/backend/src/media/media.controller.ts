import {
  Controller,
  Get,
  Head,
  Param,
  Req,
  Res,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import {
  CurrentUser,
  ActiveUserData,
} from '../common/decorators/current-user.decorator';
import { MediaService } from './media.service';
import {
  ApiBadRequestResponseDto,
  ApiUnauthorizedResponseDto,
  ApiForbiddenResponseDto,
  ApiNotFoundResponseDto,
} from '../common/dto/api-error-response.dto';
import type { Request, Response } from 'express';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * Retrieve protected recipe media asset (image or video).
   */
  @ApiOperation({
    summary: 'Retrieve protected recipe media asset (image or video)',
    description:
      'Delivers protected recipe media (covers, step photos, gallery, video tutorials) enforcing recipe privacy tiers, database asset linkage, mutual user block invariants, weak ETag conditional revalidation, and RFC 9110 HTTP 206 byte-range video streaming.',
  })
  @ApiParam({
    name: 'recipeId',
    type: Number,
    description: 'Unique database identifier of the recipe',
    example: 42,
  })
  @ApiParam({
    name: 'filename',
    type: String,
    description: 'Sanitized media asset filename with extension',
    example: 'carbonara_cover.webp',
  })
  @ApiOkResponse({
    description: 'Media asset binary stream transferred successfully (200 OK)',
  })
  @ApiResponse({
    status: 206,
    description:
      'Partial content chunk transferred successfully for byte-range video requests (RFC 9110)',
  })
  @ApiResponse({
    status: 304,
    description:
      'Not modified: client cached copy matches server ETag and caller remains authorized',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid filename syntax, illegal file extension, or directory traversal attempt detected',
    type: ApiBadRequestResponseDto,
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication required: caller is unauthenticated attempting to view friends-only media',
    type: ApiUnauthorizedResponseDto,
  })
  @ApiForbiddenResponse({
    description:
      'Forbidden: authenticated caller is not a confirmed friend of the recipe author',
    type: ApiForbiddenResponseDto,
  })
  @ApiNotFoundResponse({
    description:
      'Recipe not found, media asset unlinked, caller blocked, or private recipe hidden from non-author',
    type: ApiNotFoundResponseDto,
  })
  @ApiResponse({
    status: 416,
    description:
      'Range Not Satisfiable: requested byte range exceeds physical file size',
  })
  @ApiCookieAuth('accessToken')
  @UseGuards(OptionalAuthGuard)
  @Get('recipes/:recipeId/:filename')
  async getRecipeMedia(
    @Param('recipeId', ParseIntPipe) recipeId: number,
    @Param('filename') filename: string,
    @CurrentUser() currentUser: ActiveUserData | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.mediaService.getRecipeMedia(
      recipeId,
      filename,
      currentUser,
      req,
      res,
      false,
    );
  }

  /**
   * Probe protected recipe media headers without transferring binary payload.
   */
  @ApiOperation({
    summary:
      'Probe protected recipe media headers without transferring binary payload',
    description:
      'Executes authorization, database verification, and ETag calculation identically to GET, returning HTTP response headers without body.',
  })
  @ApiParam({
    name: 'recipeId',
    type: Number,
    description: 'Unique database identifier of the recipe',
    example: 42,
  })
  @ApiParam({
    name: 'filename',
    type: String,
    description: 'Sanitized media asset filename with extension',
    example: 'carbonara_tutorial.mp4',
  })
  @ApiOkResponse({
    description: 'Asset headers emitted successfully without body payload',
  })
  @ApiResponse({
    status: 304,
    description: 'Not modified: client cache is fresh and caller is authorized',
  })
  @ApiBadRequestResponse({
    description: 'Invalid filename syntax or traversal attempt',
    type: ApiBadRequestResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required for friends-only media',
    type: ApiUnauthorizedResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: not a confirmed friend',
    type: ApiForbiddenResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Recipe or media asset not found or caller blocked',
    type: ApiNotFoundResponseDto,
  })
  @ApiCookieAuth('accessToken')
  @UseGuards(OptionalAuthGuard)
  @Head('recipes/:recipeId/:filename')
  async headRecipeMedia(
    @Param('recipeId', ParseIntPipe) recipeId: number,
    @Param('filename') filename: string,
    @CurrentUser() currentUser: ActiveUserData | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.mediaService.getRecipeMedia(
      recipeId,
      filename,
      currentUser,
      req,
      res,
      true,
    );
  }

  /**
   * Retrieve protected user avatar image.
   */
  @ApiOperation({
    summary: 'Retrieve protected user avatar image',
    description:
      'Delivers user avatar image enforcing mutual user block invariants, filename verification, and weak ETag conditional revalidation.',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'Unique database identifier of the user',
    example: 7,
  })
  @ApiParam({
    name: 'filename',
    type: String,
    description: 'Sanitized avatar image filename with extension',
    example: 'avatar_7.webp',
  })
  @ApiOkResponse({
    description: 'Avatar image binary stream transferred successfully (200 OK)',
  })
  @ApiResponse({
    status: 304,
    description:
      'Not modified: client cached copy matches server ETag and caller remains unblocked',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid filename syntax, non-image extension, or directory traversal attempt detected',
    type: ApiBadRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description:
      'User not found, avatar unlinked, or caller mutually blocked with the user',
    type: ApiNotFoundResponseDto,
  })
  @ApiCookieAuth('accessToken')
  @UseGuards(OptionalAuthGuard)
  @Get('avatars/:userId/:filename')
  async getAvatarMedia(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('filename') filename: string,
    @CurrentUser() currentUser: ActiveUserData | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.mediaService.getAvatarMedia(
      userId,
      filename,
      currentUser,
      req,
      res,
      false,
    );
  }

  /**
   * Probe protected user avatar headers without transferring image payload.
   */
  @ApiOperation({
    summary:
      'Probe protected user avatar headers without transferring image payload',
    description:
      'Performs authorization and metadata probing for avatar image, emitting headers without body.',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'Unique database identifier of the user',
    example: 7,
  })
  @ApiParam({
    name: 'filename',
    type: String,
    description: 'Sanitized avatar image filename with extension',
    example: 'avatar_7.webp',
  })
  @ApiOkResponse({
    description:
      'Avatar image headers emitted successfully without body payload',
  })
  @ApiResponse({
    status: 304,
    description: 'Not modified: client cache is fresh and caller is authorized',
  })
  @ApiBadRequestResponse({
    description: 'Invalid filename syntax or traversal attempt',
    type: ApiBadRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User or avatar not found or caller blocked',
    type: ApiNotFoundResponseDto,
  })
  @ApiCookieAuth('accessToken')
  @UseGuards(OptionalAuthGuard)
  @Head('avatars/:userId/:filename')
  async headAvatarMedia(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('filename') filename: string,
    @CurrentUser() currentUser: ActiveUserData | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.mediaService.getAvatarMedia(
      userId,
      filename,
      currentUser,
      req,
      res,
      true,
    );
  }
}
