import { Module } from '@nestjs/common';
import { CollectionSequencesService } from './collection-sequences.service';
import { CollectionSequencesAiDecisionService } from './collection-sequences-ai-decision.service';
import { SequenceStepsController } from './sequence-steps.controller';
import { CollectionSequenceRunsController } from './collection-sequence-runs.controller';
import { DashboardModule } from '../dashboard/dashboard.module';

/**
 * Motor de escalamiento de cobranza multi-paso (Tradespace, Canadá): pasos
 * configurables por CollectionPolicy + ejecuciones por factura, disparado
 * diariamente por JobsService (ver `collectionSequenceEngine`).
 *
 * CollectionSequencesAiDecisionService agrega una capa opcional (opt-in por
 * CollectionPolicy.aiDecisionEnabled) de decisión vía Gemini sobre ese motor;
 * importa DashboardModule porque reusa sus reportes de riesgo/ranking de
 * clientes como contexto para la decisión (misma fuente de verdad que las
 * herramientas de IA del chat en AiToolsService).
 */
@Module({
  imports: [DashboardModule],
  controllers: [SequenceStepsController, CollectionSequenceRunsController],
  providers: [CollectionSequencesService, CollectionSequencesAiDecisionService],
  exports: [CollectionSequencesService, CollectionSequencesAiDecisionService],
})
export class CollectionSequencesModule {}
