import { Global, Module } from '@nestjs/common';
import { SatService } from './sat.service';
import { SatController } from './sat.controller';

@Global()
@Module({
  controllers: [SatController],
  providers: [SatService],
  exports: [SatService],
})
export class SatModule {}
