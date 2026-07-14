import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiToolsService } from './ai-tools.service';
import { AiController } from './ai.controller';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [DashboardModule],
  controllers: [AiController],
  providers: [AiService, AiToolsService],
})
export class AiModule {}
