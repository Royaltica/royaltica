import { Module } from '@nestjs/common';
import { VirtualNumbersService } from './virtual-numbers.service';
import { VirtualNumbersController } from './virtual-numbers.controller';

@Module({
  controllers: [VirtualNumbersController],
  providers: [VirtualNumbersService],
  exports: [VirtualNumbersService],
})
export class VirtualNumbersModule {}
