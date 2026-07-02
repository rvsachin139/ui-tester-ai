import { Injectable } from '@nestjs/common';
import { AiOrchestratorService } from './ai-orchestrator.service';

@Injectable()
export class AiInstructorService {
  constructor(private orchestrator: AiOrchestratorService) {}

  async reformat(instructions: string): Promise<{ output: string | null; reason: string }> {
    const result = await this.orchestrator.reformatForParser(instructions);
    return { output: result.output, reason: result.reason };
  }
}
