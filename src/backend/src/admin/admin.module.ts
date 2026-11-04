import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCommentsController } from './admin-comments.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ImageProcessingService } from '../common/services/image-processing.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController, AdminCommentsController],
  providers: [AdminService, ImageProcessingService],
  exports: [AdminService],
})
export class AdminModule {}
