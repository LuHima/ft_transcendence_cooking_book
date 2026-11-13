import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { Response, Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    signIn: jest.Mock;
    signInGoogle?: jest.Mock;
    googleSignIn: jest.Mock;
    signUp: jest.Mock;
    signOut: jest.Mock;
    refreshToken: jest.Mock;
    twoFactorAuthEnable: jest.Mock;
    twoFactorSignin: jest.Mock;
    verify: jest.Mock;
    twoFactorAuthDisable: jest.Mock;
  };

  const createMockResponse = () => {
    const res: Partial<Response> = {};
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  beforeEach(async () => {
    authService = {
      signIn: jest.fn(),
      googleSignIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      refreshToken: jest.fn(),
      twoFactorAuthEnable: jest.fn(),
      twoFactorSignin: jest.fn(),
      verify: jest.fn(),
      twoFactorAuthDisable: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('signInGoogle', () => {
    it('sets authentication cookies and returns success message when 2FA is inactive', async () => {
      const res = createMockResponse();
      const mockTokens = {
        accessToken: 'mock-google-access-token',
        refreshToken: 'mock-google-refresh-token',
      };
      authService.googleSignIn.mockResolvedValue(mockTokens);

      const result = await controller.signInGoogle(
        { idToken: 'valid-google-id-token' },
        res,
      );

      expect(authService.googleSignIn).toHaveBeenCalledWith(
        'valid-google-id-token',
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'accessToken',
        'mock-google-access-token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'mock-google-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/api/auth/refresh',
        }),
      );
      expect(result).toEqual({ message: 'Authentication was successful' });
    });

    it('returns challenge tempToken without setting cookies when 2FA is enabled', async () => {
      const res = createMockResponse();
      const challengeResult = {
        tempToken: 'temp-google-jwt-token',
        twofAuth: true as const,
      };
      authService.googleSignIn.mockResolvedValue(challengeResult);

      const result = await controller.signInGoogle(
        { idToken: 'valid-google-id-token' },
        res,
      );

      expect(authService.googleSignIn).toHaveBeenCalledWith(
        'valid-google-id-token',
      );
      expect(res.cookie).not.toHaveBeenCalled();
      expect(result).toEqual(challengeResult);
    });

    it('propagates exception when googleSignIn fails', async () => {
      const res = createMockResponse();
      authService.googleSignIn.mockRejectedValue(
        new UnauthorizedException('Invalid or expired Google token'),
      );

      await expect(
        controller.signInGoogle({ idToken: 'invalid-token' }, res),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('signIn', () => {
    it('sets authentication cookies and returns success message when 2FA is inactive', async () => {
      const res = createMockResponse();
      const mockTokens = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };
      authService.signIn.mockResolvedValue(mockTokens);

      const result = await controller.signIn(
        { email: 'mario@example.com', password: 'Password123!' },
        res,
      );

      expect(authService.signIn).toHaveBeenCalledWith(
        'mario@example.com',
        'Password123!',
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'accessToken',
        'mock-access-token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'mock-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/api/auth/refresh',
        }),
      );
      expect(result).toEqual({ message: 'Authentication was successful' });
    });

    it('returns challenge tempToken without setting cookies when 2FA is enabled', async () => {
      const res = createMockResponse();
      const challengeResult = {
        tempToken: 'temp-jwt-token',
        twofAuth: true as const,
      };
      authService.signIn.mockResolvedValue(challengeResult);

      const result = await controller.signIn(
        { email: 'mario@example.com', password: 'Password123!' },
        res,
      );

      expect(authService.signIn).toHaveBeenCalledWith(
        'mario@example.com',
        'Password123!',
      );
      expect(res.cookie).not.toHaveBeenCalled();
      expect(result).toEqual(challengeResult);
    });

    it('propagates UnauthorizedException when credentials are invalid', async () => {
      const res = createMockResponse();
      authService.signIn.mockRejectedValue(
        new UnauthorizedException('invalid password or email'),
      );

      await expect(
        controller.signIn(
          { email: 'mario@example.com', password: 'WrongPassword' },
          res,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('signUp', () => {
    it('delegates user registration to authService and returns created user profile', async () => {
      const signUpDto = {
        username: 'mario',
        email: 'mario@example.com',
        password: 'Password123!',
      };
      const createdUser = {
        id: 1,
        username: 'mario',
        email: 'mario@example.com',
        role: 'user',
        created_at: new Date(),
      };
      authService.signUp.mockResolvedValue(createdUser);

      const result = await controller.signUp(signUpDto);

      expect(authService.signUp).toHaveBeenCalledWith(signUpDto);
      expect(result).toEqual(createdUser);
    });

    it('propagates ConflictException when email or username is already taken', async () => {
      const signUpDto = {
        username: 'mario',
        email: 'mario@example.com',
        password: 'Password123!',
      };
      authService.signUp.mockRejectedValue(
        new ConflictException('Email is already used'),
      );

      await expect(controller.signUp(signUpDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('signOut', () => {
    it('revokes session in authService and clears auth cookies', async () => {
      const res = createMockResponse();
      authService.signOut.mockResolvedValue(undefined);

      const result = await controller.signOut(42, res);

      expect(authService.signOut).toHaveBeenCalledWith(42);
      expect(res.clearCookie).toHaveBeenCalledWith('accessToken', {
        path: '/',
      });
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', {
        path: '/api/auth/refresh',
      });
      expect(result).toEqual({ message: 'Signed out successfully' });
    });
  });

  describe('refresh', () => {
    it('refreshes accessToken and updates accessToken cookie when valid refreshToken cookie exists', async () => {
      const req = {
        cookies: { refreshToken: 'valid-refresh-token' },
      } as unknown as Request;
      const res = createMockResponse();
      authService.refreshToken.mockResolvedValue('new-access-token');

      const result = await controller.refresh(req, res);

      expect(authService.refreshToken).toHaveBeenCalledWith(
        'valid-refresh-token',
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'accessToken',
        'new-access-token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
      expect(result).toEqual({ message: 'Token refreshed successfully' });
    });

    it('throws UnauthorizedException when refreshToken cookie is missing', async () => {
      const req = { cookies: {} } as unknown as Request;
      const res = createMockResponse();

      await expect(controller.refresh(req, res)).rejects.toThrow(
        new UnauthorizedException('Refresh token missing'),
      );
      expect(authService.refreshToken).not.toHaveBeenCalled();
    });

    it('propagates error when authService.refreshToken throws (e.g. token expired)', async () => {
      const req = {
        cookies: { refreshToken: 'expired-token' },
      } as unknown as Request;
      const res = createMockResponse();
      authService.refreshToken.mockRejectedValue(
        new UnauthorizedException('expired access token or invalid'),
      );

      await expect(controller.refresh(req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('twoFactorEnable', () => {
    it('delegates to authService.twoFactorAuthEnable with userId and password', async () => {
      const qrResponse = {
        qrCode: 'data:image/png;base64,mockqr',
        key: 'MOCKSECRETKEY',
      };
      authService.twoFactorAuthEnable.mockResolvedValue(qrResponse);

      const result = await controller.twoFactorEnable(1, {
        password: 'Password123!',
      });

      expect(authService.twoFactorAuthEnable).toHaveBeenCalledWith(
        1,
        'Password123!',
      );
      expect(result).toEqual(qrResponse);
    });

    it('propagates error if password is wrong or 2FA is already enabled', async () => {
      authService.twoFactorAuthEnable.mockRejectedValue(
        new UnauthorizedException('invalid password'),
      );

      await expect(
        controller.twoFactorEnable(1, { password: 'WrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('accessTwoFactor', () => {
    it('validates 2FA code, sets auth cookies, and returns success message', async () => {
      const res = createMockResponse();
      const mockTokens = {
        accessToken: '2fa-access-token',
        refreshToken: '2fa-refresh-token',
      };
      authService.twoFactorSignin.mockResolvedValue(mockTokens);

      const result = await controller.accessTwoFactor(res, {
        tempToken: 'valid-temp-token',
        code: '123456',
      });

      expect(authService.twoFactorSignin).toHaveBeenCalledWith({
        tempToken: 'valid-temp-token',
        code: '123456',
      });
      expect(res.cookie).toHaveBeenCalledWith(
        'accessToken',
        '2fa-access-token',
        expect.objectContaining({ path: '/' }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        '2fa-refresh-token',
        expect.objectContaining({ path: '/api/auth/refresh' }),
      );
      expect(result).toEqual({
        message: 'Authentication append with success',
      });
    });

    it('propagates error if 2FA code or temporary token is invalid', async () => {
      const res = createMockResponse();
      authService.twoFactorSignin.mockRejectedValue(
        new UnauthorizedException('invalid access code'),
      );

      await expect(
        controller.accessTwoFactor(res, {
          tempToken: 'invalid-temp-token',
          code: '000000',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verify', () => {
    it('delegates TOTP code verification to authService and returns activation response', async () => {
      const mockResult = {
        message: 'Two-factor authentication enabled successfully',
      };
      authService.verify.mockResolvedValue(mockResult);

      const result = await controller.verify(1, { code: '123456' });

      expect(authService.verify).toHaveBeenCalledWith(1, '123456');
      expect(result).toEqual(mockResult);
    });

    it('propagates error if verification fails', async () => {
      authService.verify.mockRejectedValue(
        new UnauthorizedException('invalid access code'),
      );

      await expect(controller.verify(1, { code: '000000' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('twoFactorDisable', () => {
    it('delegates 2FA disable to authService and returns success message', async () => {
      const mockResult = {
        message: 'Two-factor authentication disabled successfully',
      };
      authService.twoFactorAuthDisable.mockResolvedValue(mockResult);

      const result = await controller.twoFactorDisable(1, {
        password: 'Password123!',
      });

      expect(authService.twoFactorAuthDisable).toHaveBeenCalledWith(
        1,
        'Password123!',
      );
      expect(result).toEqual(mockResult);
    });

    it('propagates error when password is invalid or 2FA already disabled', async () => {
      authService.twoFactorAuthDisable.mockRejectedValue(
        new UnauthorizedException('invalid password'),
      );

      await expect(
        controller.twoFactorDisable(1, { password: 'WrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
