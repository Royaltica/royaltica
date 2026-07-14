import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FactorajeService } from './factoraje.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateFactorajeDto } from './dto/create-factoraje.dto';
import { QueryFactorajeDto } from './dto/query-factoraje.dto';
import { RejectFactorajeDto } from './dto/reject-factoraje.dto';

@Controller('factoraje')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.FACTORAJE)
export class FactorajeController {
  constructor(private readonly factoraje: FactorajeService) {}

  @Post()
  request(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFactorajeDto,
  ) {
    return this.factoraje.request(user, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryFactorajeDto,
  ) {
    return this.factoraje.findAll(user, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.factoraje.findOne(user, id);
  }

  @Post(':id/approve')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.factoraje.approve(user, id);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectFactorajeDto,
  ) {
    return this.factoraje.reject(user, id, dto.reason);
  }

  @Post(':id/disburse')
  disburse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.factoraje.disburse(user, id);
  }
}
