import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { NotificationSubject, NotificationAction } from '@prisma/client';
import { NotificationInterceptor } from '../interceptors/notification.interceptor';

export interface NotifyData {
  subject: NotificationSubject;
  action: NotificationAction;
}
export function Notify(data: NotifyData) {
  return applyDecorators(
    SetMetadata('payloadNotification', data),
    UseInterceptors(NotificationInterceptor),
  );
}
