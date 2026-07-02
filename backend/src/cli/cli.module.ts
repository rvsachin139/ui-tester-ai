import { Module } from '@nestjs/common';
import { CliService } from './cli.service';
import { TesterModule } from '../tester/tester.module';
import { ReviewerModule } from '../reviewer/reviewer.module';
import { FixerModule } from '../fixer/fixer.module';

@Module({
  imports: [TesterModule, ReviewerModule, FixerModule],
  providers: [CliService],
  exports: [CliService],
})
export class CliModule {}
