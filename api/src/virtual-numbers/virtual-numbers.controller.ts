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
import { VirtualNumbersService } from './virtual-numbers.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateVirtualNumberDto } from './dto/create-virtual-number.dto';
import { UpdateVirtualNumberDto } from './dto/update-virtual-number.dto';

/**
 * FR-08 (spec "Mejoras V1"): pool de números virtuales propios por
 * organización. Infraestructura/seguridad → mismo nivel de acceso que
 * Configuración (AREAS.CONFIGURACION), igual que CollectionPolicyController.
 */
@Controller('virtual-numbers')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CONFIGURACION)
export class VirtualNumbersController {
  constructor(private readonly virtualNumbers: VirtualNumbersService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVirtualNumberDto,
  ) {
    return this.virtualNumbers.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.virtualNumbers.findAll(user);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVirtualNumberDto,
  ) {
    return this.virtualNumbers.update(user, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.virtualNumbers.remove(user, id);
  }
}
