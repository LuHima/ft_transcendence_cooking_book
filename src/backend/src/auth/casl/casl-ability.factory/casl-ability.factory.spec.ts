import { HttpException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Action } from '../action.enum';
import { AppSubject, CaslAbilityFactory } from './casl-ability.factory';

describe('CaslAbilityFactory', () => {
  let factory: CaslAbilityFactory;

  const adminUser = { id: 1, username: 'admin', role: Role.admin, session: 1 };
  const modUser = { id: 2, username: 'mod', role: Role.moderator, session: 2 };
  const normalUser = { id: 3, username: 'user', role: Role.user, session: 3 };

  beforeEach(() => {
    factory = new CaslAbilityFactory();
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  describe('Admin permissions & self-ban guard', () => {
    it('allows admin to manage any resource including other users', () => {
      expect(() =>
        factory.check(adminUser, Action.Manage, AppSubject.Recipe, {
          user_id: 99,
        }),
      ).not.toThrow();
      expect(() =>
        factory.check(adminUser, Action.Ban, AppSubject.User, { id: 99 }),
      ).not.toThrow();
      expect(() =>
        factory.check(adminUser, Action.Delete, AppSubject.Tag),
      ).not.toThrow();
    });

    it('prevents admin from banning themselves', () => {
      expect(() =>
        factory.check(adminUser, Action.Ban, AppSubject.User, {
          id: adminUser.id,
        }),
      ).toThrow(HttpException);
    });
  });

  describe('Moderator permissions & hierarchy guards', () => {
    it('prevents moderator from banning self or admins, while allowing moderation of other moderators', () => {
      // User targets
      expect(() =>
        factory.check(modUser, Action.Ban, AppSubject.User, { id: modUser.id }),
      ).toThrow(HttpException);
      expect(() =>
        factory.check(modUser, Action.Ban, AppSubject.User, {
          id: 99,
          role: Role.admin,
        }),
      ).toThrow(HttpException);
      expect(() =>
        factory.check(modUser, Action.Ban, AppSubject.User, {
          id: 98,
          role: Role.moderator,
        }),
      ).not.toThrow();

      // Recipe targets
      expect(() =>
        factory.check(modUser, Action.Ban, AppSubject.Recipe, {
          user_id: modUser.id,
          user: { role: Role.moderator },
        }),
      ).toThrow(HttpException);
      expect(() =>
        factory.check(modUser, Action.Ban, AppSubject.Recipe, {
          user_id: 1,
          user: { role: Role.admin },
        }),
      ).toThrow(HttpException);
      expect(() =>
        factory.check(modUser, Action.Ban, AppSubject.Recipe, {
          user_id: 98,
          user: { role: Role.moderator },
        }),
      ).not.toThrow();

      // Comment targets
      expect(() =>
        factory.check(modUser, Action.Ban, AppSubject.Comment, {
          user_id: modUser.id,
          user: { role: Role.moderator },
        }),
      ).toThrow(HttpException);
      expect(() =>
        factory.check(modUser, Action.Ban, AppSubject.Comment, {
          user_id: 1,
          user: { role: Role.admin },
        }),
      ).toThrow(HttpException);
      expect(() =>
        factory.check(modUser, Action.Ban, AppSubject.Comment, {
          user_id: 98,
          user: { role: Role.moderator },
        }),
      ).not.toThrow();
    });

    it('allows moderator to ban regular users, recipes, and comments', () => {
      expect(() =>
        factory.check(modUser, Action.Ban, AppSubject.User, {
          id: 50,
          role: Role.user,
        }),
      ).not.toThrow();
      expect(() =>
        factory.check(modUser, Action.Ban, AppSubject.Recipe, {
          user_id: 50,
          user: { role: Role.user },
        }),
      ).not.toThrow();
      expect(() =>
        factory.check(modUser, Action.Ban, AppSubject.Comment, {
          user_id: 50,
          user: { role: Role.user },
        }),
      ).not.toThrow();
    });

    it('prevents moderator from creating, updating, or deleting Tags and Ingredients', () => {
      for (const action of [Action.Create, Action.Update, Action.Delete]) {
        expect(() =>
          factory.check(modUser, action, AppSubject.Tag),
        ).toThrow(HttpException);
        expect(() =>
          factory.check(modUser, action, AppSubject.Ingredient),
        ).toThrow(HttpException);
      }
    });
  });

  describe('Regular user permissions & ownership', () => {
    it('allows user to update/delete own recipe and comment, but not others', () => {
      expect(() =>
        factory.check(normalUser, Action.Update, AppSubject.Recipe, {
          user_id: normalUser.id,
        }),
      ).not.toThrow();
      expect(() =>
        factory.check(normalUser, Action.Update, AppSubject.Recipe, {
          user_id: 999,
        }),
      ).toThrow(HttpException);

      expect(() =>
        factory.check(normalUser, Action.Delete, AppSubject.Comment, {
          user_id: normalUser.id,
        }),
      ).not.toThrow();
      expect(() =>
        factory.check(normalUser, Action.Delete, AppSubject.Comment, {
          user_id: 999,
          recipe: { user_id: normalUser.id },
        }),
      ).not.toThrow();
      expect(() =>
        factory.check(modUser, Action.Delete, AppSubject.Comment, {
          user_id: 999,
          recipe: { user_id: modUser.id },
        }),
      ).not.toThrow();
      expect(() =>
        factory.check(normalUser, Action.Delete, AppSubject.Comment, {
          user_id: 999,
        }),
      ).toThrow(HttpException);
    });

    it('prevents regular user from banning anyone', () => {
      expect(() =>
        factory.check(normalUser, Action.Ban, AppSubject.User, { id: 99 }),
      ).toThrow(HttpException);
      expect(() =>
        factory.check(normalUser, Action.Ban, AppSubject.Recipe, {
          user_id: 99,
        }),
      ).toThrow(HttpException);
    });
  });

  describe('Notification ownership (all roles)', () => {
    it('allows reading and deleting own notifications only', () => {
      for (const actor of [adminUser, modUser, normalUser]) {
        for (const action of [Action.Read, Action.Delete]) {
          expect(() =>
            factory.check(actor, action, AppSubject.Notification, {
              user_id: actor.id,
            }),
          ).not.toThrow();

          // Admin has Manage 'all', while moderator & user are blocked from others' notifications
          if (actor.role !== Role.admin) {
            expect(() =>
              factory.check(actor, action, AppSubject.Notification, {
                user_id: 9999,
              }),
            ).toThrow(HttpException);
          }
        }
      }
    });

    it('denies notification access when target object has no user_id (non-admin)', () => {
      expect(() =>
        factory.check(normalUser, Action.Read, AppSubject.Notification, {}),
      ).toThrow(HttpException);
      expect(() =>
        factory.check(modUser, Action.Delete, AppSubject.Notification, {}),
      ).toThrow(HttpException);
    });
  });
});
