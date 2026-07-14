import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StatementsService } from './statements.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { GenerateStatementDto } from './dto/generate-statement.dto';

@Controller('fiscal/statements')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.ESTADOS)
export class StatementsController {
  constructor(private readonly statements: StatementsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.statements.list(user);
  }

  @Post('generate')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateStatementDto,
  ) {
    return this.statements.generate(user, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.statements.findOne(user, id);
  }

  @Get(':id/export')
  exportData(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.statements.exportData(user, id);
  }
}
