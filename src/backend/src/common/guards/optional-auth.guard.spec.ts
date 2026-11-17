import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';
import { OptionalAuthGuard } from './optional-auth.guard';
import { Role } from '@prisma/client';

describe('OptionalAuthGuard', () => {
  let guard: OptionalAuthGuard;
  let jwtService: JwtService;

  const createMockContext = (
    cookies: Record<string, any> = {},
  ): ExecutionContext => {
    const request: any = { cookies };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    } as unknown as JwtService;
    guard = new OptionalAuthGuard(jwtService);
  });

  it('should return true and attach user to request when valid accessToken cookie is present', async () => {
    const context = createMockContext({ accessToken: 'valid-token' });
    const payload = {
      sub: 1,
      username: 'mario',
      role: Role.user,
      session: 42,
      type: 'access',
    };
    (jwtService.verifyAsync as jest.Mock).mockResolvedValueOnce(payload);

    const canActivate = await guard.canActivate(context);

    expect(canActivate).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.user).toEqual({
      id: 1,
      username: 'mario',
      role: Role.user,
      session: 42,
    });
  });

  it('should return true and not attach user when accessToken cookie is absent', async () => {
    const context = createMockContext({});

    const canActivate = await guard.canActivate(context);

    expect(canActivate).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.user).toBeUndefined();
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should return true without throwing when accessToken is invalid or expired', async () => {
    const context = createMockContext({ accessToken: 'expired-token' });
    (jwtService.verifyAsync as jest.Mock).mockRejectedValueOnce(
      new Error('Token expired'),
    );

    const canActivate = await guard.canActivate(context);

    expect(canActivate).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.user).toBeUndefined();
  });

  it('leaves user undefined when JwtSession was revoked or user is banned', async () => {
    const mockPrisma = {
      jwtSession: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            status: 'active',
            deleted_at: null,
            role: Role.user,
            username: 'mario',
          }),
      },
    } as any;
    const guardWithPrisma = new OptionalAuthGuard(jwtService, mockPrisma);
    const context = createMockContext({ accessToken: 'valid-token' });
    (jwtService.verifyAsync as jest.Mock).mockResolvedValueOnce({
      sub: 1,
      username: 'mario',
      role: Role.user,
      session: 42,
      type: 'access',
    });

    const canActivate = await guardWithPrisma.canActivate(context);

    expect(canActivate).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect(request.user).toBeUndefined();
  });
});

describe('AuthGuard', () => {
  it('throws UnauthorizedException when JwtSession is revoked or user is inactive', async () => {
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 1,
        username: 'mario',
        role: Role.user,
        session: 42,
        type: 'access',
      }),
    } as unknown as JwtService;
    const mockPrisma = {
      jwtSession: {
        findUnique: jest.fn().mockResolvedValue({
          id_session: 42,
          id_user: 1,
          expire_time_jwt: new Date(Date.now() + 60_000),
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'banned',
          deleted_at: null,
          role: Role.user,
          username: 'mario',
        }),
      },
    } as any;
    const authGuard = new AuthGuard(jwtService, mockPrisma);
    const request: any = { cookies: { accessToken: 'valid-token' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(authGuard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject a non-numeric session claim in AuthGuard without querying Prisma', async () => {
    const localJwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 1,
        username: 'mario',
        role: Role.user,
        type: 'access',
        session: 'invalid-session',
      }),
    } as unknown as JwtService;
    const findUniqueSession = jest.fn();
    const mockPrisma = {
      jwtSession: { findUnique: findUniqueSession },
      user: { findUnique: jest.fn() },
    } as any;
    const authGuard = new AuthGuard(localJwtService, mockPrisma);
    const request: any = { cookies: { accessToken: 'valid-token' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(authGuard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findUniqueSession).not.toHaveBeenCalled();
  });

  it('should leave request.user undefined for a non-numeric session claim in OptionalAuthGuard without querying Prisma', async () => {
    const localJwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 1,
        username: 'mario',
        role: Role.user,
        type: 'access',
        session: 'invalid-session',
      }),
    } as unknown as JwtService;
    const findUniqueSession = jest.fn();
    const mockPrisma = {
      jwtSession: { findUnique: findUniqueSession },
      user: { findUnique: jest.fn() },
    } as any;
    const optionalGuard = new OptionalAuthGuard(localJwtService, mockPrisma);
    const request: any = { cookies: { accessToken: 'valid-token' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(optionalGuard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
    expect(findUniqueSession).not.toHaveBeenCalled();
  });
});
