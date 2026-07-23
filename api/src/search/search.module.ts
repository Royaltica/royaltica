import { Global, Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

/**
 * Módulo global de búsqueda (Meilisearch). Se expone en toda la app
 * para que suppliers/invoices/customers puedan llamar `indexDocument`
 * en sus hooks de create/update sin tener que importar el módulo.
 */
@Global()
@Module({
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
