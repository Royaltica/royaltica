import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * Módulo global de correo. Se expone en toda la app para que cualquier
 * flujo (invitaciones, jobs de alertas) pueda enviar correos sin re-importar.
 */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
