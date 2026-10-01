import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { CustomerScoringService } from './scoring/customer-scoring.service';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, CustomerScoringService],
  exports: [CustomersService, CustomerScoringService],
})
export class CustomersModule {}
