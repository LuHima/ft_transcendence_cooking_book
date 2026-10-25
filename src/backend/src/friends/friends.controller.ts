import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
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
  ApiUnauthorizedResponse,
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
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
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
  ApiUnauthorizedResponseDto,
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
  @ApiUnauthorizedResponse({
    description: 'Authentication required: missing or invalid accessToken cookie',
    type: ApiUnauthorizedResponseDto,
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
  @ApiNotFoundResponse({
    description: 'Friendship not found',
    type: ApiNotFoundResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required: missing or invalid accessToken cookie',
    type: ApiUnauthorizedResponseDto,
  })
  @Auth()
  @Delete(':friendId')
  async removeFriend(
    @CurrentUser('id') userId: number,
    @Param('friendId', ParseIntPipe) friendId: number,
  ) {
    return await this.friendsService.removeFriend(userId, friendId);
  }

  /**
   * Send a friend request or auto-accept if a reciprocal pending request already exists.
   */
  @ApiOperation({
    summary: 'Send friend request',
    description:
      'Sends a friend request to the target user. If the target user has already sent a pending request to caller, automatically resolves into accepted friendship.',
  })
  @ApiOkResponse({
    description: 'Friend request sent or auto-accepted',
    type: FriendRequestActionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Cannot send friend request to yourself',
    type: ApiBadRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiNotFoundResponseDto,
  })
  @ApiConflictResponse({
    description: 'Already friends with this user or friend request already sent',
    type: ApiConflictResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required: missing or invalid accessToken cookie',
    type: ApiUnauthorizedResponseDto,
  })
  @Auth()
  @Post('requests')
  async sendFriendRequest(
    @CurrentUser('id') userId: number,
    @Body() dto: SendFriendRequestDto,
  ) {
    return await this.friendsService.sendFriendRequest(
      userId,
      dto.recipient_id,
    );
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
  @ApiUnauthorizedResponse({
    description: 'Authentication required: missing or invalid accessToken cookie',
    type: ApiUnauthorizedResponseDto,
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
   * Accept an incoming pending friend request.
   */
  @ApiOperation({
    summary: 'Accept incoming friend request',
    description:
      'Accepts an incoming pending friend request from the specified user.',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'Numeric user ID of the requester',
    example: 3,
  })
  @ApiOkResponse({
    description: 'Friend request accepted',
    type: FriendRequestActionResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Friend request not found',
    type: ApiNotFoundResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required: missing or invalid accessToken cookie',
    type: ApiUnauthorizedResponseDto,
  })
  @Auth()
  @Post('requests/:userId/accept')
  async acceptFriendRequest(
    @CurrentUser('id') userId: number,
    @Param('userId', ParseIntPipe) requesterId: number,
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
    name: 'userId',
    type: Number,
    description: 'Numeric user ID of the requester',
    example: 3,
  })
  @ApiOkResponse({
    description: 'Friend request rejected',
    type: FriendRequestActionResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Friend request not found',
    type: ApiNotFoundResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required: missing or invalid accessToken cookie',
    type: ApiUnauthorizedResponseDto,
  })
  @Auth()
  @Post('requests/:userId/reject')
  async rejectFriendRequest(
    @CurrentUser('id') userId: number,
    @Param('userId', ParseIntPipe) requesterId: number,
  ) {
    return await this.friendsService.rejectFriendRequest(userId, requesterId);
  }

  /**
   * Cancel an outgoing pending friend request.
   */
  @ApiOperation({
    summary: 'Cancel outgoing friend request',
    description:
      'Cancels a pending friend request sent to the specified user, hard deleting the request and cleaning up recipient inbox notification.',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'Numeric user ID of the recipient',
    example: 4,
  })
  @ApiOkResponse({
    description: 'Friend request cancelled',
    type: FriendRequestActionResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Friend request not found',
    type: ApiNotFoundResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required: missing or invalid accessToken cookie',
    type: ApiUnauthorizedResponseDto,
  })
  @Auth()
  @Delete('requests/:userId')
  async cancelFriendRequest(
    @CurrentUser('id') userId: number,
    @Param('userId', ParseIntPipe) recipientId: number,
  ) {
    return await this.friendsService.cancelFriendRequest(userId, recipientId);
  }
}
