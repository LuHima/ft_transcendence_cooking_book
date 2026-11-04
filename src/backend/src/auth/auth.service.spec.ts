import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import { BanHistoryService } from '../reports/ban-history.service';
import { AccountBannedException } from './exceptions/account-banned.exception';
import { ReportReason, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as otplib from 'otplib';
import * as qrcode from 'qrcode';

jest.mock('bcrypt');
jest.mock('otplib');
jest.mock('qrcode');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    getUserByEmail: jest.Mock;
    findUserByUsername: jest.Mock;
    getUserById: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
    decode: jest.Mock;
  };
  let prisma: {
    jwtSession: {
      findMany: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
    user: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let banHistoryService: {
    recordBan: jest.Mock;
    recordUnban: jest.Mock;
    getPreviousBansCount: jest.Mock;
    getUserBanHistory: jest.Mock;
    getLatestActiveBan: jest.Mock;
  };
  let encryptionService: {
    encrypting: jest.Mock;
    decrypting: jest.Mock;
  };
  let mockGoogleClient: {
    verifyIdToken: jest.Mock;
  };

  const mockUser: any = {
    id: 1,
    username: 'mario',
    email: 'mario@example.com',
    password_hash: 'hashed_password',
    status: 'active',
    deleted_at: null,
    is_two_factor_enabled: false,
    role: 'user',
    two_factor: 'encrypted_secret',
  };

  beforeEach(async () => {
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    usersService = {
      getUserByEmail: jest.fn(),
      findUserByUsername: jest.fn(),
      getUserById: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn(),
    };

    prisma = {
      jwtSession: {
        findMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    encryptionService = {
      encrypting: jest.fn(),
      decrypting: jest.fn(),
    };

    banHistoryService = {
      recordBan: jest.fn(),
      recordUnban: jest.fn(),
      getPreviousBansCount: jest.fn(),
      getUserBanHistory: jest.fn(),
      getLatestActiveBan: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryptionService },
        { provide: BanHistoryService, useValue: banHistoryService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    mockGoogleClient = {
      verifyIdToken: jest.fn(),
    };
    (service as any).googleClient = mockGoogleClient;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signIn', () => {
    it('successfully authenticates active user without 2FA and creates session', async () => {
      usersService.getUserByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.jwtSession.findMany.mockResolvedValue([]);
      prisma.jwtSession.create.mockResolvedValue({ id_session: 10 });
      jwtService.signAsync
        .mockResolvedValueOnce('refresh-token-123')
        .mockResolvedValueOnce('access-token-123');
      jwtService.decode.mockReturnValue({ exp: 1700000000 });
      prisma.jwtSession.update.mockResolvedValue({});

      const result = await service.signIn('mario@example.com', 'Password123!');

      expect(usersService.getUserByEmail).toHaveBeenCalledWith(
        'mario@example.com',
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'Password123!',
        'hashed_password',
      );
      expect(prisma.jwtSession.create).toHaveBeenCalledWith({
        data: {
          id_user: 1,
          hashed_jwt_token: 'temp',
          expire_time_jwt: expect.any(Date),
        },
      });
      expect(result).toEqual({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      });
    });

    it('prunes the oldest session when user already has 5 or more active sessions', async () => {
      usersService.getUserByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const existingSessions = [
        { id_session: 1 },
        { id_session: 2 },
        { id_session: 3 },
        { id_session: 4 },
        { id_session: 5 },
      ];
      prisma.jwtSession.findMany.mockResolvedValue(existingSessions);
      prisma.jwtSession.delete.mockResolvedValue({});
      prisma.jwtSession.create.mockResolvedValue({ id_session: 6 });
      jwtService.signAsync
        .mockResolvedValueOnce('refresh-token')
        .mockResolvedValueOnce('access-token');
      jwtService.decode.mockReturnValue({ exp: 1700000000 });
      prisma.jwtSession.update.mockResolvedValue({});

      await service.signIn('mario@example.com', 'Password123!');

      expect(prisma.jwtSession.delete).toHaveBeenCalledWith({
        where: { id_session: 1 },
      });
    });

    it('returns challenge tempToken when user has two-factor authentication enabled', async () => {
      usersService.getUserByEmail.mockResolvedValue({
        ...mockUser,
        is_two_factor_enabled: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('temp-challenge-jwt');

      const result = await service.signIn('mario@example.com', 'Password123!');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { userId: 1, is2FaPending: true, type: 'twofactAuth' },
        { expiresIn: '5m' },
      );
      expect(result).toEqual({
        tempToken: 'temp-challenge-jwt',
        twofAuth: true,
      });
    });

    it('throws UnauthorizedException if user email does not exist', async () => {
      usersService.getUserByEmail.mockResolvedValue(null);

      await expect(
        service.signIn('unknown@example.com', 'Password123!'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws HttpException if user account is inactive', async () => {
      usersService.getUserByEmail.mockResolvedValue({
        ...mockUser,
        status: 'suspended',
      });

      await expect(
        service.signIn('mario@example.com', 'Password123!'),
      ).rejects.toThrow(HttpException);
    });

    it('throws HttpException if user account is soft-deleted', async () => {
      usersService.getUserByEmail.mockResolvedValue({
        ...mockUser,
        deleted_at: new Date(),
      });

      await expect(
        service.signIn('mario@example.com', 'Password123!'),
      ).rejects.toThrow(HttpException);
    });

    it('throws AccountBannedException with structured details when active ban exists', async () => {
      const bannedUntil = new Date(Date.now() + 10 * 86400000);
      usersService.getUserByEmail.mockResolvedValue({
        ...mockUser,
        status: UserStatus.banned,
        banned_until: bannedUntil,
      });
      banHistoryService.getLatestActiveBan.mockResolvedValue({
        reason: ReportReason.harassment_bullying,
        description: 'Abusive language',
        is_permanent: false,
      });

      try {
        await service.signIn('mario@example.com', 'Password123!');
        fail('Expected AccountBannedException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AccountBannedException);
        const response = err.getResponse();
        expect(response.code).toBe('ACCOUNT_BANNED');
        expect(response.statusCode).toBe(403);
        expect(response.details).toEqual({
          reason: ReportReason.harassment_bullying,
          description: 'Abusive language',
          banned_until: bannedUntil.toISOString(),
          is_permanent: false,
        });
      }
    });

    it('throws AccountBannedException for permanent ban with is_permanent=true', async () => {
      usersService.getUserByEmail.mockResolvedValue({
        ...mockUser,
        status: UserStatus.banned,
        banned_until: null,
      });
      banHistoryService.getLatestActiveBan.mockResolvedValue({
        reason: ReportReason.hate_speech,
        description: 'Permanent exclusion',
        is_permanent: true,
      });

      try {
        await service.signIn('mario@example.com', 'Password123!');
        fail('Expected AccountBannedException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AccountBannedException);
        const response = err.getResponse();
        expect(response.code).toBe('ACCOUNT_BANNED');
        expect(response.details.is_permanent).toBe(true);
        expect(response.details.banned_until).toBeNull();
      }
    });

    it('automatically reactivates expired temporary ban upon login and authenticates user', async () => {
      const pastDate = new Date(Date.now() - 5000);
      usersService.getUserByEmail.mockResolvedValue({
        ...mockUser,
        status: UserStatus.banned,
        banned_until: pastDate,
      });
      prisma.user.update.mockResolvedValue({});
      banHistoryService.recordUnban.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.jwtSession.findMany.mockResolvedValue([]);
      prisma.jwtSession.create.mockResolvedValue({ id_session: 1 });
      jwtService.signAsync
        .mockResolvedValueOnce('refresh-token')
        .mockResolvedValueOnce('access-token');
      jwtService.decode.mockReturnValue({ exp: 1700000000 });
      prisma.jwtSession.update.mockResolvedValue({});

      const result = await service.signIn('mario@example.com', 'Password123!');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: UserStatus.active, banned_until: null },
      });
      expect(banHistoryService.recordUnban).toHaveBeenCalledWith(
        1,
        null,
        'Automated expiration upon login',
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('throws UnauthorizedException with generic message if user has no password_hash (preventing user enumeration)', async () => {
      usersService.getUserByEmail.mockResolvedValue({
        ...mockUser,
        password_hash: null,
      });

      await expect(
        service.signIn('mario@example.com', 'Password123!'),
      ).rejects.toThrow(new UnauthorizedException('invalid password or email'));
    });

    it('throws UnauthorizedException if password comparison fails', async () => {
      usersService.getUserByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.signIn('mario@example.com', 'WrongPassword!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('signUp', () => {
    it('creates new user with hashed password when credentials are valid and unique', async () => {
      usersService.getUserByEmail.mockResolvedValue(null);
      usersService.findUserByUsername.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pwd_abc');
      const createdUser = {
        id: 2,
        username: 'luigi',
        email: 'luigi@example.com',
        role: 'user',
        created_at: new Date(),
      };
      prisma.user.create.mockResolvedValue(createdUser);

      const result = await service.signUp({
        username: 'luigi',
        email: 'luigi@example.com',
        password: 'Password123!',
      });

      expect(usersService.getUserByEmail).toHaveBeenCalledWith(
        'luigi@example.com',
      );
      expect(usersService.findUserByUsername).toHaveBeenCalledWith('luigi');
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 10);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          username: 'luigi',
          email: 'luigi@example.com',
          password_hash: 'hashed_pwd_abc',
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          created_at: true,
        },
      });
      expect(result).toEqual(createdUser);
    });

    it('throws ConflictException if email is already registered', async () => {
      usersService.getUserByEmail.mockResolvedValue(mockUser);

      await expect(
        service.signUp({
          username: 'luigi',
          email: 'mario@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if username is already taken', async () => {
      usersService.getUserByEmail.mockResolvedValue(null);
      usersService.findUserByUsername.mockResolvedValue(mockUser);

      await expect(
        service.signUp({
          username: 'mario',
          email: 'luigi@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('signOut', () => {
    it('deletes all sessions for the given session ID', async () => {
      prisma.jwtSession.deleteMany.mockResolvedValue({ count: 1 });

      await service.signOut(10);

      expect(prisma.jwtSession.deleteMany).toHaveBeenCalledWith({
        where: { id_session: 10 },
      });
    });

    it('returns immediately without interacting with DB if session ID is falsy', async () => {
      await service.signOut(0);

      expect(prisma.jwtSession.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('issues a new access token when given a valid refresh token matching the active session', async () => {
      const rawRefreshToken = 'valid-refresh-token';
      const hashed = crypto
        .createHash('sha256')
        .update(rawRefreshToken)
        .digest('hex');

      jwtService.verifyAsync.mockResolvedValue({ id: 1, session: 10 });
      usersService.getUserById.mockResolvedValue(mockUser);
      prisma.jwtSession.findUnique.mockResolvedValue({
        id_session: 10,
        hashed_jwt_token: hashed,
        expire_time_jwt: new Date(Date.now() + 1000000),
      });
      jwtService.signAsync.mockResolvedValue('new-access-token');

      const result = await service.refreshToken(rawRefreshToken);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(rawRefreshToken, {
        secret: 'test-refresh-secret',
      });
      expect(usersService.getUserById).toHaveBeenCalledWith(1);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: 1,
          username: 'mario',
          role: 'user',
          type: 'access',
          session: 10,
        },
        { expiresIn: '10m' },
      );
      expect(result).toBe('new-access-token');
    });

    it('throws HttpException if token verification fails (expired or invalid)', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.refreshToken('bad-token')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws HttpException if user associated with token does not exist or is inactive', async () => {
      jwtService.verifyAsync.mockResolvedValue({ id: 99, session: 10 });
      usersService.getUserById.mockResolvedValue(null);

      await expect(service.refreshToken('token-unknown-user')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws HttpException if session is not found in database', async () => {
      jwtService.verifyAsync.mockResolvedValue({ id: 1, session: 10 });
      usersService.getUserById.mockResolvedValue(mockUser);
      prisma.jwtSession.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken('token')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws HttpException if database session has expired', async () => {
      jwtService.verifyAsync.mockResolvedValue({ id: 1, session: 10 });
      usersService.getUserById.mockResolvedValue(mockUser);
      prisma.jwtSession.findUnique.mockResolvedValue({
        id_session: 10,
        hashed_jwt_token: 'hash',
        expire_time_jwt: new Date(Date.now() - 10000), // in the past
      });

      await expect(service.refreshToken('token')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws HttpException if refresh token hash does not match stored hash', async () => {
      jwtService.verifyAsync.mockResolvedValue({ id: 1, session: 10 });
      usersService.getUserById.mockResolvedValue(mockUser);
      prisma.jwtSession.findUnique.mockResolvedValue({
        id_session: 10,
        hashed_jwt_token: 'different-stored-hash',
        expire_time_jwt: new Date(Date.now() + 100000),
      });

      await expect(service.refreshToken('token')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('twoFactorSignin', () => {
    it('completes signin and returns tokens when temporary token and 2FA code are valid', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        userId: 1,
        is2FaPending: true,
      });
      prisma.user.findUnique.mockResolvedValue(mockUser);
      encryptionService.decrypting.mockReturnValue('RAW_SECRET_KEY');
      (otplib.verify as jest.Mock).mockResolvedValue({ valid: true });

      prisma.jwtSession.findMany.mockResolvedValue([]);
      prisma.jwtSession.create.mockResolvedValue({ id_session: 12 });
      jwtService.signAsync
        .mockResolvedValueOnce('refresh-token-2fa')
        .mockResolvedValueOnce('access-token-2fa');
      jwtService.decode.mockReturnValue({ exp: 1700000000 });
      prisma.jwtSession.update.mockResolvedValue({});

      const result = await service.twoFactorSignin({
        tempToken: 'valid-temp-token',
        code: '123456',
      });

      expect(encryptionService.decrypting).toHaveBeenCalledWith(
        mockUser.two_factor,
      );
      expect(otplib.verify).toHaveBeenCalledWith({
        token: '123456',
        secret: 'RAW_SECRET_KEY',
      });
      expect(result).toEqual({
        accessToken: 'access-token-2fa',
        refreshToken: 'refresh-token-2fa',
      });
    });

    it('throws HttpException if temporary token verification fails', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(
        service.twoFactorSignin({ tempToken: 'expired-token', code: '123456' }),
      ).rejects.toThrow(HttpException);
    });

    it('throws HttpException if temporary token does not have is2FaPending set', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        userId: 1,
        is2FaPending: false,
      });

      await expect(
        service.twoFactorSignin({ tempToken: 'invalid-token', code: '123456' }),
      ).rejects.toThrow(HttpException);
    });

    it('throws HttpException if user is not found or inactive', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        userId: 1,
        is2FaPending: true,
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.twoFactorSignin({ tempToken: 'valid-token', code: '123456' }),
      ).rejects.toThrow(HttpException);
    });

    it('throws HttpException if TOTP code verification fails', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        userId: 1,
        is2FaPending: true,
      });
      prisma.user.findUnique.mockResolvedValue(mockUser);
      encryptionService.decrypting.mockReturnValue('RAW_SECRET_KEY');
      (otplib.verify as jest.Mock).mockResolvedValue({ valid: false });

      await expect(
        service.twoFactorSignin({ tempToken: 'valid-token', code: '000000' }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('twoFactorAuthEnable', () => {
    it('generates secret, updates database, and returns qrCode and key for valid password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        is_two_factor_enabled: false,
        password_hash: 'hashed_password',
        email: 'mario@example.com',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (otplib.generateSecret as jest.Mock).mockReturnValue('GENERATED_SECRET');
      (otplib.generateURI as jest.Mock).mockReturnValue('otpauth://totp/...');
      encryptionService.encrypting.mockReturnValue('ENCRYPTED_SECRET');
      (qrcode.toDataURL as jest.Mock).mockResolvedValue(
        'data:image/png;base64,mockqr',
      );
      prisma.user.update.mockResolvedValue({});

      const result = await service.twoFactorAuthEnable(1, 'Password123!');

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'Password123!',
        'hashed_password',
      );
      expect(encryptionService.encrypting).toHaveBeenCalledWith(
        'GENERATED_SECRET',
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { two_factor: 'ENCRYPTED_SECRET' },
      });
      expect(result).toEqual({
        qrCode: 'data:image/png;base64,mockqr',
        key: 'GENERATED_SECRET',
      });
    });

    it('throws HttpException if user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.twoFactorAuthEnable(99, 'Password123!'),
      ).rejects.toThrow(HttpException);
    });

    it('throws HttpException if two-factor is already enabled on user account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        is_two_factor_enabled: true,
        password_hash: 'hashed_password',
        email: 'mario@example.com',
      });

      await expect(
        service.twoFactorAuthEnable(1, 'Password123!'),
      ).rejects.toThrow(HttpException);
    });

    it('throws HttpException if provided password does not match account password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        is_two_factor_enabled: false,
        password_hash: 'hashed_password',
        email: 'mario@example.com',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.twoFactorAuthEnable(1, 'WrongPassword'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('verify', () => {
    it('verifies code against secret and activates 2FA on the account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        is_two_factor_enabled: false,
        two_factor: 'encrypted_secret',
      });
      encryptionService.decrypting.mockReturnValue('RAW_SECRET');
      (otplib.verify as jest.Mock).mockResolvedValue({ valid: true });
      prisma.user.update.mockResolvedValue({});

      const result = await service.verify(1, '123456');

      expect(encryptionService.decrypting).toHaveBeenCalledWith(
        'encrypted_secret',
      );
      expect(otplib.verify).toHaveBeenCalledWith({
        token: '123456',
        secret: 'RAW_SECRET',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { is_two_factor_enabled: true },
      });
      expect(result).toEqual({
        message: 'Two-factor authentication enabled successfully',
      });
    });

    it('throws HttpException if user does not exist or has no stored two_factor secret', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verify(1, '123456')).rejects.toThrow(HttpException);
    });

    it('throws HttpException if two-factor authentication is already enabled', async () => {
      prisma.user.findUnique.mockResolvedValue({
        is_two_factor_enabled: true,
        two_factor: 'encrypted_secret',
      });

      await expect(service.verify(1, '123456')).rejects.toThrow(HttpException);
    });

    it('throws HttpException if code verification returns invalid', async () => {
      prisma.user.findUnique.mockResolvedValue({
        is_two_factor_enabled: false,
        two_factor: 'encrypted_secret',
      });
      encryptionService.decrypting.mockReturnValue('RAW_SECRET');
      (otplib.verify as jest.Mock).mockResolvedValue({ valid: false });

      await expect(service.verify(1, '000000')).rejects.toThrow(HttpException);
    });
  });

  describe('twoFactorAuthDisable', () => {
    it('disables 2FA and clears stored secret when password is valid', async () => {
      prisma.user.findUnique.mockResolvedValue({
        is_two_factor_enabled: true,
        password_hash: 'hashed_password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({});

      const result = await service.twoFactorAuthDisable(1, 'Password123!');

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'Password123!',
        'hashed_password',
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { is_two_factor_enabled: false, two_factor: null },
      });
      expect(result).toEqual({
        message: 'Two-factor authentication disabled successfully',
      });
    });

    it('throws HttpException if user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.twoFactorAuthDisable(99, 'Password123!'),
      ).rejects.toThrow(HttpException);
    });

    it('throws HttpException if password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue({
        is_two_factor_enabled: true,
        password_hash: 'hashed_password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.twoFactorAuthDisable(1, 'WrongPassword'),
      ).rejects.toThrow(HttpException);
    });

    it('throws HttpException if two-factor authentication is already disabled', async () => {
      prisma.user.findUnique.mockResolvedValue({
        is_two_factor_enabled: false,
        password_hash: 'hashed_password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.twoFactorAuthDisable(1, 'Password123!'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('googleSignIn', () => {
    const validGooglePayload = {
      sub: 'google-sub-12345',
      email: 'mario@example.com',
      email_verified: true,
      given_name: 'Mario',
      family_name: 'Rossi',
      picture: 'https://lh3.googleusercontent.com/avatar.jpg',
    };

    it('throws internal server error if GOOGLE_CLIENT_ID is not configured', async () => {
      delete process.env.GOOGLE_CLIENT_ID;

      await expect(service.googleSignIn('any-token')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws HttpException if Google token verification fails', async () => {
      mockGoogleClient.verifyIdToken.mockRejectedValue(
        new Error('Token verification failed'),
      );

      await expect(service.googleSignIn('invalid-token')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws HttpException if Google payload is missing or missing sub/email', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => ({ email: null, sub: null }),
      });

      await expect(service.googleSignIn('token')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws HttpException if Google account email is not verified', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          ...validGooglePayload,
          email_verified: false,
        }),
      });

      await expect(service.googleSignIn('token')).rejects.toThrow(
        HttpException,
      );
    });

    it('successfully authenticates existing user matching Google ID', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => validGooglePayload,
      });
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        id_google: 'google-sub-12345',
      });
      prisma.jwtSession.findMany.mockResolvedValue([]);
      prisma.jwtSession.create.mockResolvedValue({ id_session: 1 });
      jwtService.signAsync
        .mockResolvedValueOnce('refresh-token')
        .mockResolvedValueOnce('access-token');
      jwtService.decode.mockReturnValue({ exp: 1700000000 });
      prisma.jwtSession.update.mockResolvedValue({});

      const result = await service.googleSignIn('valid-token');

      expect(mockGoogleClient.verifyIdToken).toHaveBeenCalledWith({
        idToken: 'valid-token',
        audience: 'test-google-client-id',
      });
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('successfully links Google ID to existing user found by verified email', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => validGooglePayload,
      });
      // 1. Not found by id_google
      prisma.user.findUnique.mockResolvedValueOnce(null);
      // 2. Found by email with id_google: null
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        id_google: null,
      });
      // 3. Updated user with id_google
      prisma.user.update.mockResolvedValueOnce({
        ...mockUser,
        id_google: 'google-sub-12345',
      });
      prisma.jwtSession.findMany.mockResolvedValue([]);
      prisma.jwtSession.create.mockResolvedValue({ id_session: 1 });
      jwtService.signAsync
        .mockResolvedValueOnce('refresh-token')
        .mockResolvedValueOnce('access-token');
      jwtService.decode.mockReturnValue({ exp: 1700000000 });
      prisma.jwtSession.update.mockResolvedValue({});

      const result = await service.googleSignIn('valid-token');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { id_google: 'google-sub-12345' },
      });
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('throws HttpException if existing user found by email is already bound to a different Google ID', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => validGooglePayload,
      });
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        id_google: 'other-google-sub',
      });

      await expect(service.googleSignIn('valid-token')).rejects.toThrow(
        HttpException,
      );
    });

    it('successfully provisions new user when neither Google ID nor email exists', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'new-google-sub',
          email: 'newbie@example.com',
          email_verified: true,
          given_name: 'Luigi',
          family_name: 'Verdi',
          picture: 'https://lh3.googleusercontent.com/pic.jpg',
        }),
      });
      // 1. lookup by id_google
      prisma.user.findUnique.mockResolvedValueOnce(null);
      // 2. lookup by email
      prisma.user.findUnique.mockResolvedValueOnce(null);
      // 3. username collision check in generateUniqueUsername
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const newUser = {
        id: 2,
        id_google: 'new-google-sub',
        email: 'newbie@example.com',
        username: 'luigi_verdi_123',
        status: UserStatus.active,
        deleted_at: null,
        is_two_factor_enabled: false,
      };
      prisma.user.create.mockResolvedValueOnce(newUser);
      prisma.jwtSession.findMany.mockResolvedValue([]);
      prisma.jwtSession.create.mockResolvedValue({ id_session: 2 });
      jwtService.signAsync
        .mockResolvedValueOnce('refresh-token')
        .mockResolvedValueOnce('access-token');
      jwtService.decode.mockReturnValue({ exp: 1700000000 });
      prisma.jwtSession.update.mockResolvedValue({});

      const result = await service.googleSignIn('valid-token');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id_google: 'new-google-sub',
            email: 'newbie@example.com',
            first_name: 'Luigi',
            last_name: 'Verdi',
            avatar_url: 'https://lh3.googleusercontent.com/pic.jpg',
          }),
        }),
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('returns temporary 2FA challenge token when user has 2FA enabled', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => validGooglePayload,
      });
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        id_google: 'google-sub-12345',
        is_two_factor_enabled: true,
      });
      jwtService.signAsync.mockResolvedValue('temp-2fa-token');

      const result = await service.googleSignIn('valid-token');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { userId: mockUser.id, is2FaPending: true, type: 'twofactAuth' },
        { expiresIn: '5m' },
      );
      expect(result).toEqual({
        tempToken: 'temp-2fa-token',
        twofAuth: true,
      });
    });

    it('throws HttpException when user account is inactive or soft-deleted', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => validGooglePayload,
      });
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        id_google: 'google-sub-12345',
        status: 'suspended',
      });

      await expect(service.googleSignIn('valid-token')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws AccountBannedException when user has an active ban', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => validGooglePayload,
      });
      const bannedUntil = new Date(Date.now() + 10 * 86400000);
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        id_google: 'google-sub-12345',
        status: UserStatus.banned,
        banned_until: bannedUntil,
      });
      banHistoryService.getLatestActiveBan.mockResolvedValue({
        reason: ReportReason.harassment_bullying,
        description: 'Banned for harassment',
        is_permanent: false,
      });

      await expect(service.googleSignIn('valid-token')).rejects.toThrow(
        AccountBannedException,
      );
    });

    it('automatically reactivates expired temporary ban and authenticates user', async () => {
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => validGooglePayload,
      });
      const pastDate = new Date(Date.now() - 5000);
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        id_google: 'google-sub-12345',
        status: UserStatus.banned,
        banned_until: pastDate,
      });
      prisma.user.update.mockResolvedValue({});
      banHistoryService.recordUnban.mockResolvedValue({});
      prisma.jwtSession.findMany.mockResolvedValue([]);
      prisma.jwtSession.create.mockResolvedValue({ id_session: 1 });
      jwtService.signAsync
        .mockResolvedValueOnce('refresh-token')
        .mockResolvedValueOnce('access-token');
      jwtService.decode.mockReturnValue({ exp: 1700000000 });
      prisma.jwtSession.update.mockResolvedValue({});

      const result = await service.googleSignIn('valid-token');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { status: UserStatus.active, banned_until: null },
      });
      expect(banHistoryService.recordUnban).toHaveBeenCalledWith(
        mockUser.id,
        null,
        'Automated expiration upon login',
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });
});
