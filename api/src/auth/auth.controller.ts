import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService, type AuthResult } from './auth.service';
import { VerifyTokenDto } from './dto/verify-token.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { DevLoginDto } from './dto/dev-login.dto';
import { RequestAccessDto } from './dto/request-access.dto';
import { TwoFactorCompleteDto, TwoFactorCodeDto } from './dto/two-factor.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { TwoFactorService, type TwoFactorSetup } from './two-factor.service';

/** Anti fuerza-bruta: los endpoints de login/2FA aceptan pocos intentos por minuto. */
const STRICT = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  /** Intercambia un Firebase ID token por un JWT propio de Royáltica. */
  @Public()
  @Throttle(STRICT)
  @Post('verify-token')
  @HttpCode(HttpStatus.OK)
  verifyToken(@Body() dto: VerifyTokenDto): Promise<AuthResult> {
    return this.authService.verifyToken(dto.idToken);
  }

  /** Login de DESARROLLO (deshabilitado en producción): JWT por email. */
  @Public()
  @Throttle(STRICT)
  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  devLogin(@Body() dto: DevLoginDto): Promise<AuthResult> {
    return this.authService.devLogin(dto);
  }

  /** Solicitud PÚBLICA de acceso: avisa al CEO (SUPERADMIN). No crea cuenta. */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('request-access')
  @HttpCode(HttpStatus.OK)
  requestAccess(@Body() dto: RequestAccessDto): Promise<{ ok: true }> {
    return this.authService.requestAccess(dto);
  }

  /** Renueva la sesión a partir de un JWT propio vigente. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResult> {
    return this.authService.refresh(dto.token);
  }

  /** Perfil del usuario autenticado (incluye rol y áreas). */
  @Get('me')
  me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuthResult['user']> {
    return this.authService.getProfile(user.id);
  }

  // ─── Autenticación de dos factores (TOTP) ─────────────────────────

  /** Genera el secreto TOTP y la URI otpauth:// para la app autenticadora. */
  @Post('2fa/setup')
  twoFactorSetup(@CurrentUser() user: AuthenticatedUser): Promise<TwoFactorSetup> {
    return this.twoFactorService.setup(user.id);
  }

  /** Activa el 2FA verificando el primer código de la app autenticadora. */
  @Throttle(STRICT)
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  twoFactorEnable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<{ enabled: true }> {
    return this.twoFactorService.enable(user.id, dto.code);
  }

  /** Desactiva el 2FA (requiere un código vigente). */
  @Throttle(STRICT)
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  twoFactorDisable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<{ enabled: false }> {
    return this.twoFactorService.disable(user.id, dto.code);
  }

  /** Segundo paso del login: intercambia el token temporal + código TOTP por el JWT completo. */
  @Public()
  @Throttle(STRICT)
  @Post('2fa/complete')
  @HttpCode(HttpStatus.OK)
  twoFactorComplete(@Body() dto: TwoFactorCompleteDto): Promise<AuthResult> {
    return this.twoFactorService.completeLogin(dto.tempToken, dto.code);
  }
}
