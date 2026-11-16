import { Global, Module } from '@nestjs/common';
import { CollectionSafetyService } from './collection-safety.service';

/**
 * Guardias de envío compartidas por todos los caminos que le escriben a un
 * deudor (motor por niveles y recordatorio de un paso). Global para no
 * crear dependencias circulares entre módulos de cobranza.
 */
@Global()
@Module({
  providers: [CollectionSafetyService],
  exports: [CollectionSafetyService],
})
export class CollectionSafetyModule {}
