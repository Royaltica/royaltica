import { Module } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PortalController } from './portal.controller';
import { FactorajeModule } from '../factoraje/factoraje.module';
import { SuppliersModule } from '../suppliers/suppliers.module';

@Module({
  imports: [FactorajeModule, SuppliersModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
