import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { EncryptionService } from './encryption.service';


@Module({
  imports: [UsersModule, JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '60s' },
    }),],
  controllers: [AuthController],
  providers: [AuthService, EncryptionService],
  exports: [AuthService, EncryptionService],
})
export class AuthModule {}
