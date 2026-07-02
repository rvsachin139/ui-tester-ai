import { Module } from '@nestjs/common';
import { InstructorService } from './instructor.service';

@Module({
  providers: [InstructorService],
  exports: [InstructorService],
})
export class InstructorModule {}
