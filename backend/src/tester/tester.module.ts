import { Module } from '@nestjs/common';
import { InstructorModule } from '../instructor/instructor.module';
import { TesterService } from './tester.service';

@Module({
  imports: [InstructorModule],
  providers: [TesterService],
  exports: [TesterService],
})
export class TesterModule {}
