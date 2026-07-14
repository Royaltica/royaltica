import { Module } from '@nestjs/common';
import { FactorajeService } from './factoraje.service';
import { FactorajeController } from './factoraje.controller';
import { FactorajeProviderService } from './factoraje-provider.service';

@Module({
  controllers: [FactorajeController],
  providers: [FactorajeService, FactorajeProviderService],
  // Exportado para que el Portal del Proveedor reutilice la misma lógica.
  exports: [FactorajeService],
})
export class FactorajeModule {}
