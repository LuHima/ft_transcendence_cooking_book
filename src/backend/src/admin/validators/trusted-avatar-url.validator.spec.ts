import { IsTrustedAvatarUrlConstraint } from './trusted-avatar-url.validator';

describe('IsTrustedAvatarUrlConstraint', () => {
  let constraint: IsTrustedAvatarUrlConstraint;
  const originalEnv = process.env.TRUSTED_AVATAR_DOMAINS;

  beforeEach(() => {
    constraint = new IsTrustedAvatarUrlConstraint();
    delete process.env.TRUSTED_AVATAR_DOMAINS;
  });

  afterAll(() => {
    process.env.TRUSTED_AVATAR_DOMAINS = originalEnv;
  });

  it('allows null, undefined, and empty string', () => {
    expect(constraint.validate(null)).toBe(true);
    expect(constraint.validate(undefined)).toBe(true);
    expect(constraint.validate('')).toBe(true);
  });

  it('rejects legacy uploads avatar relative path', () => {
    expect(
      constraint.validate('/uploads/avatars/avatar-1700000-uuid.webp'),
    ).toBe(false);
  });

  it('allows valid canonical media avatar path', () => {
    expect(
      constraint.validate('/api/media/avatars/42/avatar-1700000-uuid.webp'),
    ).toBe(true);
  });

  it('rejects path traversal attempts in relative path', () => {
    expect(constraint.validate('/uploads/avatars/../../etc/passwd')).toBe(
      false,
    );
  });

  it('rejects path traversal attempts in canonical media avatar path', () => {
    expect(
      constraint.validate('/api/media/avatars/42/../../etc/passwd'),
    ).toBe(false);
  });

  it('rejects insecure http URLs', () => {
    expect(
      constraint.validate('http://avatars.githubusercontent.com/u/123'),
    ).toBe(false);
  });

  it('allows default trusted domains over HTTPS', () => {
    expect(
      constraint.validate('https://avatars.githubusercontent.com/u/12345'),
    ).toBe(true);
    expect(constraint.validate('https://images.unsplash.com/photo-1234')).toBe(
      true,
    );
    expect(constraint.validate('https://secure.gravatar.com/avatar/1234')).toBe(
      true,
    );
  });

  it('rejects untrusted domains', () => {
    expect(constraint.validate('https://evil-hacker.com/malicious.png')).toBe(
      false,
    );
  });

  it('rejects loopback and private network IPs', () => {
    expect(constraint.validate('https://127.0.0.1/avatar.png')).toBe(false);
    expect(constraint.validate('https://localhost/avatar.png')).toBe(false);
    expect(constraint.validate('https://10.0.0.1/avatar.png')).toBe(false);
    expect(constraint.validate('https://192.168.1.1/avatar.png')).toBe(false);
    expect(constraint.validate('https://169.254.169.254/meta-data')).toBe(
      false,
    );
  });

  it('respects TRUSTED_AVATAR_DOMAINS environment variable', () => {
    process.env.TRUSTED_AVATAR_DOMAINS = 'cdn.mycompany.org,assets.wecook.test';
    expect(constraint.validate('https://cdn.mycompany.org/avatar.webp')).toBe(
      true,
    );
    expect(
      constraint.validate('https://avatars.githubusercontent.com/u/123'),
    ).toBe(false);
  });
});
