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
import { CollectionPolicyService } from './collection-policy.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateCollectionPolicyDto } from './dto/create-collection-policy.dto';
import { UpdateCollectionPolicyDto } from './dto/update-collection-policy.dto';

/**
 * Guard rails de cobranza automatizada: configuración de admin, mismo nivel
 * de acceso que Configuración (AREAS.CONFIGURACION).
 */
@Controller('collection-policies')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CONFIGURACION)
export class CollectionPolicyController {
  constructor(private readonly collectionPolicies: CollectionPolicyService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCollectionPolicyDto,
  ) {
    return this.collectionPolicies.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.collectionPolicies.findAll(user);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collectionPolicies.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCollectionPolicyDto,
  ) {
    return this.collectionPolicies.update(user, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collectionPolicies.remove(user, id);
  }
}
