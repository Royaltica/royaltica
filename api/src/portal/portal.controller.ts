import {
  Body,
  Controller,
  Delete,
  Get,
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
import { PortalService } from './portal.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { QueryInvoicesDto } from '../invoices/dto/query-invoices.dto';
import { QueryPaymentsDto } from '../payments/dto/query-payments.dto';
import { QueryFactorajeDto } from '../factoraje/dto/query-factoraje.dto';
import { CreateFactorajeDto } from '../factoraje/dto/create-factoraje.dto';
import { UpdateProviderProfileDto } from './dto/update-profile.dto';
import { UploadDocumentDto } from '../suppliers/dto/upload-document.dto';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Portal del Proveedor: vista de solo-su-información para usuarios PROVIDER.
 * Todo se acota al supplierId del JWT dentro de PortalService.
 */
@Controller('portal')
@UseGuards(RolesGuard)
@Roles('PROVIDER')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('profile')
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.portal.getProfile(user);
  }

  /** El proveedor actualiza sus datos bancarios (CLABE / banco). */
  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProviderProfileDto,
  ) {
    return this.portal.updateProfile(user, dto);
  }

  // ── Documentos KYC (el proveedor gestiona los SUYOS) ──────

  @Get('documents')
  documents(@CurrentUser() user: AuthenticatedUser) {
    return this.portal.listDocuments(user);
  }

  @Post('documents')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.portal.uploadDocument(user, file, dto);
  }

  @Get('documents/:docId/download')
  downloadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.portal.downloadDocument(user, docId);
  }

  @Delete('documents/:docId')
  deleteDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.portal.deleteDocument(user, docId);
  }

  @Get('invoices')
  invoices(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryInvoicesDto,
  ) {
    return this.portal.getInvoices(user, query);
  }

  @Get('payments')
  payments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryPaymentsDto,
  ) {
    return this.portal.getPayments(user, query);
  }

  @Get('factoraje')
  factoraje(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryFactorajeDto,
  ) {
    return this.portal.getFactoraje(user, query);
  }

  @Post('factoraje')
  requestFactoraje(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFactorajeDto,
  ) {
    return this.portal.requestFactoraje(user, dto);
  }
}
