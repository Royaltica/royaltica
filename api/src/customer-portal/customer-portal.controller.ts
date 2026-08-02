import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import {
  CustomerPortalService,
  type CustomerPortalDataDto,
} from './customer-portal.service';

/**
 * Portal público de autoservicio para clientes deudores (Tradespace,
 * Canadá): SIN autenticación (@Public), identidad resuelta únicamente por
 * el token opaco de la URL. Nunca acepta organizationId/customerId del
 * cliente. Rate-limit dedicado, más agresivo que el global (100/60s),
 * porque son endpoints anónimos expuestos en internet.
 */
@ApiTags('customer-portal')
@Controller('public/customer-portal')
export class CustomerPortalController {
  constructor(private readonly service: CustomerPortalService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':token')
  @ApiOperation({
    summary: 'Datos del portal del cliente (facturas pendientes + antigüedad).',
  })
  getData(@Param('token') token: string): Promise<CustomerPortalDataDto> {
    return this.service.getPortalData(token);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':token/invoices/:invoiceId/mark-paid')
  @HttpCode(200)
  @ApiOperation({
    summary: 'El cliente marca una factura como "ya pagué" (queda a verificación).',
  })
  markPaid(
    @Param('token') token: string,
    @Param('invoiceId') invoiceId: string,
  ): Promise<{ ok: true; alreadyFlagged: boolean }> {
    return this.service.markInvoicePaid(token, invoiceId);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':token/invoices/:invoiceId/promise-to-pay')
  @HttpCode(200)
  @ApiOperation({
    summary: 'El cliente deja una promesa de pago para una factura pendiente.',
  })
  promiseToPay(
    @Param('token') token: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: { promisedDate?: string; note?: string },
  ): Promise<{ ok: true }> {
    return this.service.promiseToPay(token, invoiceId, body);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':token/invoices/:invoiceId/dispute')
  @HttpCode(200)
  @ApiOperation({
    summary: 'El cliente disputa una factura pendiente.',
  })
  dispute(
    @Param('token') token: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: { reason?: string },
  ): Promise<{ ok: true }> {
    return this.service.disputeInvoice(token, invoiceId, body);
  }
}
