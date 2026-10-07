import {
  Param,
  ParseIntPipe,
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Query,
  UseFilters,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { HttpExceptionFilter } from 'src/common/filters/http.exeption.filter';
import { Auth } from 'src/common/decorators/policies.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { avatarMulterOptions } from './avatar.multer';

@Controller('users')
@UseFilters(HttpExceptionFilter)
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  // GET /api/users/me -> returns information about current user
  @Auth()
  @Get('me')
  async getMe(@CurrentUser('id') id: number) {
    return await this.userService.getMe(id);
  }

  // PATCH /api/users/me -> updates information about current user
  @Auth()
  @Patch('me')
  async updateMe(
    @CurrentUser('id') id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.userService.updateMe(id, updateUserDto);
  }

  // POST /api/users/me/avatar -> uploads current user's avatar
  @Auth()
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', avatarMulterOptions))
  async updateAvatar(
    @CurrentUser('id') id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return await this.userService.updateAvatar(id, file);
  }

  // DELETE /api/users/me/avatar -> deletes current user's avatar
  @Auth()
  @Delete('me/avatar')
  async deleteAvatar(@CurrentUser('id') id: number) {
    return await this.userService.deleteAvatar(id);
  }

  // GET /api/users/me/likes -> returns recipes liked by the current user
  @Auth()
  @Get('me/likes')
  async getLikedRecipes(
    @CurrentUser('id') id: number,
    @Query('lang') lang?: string,
  ) {
    return await this.userService.getLikedRecipes(id, lang);
  }

  // GET /api/users/search -> searches a user by username
  // TODO to be updated for advanced search !!!
  @Get('search')
  async searchUser(@Query('value') username: string) {
    return await this.userService.findUser(username);
  }

  // GET /api/users/:id -> returns the id of the user identified by id
  // WHAT'S THE PURPOSE OF THIS API ???
  @Get(':id')
  async getUser(@Param('id', ParseIntPipe) id: number) {
    return await this.userService.getUser(id);
  }
}
