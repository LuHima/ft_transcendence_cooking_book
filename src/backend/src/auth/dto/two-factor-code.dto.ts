import { PickType } from '@nestjs/swagger';
import { TwoFactorAuth } from '../../users/dto/twoFactor-user.dto';

/**
 * Payload for verifying and activating two-factor authentication with a 6-digit TOTP code.
 */
export class TwoFactorCodeDto extends PickType(TwoFactorAuth, [
  'code',
] as const) {}

export { TwoFactorCodeDto as TwoFactorCode };
