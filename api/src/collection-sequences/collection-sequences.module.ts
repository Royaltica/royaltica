import { Module } from '@nestjs/common';
import { CollectionSequencesService } from './collection-sequences.service';
import { SequenceStepsController } from './sequence-steps.controller';
import { CollectionSequenceRunsController } from './collection-sequence-runs.controller';

/**
 * Motor de escalamiento de cobranza multi-paso (Tradespace, Canadá): pasos
 * configurables por CollectionPolicy + ejecuciones por factura, disparado
 * diariamente por JobsService (ver `collectionSequenceEngine`).
 */
@Module({
  controllers: [SequenceStepsController, CollectionSequenceRunsController],
  providers: [CollectionSequencesService],
  exports: [CollectionSequencesService],
})
export class CollectionSequencesModule {}
