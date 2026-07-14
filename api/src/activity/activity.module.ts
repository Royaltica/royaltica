import { Global, Module } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { ActivityController } from './activity.controller';

@Global()
@Module({
  controllers: [ActivityController],
  providers: [ActivityLogService],
  exports: [ActivityLogService],
})
export class ActivityModule {}
