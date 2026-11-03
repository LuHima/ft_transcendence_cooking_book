import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ImageProcessingService } from '../common/services/image-processing.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [AdminService, ImageProcessingService],
  exports: [AdminService],
})
export class AdminModule {}
