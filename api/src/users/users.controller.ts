import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { MultiUserToggleDto } from './dto/multi-user-toggle.dto';

/**
 * Configuración > Usuarios. Todas las rutas requieren rol administrador.
 * El JwtAuthGuard global ya garantiza autenticación.
 */
@Controller('users')
@UseGuards(RolesGuard)
@Roles('CORPORATE_ADMIN', 'SUPERADMIN')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@CurrentUser() admin: AuthenticatedUser) {
    return this.usersService.list(admin);
  }

  @Get('settings')
  getSettings(@CurrentUser() admin: AuthenticatedUser) {
    return this.usersService.getSettings(admin);
  }

  @Patch('settings/multi-user')
  setMultiUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: MultiUserToggleDto,
  ) {
    return this.usersService.setMultiUser(admin, dto.enabled);
  }

  @Post('invite')
  invite(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: InviteUserDto,
  ) {
    return this.usersService.invite(admin, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(admin, id, dto);
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.setStatus(admin, id, dto.isActive);
  }

  @Delete(':id')
  remove(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.remove(admin, id);
  }
}
