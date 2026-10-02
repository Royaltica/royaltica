import { Module } from '@nestjs/common';
import { DiscountSimulatorService } from './discount-simulator.service';
import { DiscountSimulatorController } from './discount-simulator.controller';

@Module({
  controllers: [DiscountSimulatorController],
  providers: [DiscountSimulatorService],
  exports: [DiscountSimulatorService],
})
export class DiscountSimulatorModule {}
