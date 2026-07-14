import { Global, Module } from '@nestjs/common';
import { UsageService } from './usage.service';

/**
 * Módulo global de cost tracking. Se expone `UsageService` para que cualquier
 * servicio que genere costo (Gemini, Email, Storage, etc.) pueda registrar
 * eventos sin importar el módulo explícitamente.
 */
@Global()
@Module({
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
