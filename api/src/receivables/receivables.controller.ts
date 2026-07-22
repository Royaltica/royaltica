import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReceivablesService } from './receivables.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { QueryReceivablesDto } from './dto/query-receivables.dto';
import { UpdateReceivableStatusDto } from './dto/update-receivable-status.dto';

@Controller('receivables')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CXC)
export class ReceivablesController {
  constructor(private readonly receivables: ReceivablesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReceivableDto,
  ) {
    return this.receivables.create(user, dto);
  }

  /** Importa facturas de venta desde un ZIP de CFDI exportado del ERP. */
  @Post('bulk')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  bulkImport(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.receivables.bulkImportZip(user, file);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryReceivablesDto,
  ) {
    return this.receivables.findAll(user, query);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="cuentas-por-cobrar.csv"')
  export(@CurrentUser() user: AuthenticatedUser) {
    return this.receivables.exportCsv(user);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.receivables.findOne(user, id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReceivableStatusDto,
  ) {
    return this.receivables.updateStatus(user, id, dto.status, dto.reason);
  }

  @Post(':id/send-reminder')
  sendReminder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.receivables.sendReminder(user, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.receivables.remove(user, id);
  }
}
