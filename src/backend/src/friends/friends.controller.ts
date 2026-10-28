import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiParam,
} from '@nestjs/swagger';
import { FriendsService } from './friends.service';
import { Auth } from 'src/common/decorators/policies.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { FriendQueryDto } from './dto/friend-query.dto';
import {
  FriendMessageResponseDto,
  PaginatedFriendsResponseDto,
} from './dto/friend-response.dto';
import { FriendRequestQueryDto } from './dto/friend-request-query.dto';
import {
  FriendRequestActionResponseDto,
  PaginatedFriendRequestsResponseDto,
} from './dto/friend-request-response.dto';
import {
  ApiBadRequestResponseDto,
  ApiConflictResponseDto,
  ApiInternalServerErrorResponseDto,
  ApiNotFoundResponseDto,
} from 'src/common/dto/api-error-response.dto';

/**
 * Controller handling friend discovery, list confirmed friends, silent unfriending,
 * and complete friend request lifecycle (send, auto-accept, accept, reject, cancel).
 */
@ApiTags('Friends')
@ApiInternalServerErrorResponse({
  type: ApiInternalServerErrorResponseDto,
  description: 'Internal server error',
})
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  /**
   * Retrieve paginated confirmed friends for the authenticated user.
   */
  @ApiOperation({
    summary: 'List confirmed friends',
    description:
      'Returns a paginated list of confirmed bidirectional friends with optional username search.',
  })
  @ApiOkResponse({
    description: 'Paginated collection of friends',
    type: PaginatedFriendsResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid pagination query parameters (e.g. non-integer or out-of-range page/limit)',
    type: ApiBadRequestResponseDto,
  })
  @Auth()
  @Get()
  async getFriends(
    @CurrentUser('id') userId: number,
    @Query() query: FriendQueryDto,
  ) {
    return await this.friendsService.getFriends(userId, query);
  }

  /**
   * Retrieve pending friend requests (incoming or outgoing).
   */
  @ApiOperation({
    summary: 'List pending friend requests',
    description:
      'Returns a paginated list of pending incoming or outgoing friend requests.',
  })
  @ApiOkResponse({
    description: 'Paginated collection of pending friend requests',
    type: PaginatedFriendRequestsResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid friend request query parameters (unsupported type enum or invalid pagination format)',
    type: ApiBadRequestResponseDto,
  })
  @Auth()
  @Get('requests')
  async getFriendRequests(
    @CurrentUser('id') userId: number,
    @Query() query: FriendRequestQueryDto,
  ) {
    return await this.friendsService.getFriendRequests(userId, query);
  }

  /**
   * Send a friend request or auto-accept if a reciprocal pending request already exists.
   */
  @ApiOperation({
    summary: 'Send friend request',
    description:
      'Sends a friend request to the target user. If the target user has already sent a pending request to caller, automatically resolves into accepted friendship.',
  })
  @ApiParam({
    name: 'addresseeId',
    type: Number,
    description: 'Numeric user ID of the target of the friend request',
    example: 3,
  })
  @ApiOkResponse({
    description: 'Friend request sent or auto-accepted',
    type: FriendRequestActionResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Cannot send friend request to yourself or invalid addressee ID format (must be an integer)',
    type: ApiBadRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiNotFoundResponseDto,
  })
  @ApiConflictResponse({
    description:
      'Already friends with this user or friend request already sent',
    type: ApiConflictResponseDto,
  })
  @Auth()
  @Post('requests/:addresseeId')
  async sendFriendRequest(
    @CurrentUser('id') userId: number,
    @Param('addresseeId', ParseIntPipe) addresseeId: number,
  ) {
    return await this.friendsService.sendFriendRequest(userId, addresseeId);
  }

  /**
   * Accept an incoming pending friend request.
   */
  @ApiOperation({
    summary: 'Accept incoming friend request',
    description:
      'Accepts an incoming pending friend request from the specified user.',
  })
  @ApiParam({
    name: 'requesterId',
    type: Number,
    description: 'Numeric user ID of the requester',
    example: 3,
  })
  @ApiOkResponse({
    description: 'Friend request accepted',
    type: FriendRequestActionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid requester ID format (must be an integer)',
    type: ApiBadRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Friend request not found',
    type: ApiNotFoundResponseDto,
  })
  @Auth()
  @Post('requests/:requesterId/accept')
  async acceptFriendRequest(
    @CurrentUser('id') userId: number,
    @Param('requesterId', ParseIntPipe) requesterId: number,
  ) {
    return await this.friendsService.acceptFriendRequest(userId, requesterId);
  }

  /**
   * Reject an incoming pending friend request.
   */
  @ApiOperation({
    summary: 'Reject incoming friend request',
    description:
      'Rejects an incoming pending friend request, hard deleting the request and cleaning up inbox notification.',
  })
  @ApiParam({
    name: 'requesterId',
    type: Number,
    description: 'Numeric user ID of the requester',
    example: 3,
  })
  @ApiOkResponse({
    description: 'Friend request rejected',
    type: FriendRequestActionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid requester ID format (must be an integer)',
    type: ApiBadRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Friend request not found',
    type: ApiNotFoundResponseDto,
  })
  @Auth()
  @Post('requests/:requesterId/reject')
  async rejectFriendRequest(
    @CurrentUser('id') userId: number,
    @Param('requesterId', ParseIntPipe) requesterId: number,
  ) {
    return await this.friendsService.rejectFriendRequest(userId, requesterId);
  }

  /**
   * Cancel an outgoing pending friend request.
   */
  @ApiOperation({
    summary: 'Cancel outgoing friend request',
    description:
      'Cancels a pending friend request sent to the specified user, hard deleting the request and cleaning up addressee inbox notification.',
  })
  @ApiParam({
    name: 'addresseeId',
    type: Number,
    description: 'Numeric user ID of the addressee',
    example: 4,
  })
  @ApiOkResponse({
    description: 'Friend request cancelled',
    type: FriendRequestActionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid addressee ID format (must be an integer)',
    type: ApiBadRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Friend request not found',
    type: ApiNotFoundResponseDto,
  })
  @Auth()
  @Delete('requests/:addresseeId')
  async cancelFriendRequest(
    @CurrentUser('id') userId: number,
    @Param('addresseeId', ParseIntPipe) addresseeId: number,
  ) {
    return await this.friendsService.cancelFriendRequest(userId, addresseeId);
  }

  /**
   * Silently remove an existing friend.
   */
  @ApiOperation({
    summary: 'Remove a friend',
    description:
      'Silently removes an established friendship without notifying the other user.',
  })
  @ApiParam({
    name: 'friendId',
    type: Number,
    description: 'Numeric user ID of the friend to remove',
    example: 2,
  })
  @ApiOkResponse({
    description: 'Friendship removed successfully',
    type: FriendMessageResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid friend ID format (must be an integer)',
    type: ApiBadRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Friendship not found',
    type: ApiNotFoundResponseDto,
  })
  @Auth()
  @Delete(':friendId')
  async removeFriend(
    @CurrentUser('id') userId: number,
    @Param('friendId', ParseIntPipe) friendId: number,
  ) {
    return await this.friendsService.removeFriend(userId, friendId);
  }
}
