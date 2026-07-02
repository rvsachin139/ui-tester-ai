import { Module } from '@nestjs/common';
import { TesterService } from './tester.service';

@Module({
  providers: [TesterService],
  exports: [TesterService],
})
export class TesterModule {}
