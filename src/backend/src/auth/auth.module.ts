import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';


@Module({
  imports: [UsersModule, JwtModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
