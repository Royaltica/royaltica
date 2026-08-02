import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BankReconciliationService } from './bank-reconciliation.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ImportBankStatementDto } from './dto/import-bank-statement.dto';
import { ConfirmMatchDto } from './dto/confirm-match.dto';

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB: alineado con external-data-sync.

/**
 * Conciliación bancaria (CxC): importa estados de cuenta (CSV, cualquier
 * banco vía mapeo configurable) y expone la revisión humana de los matches
 * propuestos. Guardado bajo el área CXC (mismo permiso que /receivables y
 * /external-data-sync): es cobranza, no una integración administrativa.
 */
@Controller('bank-reconciliation')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CXC)
export class BankReconciliationController {
  constructor(private readonly service: BankReconciliationService) {}

  @Post('imports')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  importStatement(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ImportBankStatementDto,
  ) {
    return this.service.importStatement(user, file, dto.bankName);
  }

  @Get('imports')
  listImports(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listImports(user);
  }

  @Get('review-queue')
  reviewQueue(@CurrentUser() user: AuthenticatedUser) {
    return this.service.reviewQueue(user);
  }

  @Get('imports/:id')
  getImport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getImport(user, id);
  }

  @Get('imports/:id/transactions')
  listTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('status') status?: string,
  ) {
    return this.service.listTransactions(user, id, status);
  }

  @Post('transactions/:id/confirm')
  confirmMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmMatchDto,
  ) {
    return this.service.confirmMatch(user, id, dto.invoiceId);
  }

  @Post('transactions/:id/reject')
  rejectMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.rejectMatch(user, id);
  }
}
