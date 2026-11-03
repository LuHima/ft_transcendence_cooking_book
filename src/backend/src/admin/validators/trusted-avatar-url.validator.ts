import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validation constraint checking that an avatar URL supplied in administrative payloads is either:
 * 1. A safe relative path to local uploads (`/uploads/avatars/*`) without traversal.
 * 2. An HTTPS URL matching the whitelist defined in `TRUSTED_AVATAR_DOMAINS`.
 * Rejects insecure HTTP protocols, private IP addresses (SSRF prevention), and unlisted domains.
 */
@ValidatorConstraint({ name: 'isTrustedAvatarUrl', async: false })
export class IsTrustedAvatarUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || value === undefined || value === '') {
      return true;
    }
    if (typeof value !== 'string') {
      return false;
    }
    const val = value.trim();

    // 1. Safe relative path to the local uploads directory
    if (val.startsWith('/uploads/avatars/')) {
      if (val.includes('..') || val.includes('\\')) {
        return false;
      }
      return true;
    }

    // 2. Reject insecure http
    if (val.startsWith('http://')) {
      return false;
    }

    // 3. Must be https
    if (!val.startsWith('https://')) {
      return false;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(val);
    } catch {
      return false;
    }

    if (parsedUrl.protocol !== 'https:') {
      return false;
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // 4. Reject private, loopback, link-local, and internal addresses
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return false;
    }

    // 5. Compare against trusted domains from environment
    const rawEnv = process.env.TRUSTED_AVATAR_DOMAINS;
    const trustedDomains = rawEnv
      ? rawEnv
          .split(',')
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean)
      : [
          'avatars.githubusercontent.com',
          'images.unsplash.com',
          'gravatar.com',
        ];

    return trustedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  }

  defaultMessage(): string {
    return 'avatar_url must be a relative path matching /uploads/avatars/* or an HTTPS URL from a trusted domain';
  }
}

export function IsTrustedAvatarUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsTrustedAvatarUrlConstraint,
    });
  };
}
