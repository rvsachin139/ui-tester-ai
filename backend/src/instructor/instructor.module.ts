import { Module } from '@nestjs/common';
import { InstructorService } from './instructor.service';
import { AiInstructorService } from './ai-instructor.service';

@Module({
  providers: [InstructorService, AiInstructorService],
  exports: [InstructorService],
})
export class InstructorModule {}
