import { Module } from '@nestjs/common';
import { ReviewerService } from './reviewer.service';

@Module({
  providers: [ReviewerService],
  exports: [ReviewerService],
})
export class ReviewerModule {}
