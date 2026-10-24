import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { CustomerScoringService } from './scoring/customer-scoring.service';
import { CustomerRiskService } from './scoring/customer-risk.service';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, CustomerScoringService, CustomerRiskService],
  exports: [CustomersService, CustomerScoringService, CustomerRiskService],
})
export class CustomersModule {}
