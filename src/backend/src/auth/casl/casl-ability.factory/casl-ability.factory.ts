import { PrismaClient } from "@prisma/client";
import { Action } from "../action.enum";
import { AbilityBuilder, MongoAbility, createMongoAbility, InferSubjects, ForcedSubject  } from '@casl/ability'; //MongoAbility non centra niente con MongoDB
import { AuthGuard } from "src/common/guards/auth.guard";
import { UseGuards, Injectable } from "@nestjs/common";
import { CurrentUser, ActiveUserData } from "src/common/decorators/current-user.decorator";
import { Recipe, Comment, User, Role } from "@prisma/client";

	// Definisce i soggetti (come stringhe per Prisma, o 'all')
	export type Subjects = InferSubjects<Recipe & ForcedSubject<'Recipe'>> | InferSubjects<Comment & ForcedSubject<'Comment'>> | InferSubjects<User & ForcedSubject<'User'>> | 'all';      

	// Definisce il tipo AppAbility con MongoAbility
	export type AppAbility = MongoAbility<[Action, Subjects]>;
/* 
	1. Action: Cosa puoi fare (es. Read, Update, Delete).
	2. Subject: Su cosa puoi farlo (es. una ricetta, un commento, un utente).
*/
@Injectable()
//@UseGuards(AuthGuard)
export class CaslAbilityFactory {

	createForUser(user: ActiveUserData) {
		const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

		if (user.role ===  Role.admin) {
		can(Action.Manage, 'all');
		} 
		else {
			can(Action.Read, 'all');
			can(Action.Create, 'Recipe');
			can(Action.Update, 'Recipe', { user_id: user.id });
			can(Action.Delete, 'Recipe', { user_id: user.id });
			can(Action.Report, 'Recipe')
			can(Action.Report, 'Comment')

			cannot(Action.Manage, 'all')
			cannot(Action.Ban, 'Recipe')
			cannot(Action.Ban, 'Comment')
			cannot(Action.Ban, 'User')
		}
		return build();
		}
}