import {
  Controller,
  Delete,
  Post,
  Body,
  Res,
  Get,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignInUserDto } from 'src/users/dto/signin-user.dto';
import { SignUpUserDto } from 'src/users/dto/signup-user.dto';
import { Throttle, days, minutes } from '@nestjs/throttler';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { Response, Request } from 'express';
import { Auth } from 'src/common/decorators/policies.decorator';
import { PickType } from '@nestjs/swagger';
import { createHttpException, errors } from 'src/common/config/error.config';
import { TwoFactorAuth } from 'src/users/dto/twoFactor-user.dto';
import {
  AuthMessageResponseDto,
  TwoFactorChallengeResponseDto,
  SignUpResponseDto,
  TwoFactorEnableResponseDto,
} from './dto/auth-response.dto';
import { ApiErrorResponseDto } from 'src/common/dto/api-error-response.dto';

export class ConfirmPasswordDto extends PickType(SignInUserDto, [
  'password',
] as const) {}
export class TwoFactorCode extends PickType(TwoFactorAuth, ['code'] as const) {}

/* 
Aggiungendo type, comunichiamo a TypeScript che Response serve esclusivamente per il
  controllo dei tipi e di non tentare di emettere metadati a runtime
*/
interface jwts {
  accessToken: string;
  refreshToken: string;
}

interface twofactor {
  tempToken: string;
  twofAuth: true;
}

/**
 * Controller handling authentication, user registration, token refreshing, and two-factor authentication (2FA).
 */
@ApiTags('Auth')
@ApiExtraModels(AuthMessageResponseDto, TwoFactorChallengeResponseDto)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  private setAuthCookie(response: Response, jwts: jwts) {
    response.cookie('accessToken', jwts.accessToken, {
      httpOnly: true,
      secure: true, // li invia solo su connessioni protetta (HTTPS)
      sameSite: 'strict', // non invia i codice se la richiesta non parte dallo stesso sito
      maxAge: minutes(10),
      path: '/', // Valido per tutti i path
    });
    // è normale si vedeno negli header e non siano nascosti però sono protetti da httpOnly che impedisce a script di toccarli o vederli
    response.cookie('refresh_token', jwts.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: days(7),
      path: '/api/auth/refresh', // Il browser lo invia solo a questa API
    });
  }

  /**
   * Authenticate user with email and password credentials.
   * If credentials are valid and 2FA is inactive, sets HttpOnly cookies (accessToken and refresh_token).
   * If 2FA is active, returns a temporary challenge token instead.
   */
  @ApiOperation({
    summary: 'Sign in with email and password',
    description:
      'Validates user credentials. On success, sets HttpOnly `accessToken` (10 min) and `refresh_token` (7 days) cookies. ' +
      'If 2FA is enabled on the account, returns a temporary challenge token (`tempToken`) instead of setting session cookies.',
  })
  @ApiOkResponse({
    description: 'Authentication successful or 2FA challenge triggered',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(AuthMessageResponseDto) },
        { $ref: getSchemaPath(TwoFactorChallengeResponseDto) },
      ],
    },
  })
  @ApiBadRequestResponse({
    description:
      'Invalid input format (empty email, invalid email syntax, or short password)',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials or inactive account',
    type: ApiErrorResponseDto,
  })
  @HttpCode(HttpStatus.OK) // per forzare lo status 200 piustosto che 201 che e' lo status di creazione 201 e il post ritorna 201 di default
  @Post('signin')
  async signIn(
    @Body() signInDto: SignInUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    let result: jwts | twofactor = await this.authService.signIn(
      signInDto.email,
      signInDto.password,
    );

    // controllo se ce la proprietà 'tempToken' dentro result
    if ('tempToken' in result) return result;
    else this.setAuthCookie(response, result);

    return {
      message: 'Authentication append with success',
    };
  }

  /**
   * Register a new user account.
   */
  @ApiOperation({
    summary: 'Register a new user account',
    description:
      'Creates a new user profile with unique username, lowercase email, and password. ' +
      'Enforces strong password rules (uppercase, lowercase, number/symbol, min 9 chars).',
  })
  @ApiCreatedResponse({
    description: 'User successfully registered',
    type: SignUpResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed on registration fields',
    type: ApiErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Username or email is already taken',
    type: ApiErrorResponseDto,
  })
  @Post('signup')
  async signUp(@Body() signUpDto: SignUpUserDto) {
    return this.authService.signUp(signUpDto);
  }

  /**
   * Sign out current user, revoking session and clearing cookies.
   */
  @ApiOperation({
    summary: 'Sign out and revoke session',
    description:
      'Revokes the current JWT session from the database and clears `accessToken` and `refresh_token` cookies.',
  })
  @ApiOkResponse({
    description: 'Successfully signed out; session revoked and cookies cleared',
    type: AuthMessageResponseDto,
  })
  @Auth()
  @Delete('signout')
  async signOut(
    @CurrentUser('session') id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.signOut(id);
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    return { message: 'Signed out successfully' };
  }

  /**
   * Refresh expired access token using the refresh_token cookie.
   */
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Exchanges a valid HttpOnly `refresh_token` cookie for a new 10-minute `accessToken` cookie.',
  })
  @ApiCookieAuth('refresh_token')
  @ApiOkResponse({
    description: 'Token successfully refreshed; new accessToken cookie set',
    type: AuthMessageResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh token missing, invalid, or expired',
    type: ApiErrorResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }
    const newAccessToken = await this.authService.refreshToken(refreshToken);
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: minutes(10),
      path: '/',
    });
    return { message: 'Token refreshed successfully' };
  }

  // ---------------------------------------------------------------------------
  //      TWO FACTOR AUTH
  // ---------------------------------------------------------------------------

  /**
   * Initiate two-factor authentication enablement.
   */
  @ApiOperation({
    summary: 'Enable two-factor authentication (initiate setup)',
    description:
      'Verifies the user account password and generates a new TOTP secret key and QR code data URI.',
  })
  @ApiOkResponse({
    description: 'TOTP secret generated; returns QR code URI and base32 key',
    type: TwoFactorEnableResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Password confirmation failed or is missing',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid password provided',
    type: ApiErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'Two-factor authentication is already enabled for this account',
    type: ApiErrorResponseDto,
  })
  @Auth()
  @Post('twofactor/enable')
  async twoFactorEnable(
    @CurrentUser('id') id: number,
    @Body() userPassword: ConfirmPasswordDto,
  ) {
    return await this.authService.twoFactorAuthEnable(
      id,
      userPassword.password,
    );
  }

  /**
   * Complete two-factor sign-in using challenge temporary token.
   */
  @ApiOperation({
    summary: 'Complete two-factor sign-in',
    description:
      'Validates the 6-digit TOTP code against the temporary token received from `/auth/signin`. On success, issues authentication cookies.',
  })
  @ApiOkResponse({
    description: 'Two-factor sign-in successful; session cookies issued',
    type: AuthMessageResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Code must be exactly 6 digits; tempToken must be a valid JWT',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired 2FA code or temporary token',
    type: ApiErrorResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  @Post('twofactor/access')
  async accessTwoFactor(
    @Res({ passthrough: true }) response: Response,
    @Body() twoFactor: TwoFactorAuth,
  ) {
    let jwts: jwts;

    jwts = await this.authService.twoFactorSignin(twoFactor);
    this.setAuthCookie(response, jwts);
    return { message: 'Authentication append with success' };
  }

  /**
   * Verify TOTP code to finalize two-factor authentication activation.
   */
  @ApiOperation({
    summary: 'Verify and activate 2FA setup',
    description:
      'Submits the initial 6-digit TOTP code generated by the user authenticator app to activate 2FA protection on the account.',
  })
  @ApiOkResponse({
    description: 'Two-factor authentication successfully activated',
    type: AuthMessageResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Code must be exactly 6 numeric digits',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid verification code',
    type: ApiErrorResponseDto,
  })
  @Auth()
  @Post('twofactor/verify')
  async verify(@CurrentUser('id') id: number, @Body() code: TwoFactorCode) {
    return await this.authService.verify(id, code.code);
  }

  /**
   * Disable two-factor authentication on user account.
   */
  @ApiOperation({
    summary: 'Disable two-factor authentication',
    description:
      'Verifies account password and disables 2FA protection, clearing the stored secret.',
  })
  @ApiOkResponse({
    description: 'Two-factor authentication successfully disabled',
    type: AuthMessageResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Password confirmation failed or is missing',
    type: ApiErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid password',
    type: ApiErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Two-factor authentication is already disabled',
    type: ApiErrorResponseDto,
  })
  @Auth()
  @Post('twofactor/disable')
  async twoFactorDisable(
    @CurrentUser('id') id: number,
    @Body() userPassword: ConfirmPasswordDto,
  ) {
    return await this.authService.twoFactorAuthDisable(
      id,
      userPassword.password,
    );
  }
}
