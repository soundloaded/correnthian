import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { zodPipe } from '../common/pipes/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { bearerToken } from '../common/bearer.js';
import { loginSchema, registerSchema, type LoginDto, type RegisterDto } from './dto/login.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

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
