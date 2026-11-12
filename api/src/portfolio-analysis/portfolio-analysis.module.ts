import { Module } from '@nestjs/common';
import { PortfolioAnalysisService } from './portfolio-analysis.service';
import { PortfolioAnalysisController } from './portfolio-analysis.controller';

/** Análisis periódico de cartera. SettingsService y PrismaService son globales. */
@Module({
  controllers: [PortfolioAnalysisController],
  providers: [PortfolioAnalysisService],
  exports: [PortfolioAnalysisService],
})
export class PortfolioAnalysisModule {}
