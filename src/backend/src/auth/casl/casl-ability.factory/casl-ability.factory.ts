import { PrismaClient } from '@prisma/client';
import { Action } from '../action.enum';
import {
  AbilityBuilder,
  MongoAbility,
  createMongoAbility,
  InferSubjects,
  ForcedSubject,
} from '@casl/ability'; //MongoAbility non centra niente con MongoDB
import { AuthGuard } from 'src/common/guards/auth.guard';
import { UseGuards, Injectable } from '@nestjs/common';
import {
  CurrentUser,
  ActiveUserData,
} from 'src/common/decorators/current-user.decorator';
import { Recipe, Comment, User, Role } from '@prisma/client';

// Definisce i soggetti (come stringhe per Prisma, o 'all')
export type Subjects =
  | InferSubjects<Recipe & ForcedSubject<'Recipe'>>
  | InferSubjects<Comment & ForcedSubject<'Comment'>>
  | InferSubjects<User & ForcedSubject<'User'>>
  | 'all';

// Definisce il tipo AppAbility con MongoAbility
export type AppAbility = MongoAbility<[Action, Subjects], any>;
/* 
	1. Action: Cosa puoi fare (es. Read, Update, Delete).
	2. Subject: Su cosa puoi farlo (es. una ricetta, un commento, un utente).
*/

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: ActiveUserData) {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    if (user.role === Role.admin) {
      can(Action.Manage, 'all');
      cannot(Action.Ban, 'User', { id: user.id });
    } else if (user.role === Role.moderator) {
      can(Action.Read, 'all');
      can(Action.Create, 'Recipe');
      can(Action.Update, 'Recipe');
      can(Action.Delete, 'Recipe');
      can(Action.Report, 'Recipe');
      can(Action.Report, 'Comment');
      can(Action.Ban, 'Recipe');
      can(Action.Ban, 'Comment');
      can(Action.Ban, 'User');

      cannot(Action.Ban, 'User', { id: user.id });
      cannot(Action.Ban, 'User', { role: Role.admin });
      cannot(Action.Ban, 'User', { role: Role.moderator });

      cannot(Action.Ban, 'Recipe', { user_id: user.id });
      cannot(Action.Ban, 'Recipe', { 'user.role': Role.admin });
      cannot(Action.Ban, 'Recipe', { 'user.role': Role.moderator });
      // user.role mi fa vedere dentro la tabella user il ruolo perche piglia il target che li passo da fuori con la funzione ability.can()
      // e ci fa target.user.role
      // e essendo collegate le tabelle sul database, dalla ricetta arrivo all'utente

      // stessa cosa percui mi trova id quando cerco User e non scrivo user_id come sulle ricette

      // can(Action.Report, 'Comment'); se è cosi faccio solo un controllo sull'abilita di fare quella azione non gli passo nessun oggetto nel ability.can()

      cannot(Action.Update, 'Recipe', { 'user.role': Role.admin });
      cannot(Action.Update, 'Recipe', { 'user.role': Role.moderator });

      cannot(Action.Delete, 'Recipe', { 'user.role': Role.admin });
      cannot(Action.Delete, 'Recipe', { 'user.role': Role.moderator });

      cannot(Action.Ban, 'Comment', { 'user.role': Role.admin });
      cannot(Action.Ban, 'Comment', { 'user.role': Role.moderator });
      cannot(Action.Ban, 'Comment', { user_id: user.id });
    } else {
      can(Action.Read, 'all');
      can(Action.Create, 'Recipe');
      can(Action.Update, 'Recipe', { user_id: user.id });
      can(Action.Delete, 'Recipe', { user_id: user.id });
      can(Action.Report, 'Recipe');
      can(Action.Report, 'Comment');

      // i cannot sono inutili in questo caso tutto cio che non è can diventa
      // cannot però per vedere come funziona o lasciato cosi che mi sembra piu chiaro
      cannot(Action.Manage, 'all');
      cannot(Action.Ban, 'Recipe');
      cannot(Action.Ban, 'Comment');
      cannot(Action.Ban, 'User');
    }
    return build();
  }
}
