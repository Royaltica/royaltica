import { Module } from '@nestjs/common';
import { DiotService } from './diot.service';
import { DiotController } from './diot.controller';
import { StatementsService } from './statements.service';
import { StatementsController } from './statements.controller';

@Module({
  controllers: [DiotController, StatementsController],
  providers: [DiotService, StatementsService],
})
export class FiscalModule {}
