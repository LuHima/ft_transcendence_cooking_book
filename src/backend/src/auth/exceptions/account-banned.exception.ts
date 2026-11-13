import { HttpException, HttpStatus } from '@nestjs/common';
import { ReportReason } from '@prisma/client';

export interface AccountBannedPayload {
  reason: ReportReason;
  description?: string | null;
  banned_until: Date | null;
  is_permanent: boolean;
}

/**
 * Structured HTTP 403 Forbidden exception delivered when a suspended/banned
 * user attempts authentication.
 */
export class AccountBannedException extends HttpException {
  constructor(payload: AccountBannedPayload) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        code: 'ACCOUNT_BANNED',
        message:
          'Your account has been suspended for violating community guidelines.',
        details: {
          reason: payload.reason,
          description: payload.description ?? null,
          banned_until: payload.banned_until
            ? payload.banned_until.toISOString()
            : null,
          is_permanent: payload.is_permanent,
        },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
