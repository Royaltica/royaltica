import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExternalDataSyncService } from './external-data-sync.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateFieldMappingDto } from './dto/update-field-mapping.dto';

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB: exports completos de ~200 clientes/facturas caben holgado.

/**
 * Sincronización de datos externos CxC: catálogo de clientes y facturas de
 * venta importados desde el sistema del cliente (Tradespace y similares).
 * Guardado bajo el área CXC (mismo permiso que /receivables): es una vía de
 * entrada de datos para cobranza, no una integración administrativa.
 */
@Controller('external-data-sync')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CXC)
export class ExternalDataSyncController {
  constructor(private readonly service: ExternalDataSyncService) {}

  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.service.status(user);
  }

  @Post('customers')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  syncCustomers(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.service.syncCustomers(user, file);
  }

  @Post('receivables')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  syncReceivables(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.service.syncReceivables(user, file);
  }

  @Get('field-mapping/:entityType')
  getFieldMapping(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entityType') entityType: string,
  ) {
    return this.service.getFieldMapping(user, entityType);
  }

  @Put('field-mapping/:entityType')
  setFieldMapping(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entityType') entityType: string,
    @Body() dto: UpdateFieldMappingDto,
  ) {
    return this.service.setFieldMapping(user, entityType, dto.mapping);
  }
}
