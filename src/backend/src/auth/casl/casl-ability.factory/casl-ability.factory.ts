import { Action } from '../action.enum';
import {
  AbilityBuilder,
  MongoAbility,
  createMongoAbility,
  InferSubjects,
  ForcedSubject,
  subject,
} from '@casl/ability'; //MongoAbility non centra niente con MongoDB
import { Injectable } from '@nestjs/common';
import { ActiveUserData } from 'src/common/decorators/current-user.decorator';
import {
  Recipe,
  Comment,
  User,
  Role,
  Notification,
  Ingredient,
  Tag,
} from '@prisma/client';
import { createHttpException, errors } from 'src/common/config/error.config';

// Definisce i soggetti (come stringhe per Prisma, o 'all')
export type Subjects =
  | InferSubjects<Recipe & ForcedSubject<'Recipe'>>
  | InferSubjects<Comment & ForcedSubject<'Comment'>>
  | InferSubjects<User & ForcedSubject<'User'>>
  | InferSubjects<Notification & ForcedSubject<'Notification'>>
  | InferSubjects<Tag & ForcedSubject<'Tag'>>
  | InferSubjects<Ingredient & ForcedSubject<'Ingredient'>>
  | 'all';

export enum AppSubject {
  Recipe = 'Recipe',
  Comment = 'Comment',
  User = 'User',
  Notification = 'Notification',
  Tag = 'Tag',
  Ingredient = 'Ingredient',
}

// Definisce il tipo AppAbility con MongoAbility
export type AppAbility = MongoAbility<[Action, Subjects], any>;
/* 
	1. Action: Cosa puoi fare (es. Read, Update, Delete).
	2. Subject: Su cosa puoi farlo (es. una ricetta, un commento, un utente).
*/

@Injectable()
export class CaslAbilityFactory {
  private createForUser(user: ActiveUserData) {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    if (user.role === Role.admin) {
      can(Action.Manage, 'all');
      cannot(Action.Ban, 'User', { id: user.id });
    } else if (user.role === Role.moderator) {
      can(Action.Read, 'all');
      can(Action.Create, 'Recipe');
      can([Action.Update, Action.Delete], 'Recipe', { user_id: user.id });
      can(Action.Create, 'Comment');
      can([Action.Update, Action.Delete], 'Comment', { user_id: user.id });
      can(Action.Delete, 'Comment', { 'recipe.user_id': user.id });

      can(Action.Report, 'Recipe');
      can(Action.Report, 'Comment');
      can(Action.Report, 'User');

      can(Action.Ban, 'Recipe');
      can(Action.Ban, 'Comment');
      can(Action.Ban, 'User');

      cannot(Action.Ban, 'User', { id: user.id });
      cannot(Action.Ban, 'User', { role: Role.admin });
      cannot(Action.Ban, 'User', { role: Role.moderator });

      cannot(Action.Ban, 'Recipe', { user_id: user.id });
      cannot(Action.Ban, 'Recipe', { 'user.role': Role.admin });
      cannot(Action.Ban, 'Recipe', { 'user.role': Role.moderator });

      cannot([Action.Create, Action.Update, Action.Delete], 'Tag');
      cannot([Action.Create, Action.Update, Action.Delete], 'Ingredient');

      // user.role mi fa vedere dentro la tabella user il ruolo perche piglia il target che li passo da fuori con la funzione ability.can()
      // e ci fa target.user.role
      // e essendo collegate le tabelle sul database, dalla ricetta arrivo all'utente

      // stessa cosa percui mi trova id quando cerco User e non scrivo user_id come sulle ricette

      // can(Action.Report, 'Comment'); se è cosi faccio solo un controllo sull'abilita di fare quella azione non gli passo nessun oggetto nel ability.can()

      cannot(Action.Ban, 'Comment', { 'user.role': Role.admin });
      cannot(Action.Ban, 'Comment', { 'user.role': Role.moderator });
      cannot(Action.Ban, 'Comment', { user_id: user.id });
    } else {
      can(Action.Read, 'all');

      can(Action.Create, 'Recipe');
      can(Action.Update, 'Recipe', { user_id: user.id });
      can(Action.Delete, 'Recipe', { user_id: user.id });

      can(Action.Create, 'Comment');
      can(Action.Update, 'Comment', { user_id: user.id });
      can(Action.Delete, 'Comment', { user_id: user.id });
      can(Action.Delete, 'Comment', { 'recipe.user_id': user.id });

      can(Action.Report, 'Recipe');
      can(Action.Report, 'Comment');
      can(Action.Report, 'User');
    }

    can(Action.Read, 'Notification', { user_id: user.id });
    can(Action.Delete, 'Notification', { user_id: user.id });
    can(Action.Accept, 'Notification', { user_id: user.id });
    can(Action.Refuse, 'Notification', { user_id: user.id });

    return build();
  }

  check(
    user: ActiveUserData,
    action: Action,
    subjectName: AppSubject,
    target?: any,
  ): void {
    const ability = this.createForUser(user);
    const item = target
      ? subject(subjectName as any, target)
      : (subjectName as any);
    if (!ability.can(action, item)) {
      throw createHttpException(errors.common.forbidden);
    }
  }
}
