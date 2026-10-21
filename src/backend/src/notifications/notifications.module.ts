import { Module } from '@nestjs/common';
import { NotificationGateway } from './notification-gateway';
import { NotificationEmit } from './notification-emit';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationGateway, NotificationEmit, NotificationService],
  exports: [NotificationGateway, NotificationEmit, NotificationService],
})
export class NotificationsModule {}
