import { CallHandler, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { NotifyData } from '../decorators/notify.decorator';
import { map, Observable } from 'rxjs';
import { NotificationStructDto } from '../dto/notification-struct.dto';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationGateway } from 'src/notifications/notification-gateway';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationEmit } from 'src/notifications/notification-emit';

@Injectable()
export class NotificationInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private notificationEmit: NotificationEmit,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>, //
  ) {
    const notifyData = this.reflector.get<NotifyData>(
      'payloadNotification', // il nome che do al payload
      context.getHandler(),
    );
    if (!notifyData) return next.handle(); // mando avanti la richiesta perche non ho trovato il payload che volevo

    const observ = next.handle();

    // pipe accetta 2 tipi di funzioni: map e tap
    // map modifica e sostituisce il risultato
    // tap guarda e basta

    return observ.pipe(
      map((response) => {
        if (response && response.NotificationStructDto) {
          const structNotify: NotificationStructDto =
            response.NotificationStructDto;
          this.notificationEmit
            .notification(structNotify, notifyData)
            .catch((err) => {
              console.error(
                'Error, notification not created for some reason',
                err,
              );
            });
        }
        delete response.NotificationStructDto;
        return response;
      }),
    );
  }
}
