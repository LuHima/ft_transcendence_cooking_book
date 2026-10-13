import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OptionalAuthGuard } from './optional-auth.guard';
import { Role } from '@prisma/client';

describe('OptionalAuthGuard', () => {
  let guard: OptionalAuthGuard;
  let jwtService: JwtService;

  const createMockContext = (cookies: Record<string, any> = {}): ExecutionContext => {
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
});
