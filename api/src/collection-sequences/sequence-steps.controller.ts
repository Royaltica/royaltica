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
import { CollectionSequencesService } from './collection-sequences.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateSequenceStepDto } from './dto/create-sequence-step.dto';
import { UpdateSequenceStepDto } from './dto/update-sequence-step.dto';

/**
 * CRUD de los pasos de la secuencia de escalamiento de cobranza, anidados
 * bajo una CollectionPolicy. Mismo nivel de acceso que CollectionPolicy
 * (AREAS.CONFIGURACION).
 */
@Controller('collection-policies/:policyId/sequence-steps')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CONFIGURACION)
export class SequenceStepsController {
  constructor(private readonly sequences: CollectionSequencesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body() dto: CreateSequenceStepDto,
  ) {
    return this.sequences.createStep(user, policyId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
  ) {
    return this.sequences.findAllSteps(user, policyId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sequences.findOneStep(user, policyId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSequenceStepDto,
  ) {
    return this.sequences.updateStep(user, policyId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sequences.removeStep(user, policyId, id);
  }
}
