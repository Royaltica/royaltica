import { Global, Module } from '@nestjs/common';
import { SpeiService } from './spei.service';
import { SpeiController } from './spei.controller';

@Global()
@Module({
  controllers: [SpeiController],
  providers: [SpeiService],
  exports: [SpeiService],
})
export class SpeiModule {}
