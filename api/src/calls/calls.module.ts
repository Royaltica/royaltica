import { Module } from '@nestjs/common';
import { CallGuardrailsService } from './call-guardrails.service';
import { CallsController } from './calls.controller';

@Module({
  controllers: [CallsController],
  providers: [CallGuardrailsService],
  exports: [CallGuardrailsService],
})
export class CallsModule {}
