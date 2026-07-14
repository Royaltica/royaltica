import { Module } from '@nestjs/common';
import { ErpService } from './erp.service';
import { ErpController } from './erp.controller';
import { ErpConnectorFactory } from './erp-connector.factory';

@Module({
  controllers: [ErpController],
  providers: [ErpService, ErpConnectorFactory],
  exports: [ErpService],
})
export class ErpModule {}
