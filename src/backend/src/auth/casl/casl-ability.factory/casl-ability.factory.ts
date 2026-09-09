import { Prisma } from "@prisma/client";
import { Action } from "../action.enum";
//import { }

/* @Injectable()
export class CaslAbilityFactory {
  createForUser(user: User) {
  //  const { can, cannot, build } = new AbilityBuilder(Prisma.);

    if (user.isAdmin) {
      can(Action.Manage, 'all'); // read-write access to everything
    } else {
      can(Action.Read, 'all'); // read-only access to everything
    }

    can(Action.Update, Article, { authorId: user.id });
    cannot(Action.Delete, Article, { isPublished: true });

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
} */
