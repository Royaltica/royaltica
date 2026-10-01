import { Module } from '@nestjs/common';
import { ReceivablesService } from './receivables.service';
import { ReceivablesController } from './receivables.controller';
import { CustomerPortalModule } from '../customer-portal/customer-portal.module';

// SettingsModule es @Global(): no hace falta importarlo aquí.
@Module({
  imports: [CustomerPortalModule],
  controllers: [ReceivablesController],
  providers: [ReceivablesService],
  exports: [ReceivablesService],
})
export class ReceivablesModule {}
