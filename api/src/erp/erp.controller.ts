import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ErpService } from './erp.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('erp')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CONFIGURACION)
export class ErpController {
  constructor(private readonly erp: ErpService) {}

  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.erp.status(user);
  }

  @Post('sync/invoices')
  syncInvoices(@CurrentUser() user: AuthenticatedUser) {
    return this.erp.syncInvoices(user);
  }

  @Post('sync/suppliers')
  syncSuppliers(@CurrentUser() user: AuthenticatedUser) {
    return this.erp.syncSuppliers(user);
  }

  @Post('push-payment/:paymentId')
  pushPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.erp.pushPayment(user, paymentId);
  }
}
