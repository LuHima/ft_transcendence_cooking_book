import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

/**
 * Optional authentication guard.
 * If an accessToken cookie is present and valid, attaches the authenticated user payload to request.user.
 * If absent, invalid, or expired, execution proceeds as a guest without throwing UnauthorizedException.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  private extractTokenFromCookie(request: Request): string | undefined {
    return request.cookies?.accessToken;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromCookie(request);

    if (!token) {
      return true;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);

      if (payload.sub && payload.type === 'access') {
        request.user = {
          id: payload.sub,
          username: payload.username,
          role: payload.role,
          session: payload.session,
        };
      }
    } catch {
      // Intentionally ignored: allow guest execution
    }

    return true;
  }
}
