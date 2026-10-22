import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { AuthLinksService } from './auth-links.service.js';
import { AuthService } from './auth.service.js';
import { bearerToken } from '../common/bearer.js';
import { loginSchema, registerSchema, type LoginDto, type RegisterDto } from './dto/login.dto.js';
import {
  confirmResetSchema,
  consumeLinkSchema,
  requestLinkSchema,
  type ConfirmResetDto,
  type ConsumeLinkDto,
  type RequestLinkDto,
} from './dto/link.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuthLinksService) private readonly links: AuthLinksService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create an account and open a session' })
  async register(@Body(zodPipe(registerSchema)) dto: RegisterDto, @Req() req: Request) {
    const result = await this.auth.register(dto.email, dto.password);
    return this.present(result, req);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange credentials for a session token' })
  async login(@Body(zodPipe(loginSchema)) dto: LoginDto, @Req() req: Request) {
    const result = await this.auth.login(dto.email, dto.password);
    return this.present(result, req);
  }

  /**
   * Ask for a sign-in link.
   *
   * The answer is the same whether or not the address holds an account:
   * distinguishing them is how a list of addresses becomes a list of targets.
   * The link itself is delivered by email, not in the response.
   */
  @Public()
  @Post('magic-link')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a sign-in link' })
  async requestMagicLink(@Body(zodPipe(requestLinkSchema)) dto: RequestLinkDto) {
    return this.links.requestMagicLink(dto.email);
  }

  /**
   * Exchange a sign-in link for a session. Single-use.
   */
  @Public()
  @Post('magic-link/consume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a sign-in link for a session' })
  async consumeMagicLink(
    @Body(zodPipe(consumeLinkSchema)) dto: ConsumeLinkDto,
    @Req() req: Request,
  ) {
    const result = await this.links.consumeMagicLink(dto.token, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return this.present(result, req);
  }

  /**
   * Ask for a password-reset link. Same enumeration rule as the sign-in
   * link: the answer never says whether the address is known.
   */
  @Public()
  @Post('password-reset')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a password-reset link' })
  async requestPasswordReset(@Body(zodPipe(requestLinkSchema)) dto: RequestLinkDto) {
    return this.links.requestPasswordReset(dto.email);
  }

  /**
   * Set a new password under a reset link. The link is consumed, and every
   * session the old password opened is revoked.
   */
  @Public()
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set a new password with a reset link' })
  async confirmPasswordReset(@Body(zodPipe(confirmResetSchema)) dto: ConfirmResetDto) {
    await this.links.resetPassword(dto.token, dto.password, (plain) =>
      this.auth.hashPassword(plain),
    );
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The currently authenticated account' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return { id: user.id, email: user.email, role: user.role };
  }

  /**
   * Revoke the current session. Public on purpose: the handler is null-
   * tolerant (no token, no revocation, still 204), and a stale token must be
   * able to reach it — otherwise "logout with an expired session" 401s in
   * SessionGuard before revocation runs, and the idempotent 204 this route
   * promises would be a lie for exactly the caller that needs it.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(@Headers('authorization') auth?: string): Promise<void> {
    await this.auth.logout(bearerToken(auth) ?? undefined);
  }

  private present(
    result: Awaited<ReturnType<AuthService['login']>>,
    req: Request,
  ) {
    return {
      user: result.user,
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
    };
  }
}
