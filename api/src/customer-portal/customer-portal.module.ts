import { Module } from '@nestjs/common';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerPortalController } from './customer-portal.controller';

/**
 * Portal de autoservicio SIN CUENTA para clientes deudores (Tradespace,
 * Canadá): ver facturas pendientes y marcar "ya pagué" con un enlace
 * firmado/expirable, sin login. Distinto de `PortalModule` (ese es el
 * portal AUTENTICADO de proveedores, lado CxP).
 *
 * ActivityLogService y NotificationsService son módulos @Global(): no hace
 * falta importarlos aquí (mismo patrón que CollectionSequencesModule).
 */
@Module({
  controllers: [CustomerPortalController],
  providers: [CustomerPortalService],
  exports: [CustomerPortalService],
})
export class CustomerPortalModule {}
