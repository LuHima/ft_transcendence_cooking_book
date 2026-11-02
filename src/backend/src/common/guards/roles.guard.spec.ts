import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  interface MockUser {
    id?: number;
    role?: string;
  }

  const createMockContext = (user?: MockUser): ExecutionContext => {
    const mockRequest = { user };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;
  };

  it('allows access when no roles are required on route or class', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ id: 1, role: 'user' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when user possesses an authorized role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['admin', 'moderator']);
    const context = createMockContext({ id: 1, role: 'moderator' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when user has no role or is unauthenticated in request', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['admin', 'moderator']);
    const contextWithoutUser = createMockContext(undefined);

    expect(() => guard.canActivate(contextWithoutUser)).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when user role is not authorized', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['admin', 'moderator']);
    const contextWithUserRole = createMockContext({ id: 1, role: 'user' });

    expect(() => guard.canActivate(contextWithUserRole)).toThrow(
      ForbiddenException,
    );
  });
});
