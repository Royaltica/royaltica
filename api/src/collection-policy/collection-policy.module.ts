import { Module } from '@nestjs/common';
import { CollectionPolicyService } from './collection-policy.service';
import { CollectionPolicyController } from './collection-policy.controller';

@Module({
  controllers: [CollectionPolicyController],
  providers: [CollectionPolicyService],
  exports: [CollectionPolicyService],
})
export class CollectionPolicyModule {}
