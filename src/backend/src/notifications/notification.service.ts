import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { createHttpException, errors } from 'src/common/config/error.config';
import {
  AppSubject,
  CaslAbilityFactory,
} from 'src/auth/casl/casl-ability.factory/casl-ability.factory';
import { Action } from 'src/auth/casl/action.enum';
import { ActiveUserData } from 'src/common/decorators/current-user.decorator';
import { NotificationQueryDto } from './dto/notification-query.dto';
import {
  NotificationItemDto,
  NotificationMessageResponseDto,
  PaginatedNotificationResponseDto,
} from './dto/notification-response.dto';
import {
  NotificationAction,
  NotificationSubject,
  Prisma,
} from '@prisma/client';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  private async checkNotify(notificationId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw createHttpException(errors.notification.NotFound);
    return notification;
  }

  async readNotification(
    notificationId: number,
    user: ActiveUserData,
  ): Promise<NotificationMessageResponseDto> {
    const notify = await this.checkNotify(notificationId);

    this.caslAbilityFactory.check(
      user,
      Action.Read,
      AppSubject.Notification,
      notify,
    );
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        is_read: true,
      },
    });
    return { message: 'Read' };
  }

  async deleteNotification(
    notificationId: number,
    user: ActiveUserData,
  ): Promise<NotificationMessageResponseDto> {
    const notify = await this.checkNotify(notificationId);

    this.caslAbilityFactory.check(
      user,
      Action.Delete,
      AppSubject.Notification,
      notify,
    );
    await this.prisma.notification.delete({
      where: { id: notificationId },
    });
    return { message: 'Deleted successfully' };
  }

  async markAllAsRead(userId: number): Promise<NotificationMessageResponseDto> {
    await this.prisma.notification.updateMany({
      where: {
        user_id: userId,
        is_read: false,
      },
      data: {
        is_read: true,
      },
    });
    return { message: 'All notifications marked as read' };
  }

  async getNotifications(
    userId: number,
    query: NotificationQueryDto = {},
  ): Promise<PaginatedNotificationResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      user_id: userId,
      ...(query.unread_only ? { is_read: false } : {}),
    };

    const [notifications, total, unread_count] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              avatar_url: true,
            },
          },
        },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { user_id: userId, is_read: false },
      }),
    ]);

    // Batch hydration for recipes and comments
    const recipeIds = Array.from(
      new Set(
        notifications
          .filter(
            (n) =>
              n.subject === NotificationSubject.recipe && n.target_id !== null,
          )
          .map((n) => n.target_id as number),
      ),
    );

    const commentIds = Array.from(
      new Set(
        notifications
          .filter(
            (n) =>
              n.subject === NotificationSubject.comment && n.target_id !== null,
          )
          .map((n) => n.target_id as number),
      ),
    );

    const [recipes, comments] = await Promise.all([
      recipeIds.length > 0
        ? this.prisma.recipe.findMany({
            where: { id: { in: recipeIds } },
            include: { translations: true },
          })
        : [],
      commentIds.length > 0
        ? this.prisma.comment.findMany({
            where: { id: { in: commentIds } },
            select: { id: true, content: true, recipe_id: true },
          })
        : [],
    ]);

    const recipeMap = new Map<number, (typeof recipes)[number]>();
    for (const r of recipes) {
      recipeMap.set(r.id, r);
    }
    const commentMap = new Map<number, (typeof comments)[number]>();
    for (const c of comments) {
      commentMap.set(c.id, c);
    }

    const lang: 'it' | 'en' | 'fr' =
      query.lang === 'it' || query.lang === 'fr' ? query.lang : 'en';

    const items: NotificationItemDto[] = notifications.map((n) => {
      let title_or_snippet: string | null = null;
      let recipeTitle: string | null = null;
      let recipe_id: number | null = null;

      if (n.subject === NotificationSubject.recipe && n.target_id) {
        const recipe = recipeMap.get(n.target_id);
        recipe_id = recipe ? recipe.id : n.target_id;
        if (recipe) {
          const translation =
            recipe.translations?.find((t) => t.locale === lang) ??
            recipe.translations?.find((t) => t.locale === recipe.source_lang) ??
            recipe.translations?.find((t) => t.locale === 'en') ??
            recipe.translations?.[0];
          recipeTitle = translation?.title ?? null;
          title_or_snippet = recipeTitle;
        }
      } else if (n.subject === NotificationSubject.comment && n.target_id) {
        const comment = commentMap.get(n.target_id);
        title_or_snippet = comment?.content ?? null;
        recipe_id = comment?.recipe_id ?? null;
      }

      const actorUsername = n.actor?.username ?? 'Someone';
      const message = this.buildLocalizedMessage(
        lang,
        actorUsername,
        n.subject,
        n.action,
        recipeTitle,
      );

      return {
        id: n.id,
        user_id: n.user_id,
        actor:
          n.action === NotificationAction.warn
            ? null
            : {
                id: n.actor?.id ?? n.actor_id,
                username: actorUsername,
                avatar_url: n.actor?.avatar_url ?? null,
              },
        subject: n.subject,
        action: n.action,
        target: {
          id: n.target_id,
          subject: n.subject,
          title_or_snippet,
          recipe_id,
        },
        message,
        details: n.details ?? null,
        is_read: n.is_read,
        created_at: n.created_at,
      };
    });

    const total_pages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      total_pages,
      has_next_page: total > 0 && page < total_pages,
      has_prev_page: total > 0 && page > 1,
      unread_count,
    };
  }

  private buildLocalizedMessage(
    lang: 'it' | 'en' | 'fr',
    actor: string,
    subject: NotificationSubject,
    action: NotificationAction,
    title: string | null,
  ): string {
    const safeTitle = title ?? '';
    switch (lang) {
      case 'it':
        if (
          action === NotificationAction.like &&
          subject === NotificationSubject.recipe
        ) {
          return `${actor} ha messo "Mi piace" alla tua ricetta "${safeTitle}"`;
        }
        if (
          action === NotificationAction.comment &&
          subject === NotificationSubject.recipe
        ) {
          return `${actor} ha commentato la tua ricetta "${safeTitle}"`;
        }
        if (
          action === NotificationAction.comment &&
          subject === NotificationSubject.comment
        ) {
          return `${actor} ha risposto al tuo commento`;
        }
        if (action === NotificationAction.friend_request) {
          return `${actor} ti ha inviato una richiesta di amicizia`;
        }
        if (action === NotificationAction.friend_accept) {
          return `${actor} ha accettato la tua richiesta di amicizia`;
        }
        if (
          action === NotificationAction.post &&
          subject === NotificationSubject.recipe
        ) {
          return `${actor} ha pubblicato una nuova ricetta "${safeTitle}"`;
        }
        if (
          action === NotificationAction.update &&
          subject === NotificationSubject.recipe
        ) {
          return `${actor} ha aggiornato la ricetta "${safeTitle}"`;
        }
        if (
          action === NotificationAction.delete &&
          subject === NotificationSubject.recipe
        ) {
          return `${actor} ha eliminato una ricetta`;
        }
        if (action === NotificationAction.warn) {
          if (subject === NotificationSubject.recipe) {
            return `Hai ricevuto un avviso dal team di moderazione per la tua ricetta "${safeTitle}"`;
          }
          if (subject === NotificationSubject.comment) {
            return `Hai ricevuto un avviso dal team di moderazione per un tuo commento`;
          }
          return `Hai ricevuto un avviso dal team di moderazione per il tuo profilo`;
        }
        return `${actor} ha eseguito un'azione`;

      case 'fr':
        if (
          action === NotificationAction.like &&
          subject === NotificationSubject.recipe
        ) {
          return `${actor} a aimé votre recette "${safeTitle}"`;
        }
        if (
          action === NotificationAction.comment &&
          subject === NotificationSubject.recipe
        ) {
          return `${actor} a commenté votre recette "${safeTitle}"`;
        }
        if (
          action === NotificationAction.comment &&
          subject === NotificationSubject.comment
        ) {
          return `${actor} a répondu à votre commentaire`;
        }
        if (action === NotificationAction.friend_request) {
          return `${actor} vous a envoyé une demande d'ami`;
        }
        if (action === NotificationAction.friend_accept) {
          return `${actor} a accepté votre demande d'ami`;
        }
        if (
          action === NotificationAction.post &&
          subject === NotificationSubject.recipe
        ) {
          return `${actor} a publié une nouvelle recette "${safeTitle}"`;
        }
        if (
          action === NotificationAction.update &&
          subject === NotificationSubject.recipe
        ) {
          return `${actor} a mis à jour la recette "${safeTitle}"`;
        }
        if (
          action === NotificationAction.delete &&
          subject === NotificationSubject.recipe
        ) {
          return `${actor} a supprimé une recette`;
        }
        if (action === NotificationAction.warn) {
          if (subject === NotificationSubject.recipe) {
            return `Vous avez reçu un avertissement de l'équipe de modération pour votre recette "${safeTitle}"`;
          }
          if (subject === NotificationSubject.comment) {
            return `Vous avez reçu un avertissement de l'équipe de modération pour l'un de vos commentaires`;
          }
          return `Vous avez reçu un avertissement de l'équipe de modération pour votre profil`;
        }
        return `${actor} a effectué une action`;

      case 'en':
      default:
        if (
          action === NotificationAction.like &&
          subject === NotificationSubject.recipe
        ) {
          return `${actor} liked your recipe "${safeTitle}"`;
        }
        if (
          action === NotificationAction.comment &&
          subject === NotificationSubject.recipe
        ) {
          return `${actor} commented on your recipe "${safeTitle}"`;
        }
        if (
          action === NotificationAction.comment &&
          subject === NotificationSubject.comment
        ) {
          return `${actor} replied to your comment`;
        }
        if (action === NotificationAction.friend_request) {
          return `${actor} sent you a friend request`;
        }
        if (action === NotificationAction.friend_accept) {
          return `${actor} accepted your friend request`;
        }
        if (
          action === NotificationAction.post &&
          subject === NotificationSubject.recipe
        ) {
          return `${actor} published a new recipe "${safeTitle}"`;
        }
        if (
          action === NotificationAction.update &&
          subject === NotificationSubject.recipe
        ) {
          return `${actor} updated the recipe "${safeTitle}"`;
        }
        if (
          action === NotificationAction.delete &&
          subject === NotificationSubject.recipe
        ) {
          return `${actor} deleted a recipe`;
        }
        if (action === NotificationAction.warn) {
          if (subject === NotificationSubject.recipe) {
            return `You received a warning from the moderation team about your recipe "${safeTitle}"`;
          }
          if (subject === NotificationSubject.comment) {
            return `You received a warning from the moderation team about one of your comments`;
          }
          return `You received a warning from the moderation team about your profile`;
        }
        return `${actor} performed an action`;
    }
  }
}
