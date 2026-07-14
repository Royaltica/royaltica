import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AREAS } from '../../auth/constants/permissions';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UploadDocumentDto } from '../dto/upload-document.dto';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

@Controller('suppliers/:supplierId/documents')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.PROVEEDORES)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
  ) {
    return this.documents.list(user, supplierId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documents.upload(user, supplierId, file, dto);
  }

  @Get(':docId/download')
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.documents.getDownloadUrl(user, supplierId, docId);
  }

  @Delete(':docId')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.documents.remove(user, supplierId, docId);
  }
}
