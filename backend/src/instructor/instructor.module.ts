import { Module } from '@nestjs/common';
import { InstructorService } from './instructor.service';
import { AiInstructorService } from './ai-instructor.service';
import { AiExecutorService } from './ai-executor.service';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { ModelRegistryService } from './model-registry.service';
import { AiKeysModule } from '../ai-keys/ai-keys.module';

@Module({
  imports: [AiKeysModule],
  providers: [
    InstructorService,
    AiInstructorService,
    AiExecutorService,
    AiOrchestratorService,
    ModelRegistryService,
  ],
  exports: [InstructorService, AiOrchestratorService],
})
export class InstructorModule {}
