import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DiotService } from './diot.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaginationDto } from '../common/dto/pagination.dto';
import { GenerateDiotDto } from './dto/generate-diot.dto';

@Controller('fiscal/diot')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.ESTADOS)
export class DiotController {
  constructor(private readonly diot: DiotService) {}

  @Post()
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateDiotDto,
  ) {
    return this.diot.generate(user, dto.period);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    return this.diot.list(user, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.diot.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.diot.update(user, id);
  }

  @Post(':id/submit')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.diot.submit(user, id);
  }
}
