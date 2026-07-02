import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TesterModule } from '../tester/tester.module';
import { ReviewerModule } from '../reviewer/reviewer.module';
import { FixerModule } from '../fixer/fixer.module';
import { DevicesModule } from '../devices/devices.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';

@Module({
  imports: [
    TypeOrmModule,
    TesterModule,
    ReviewerModule,
    FixerModule,
    DevicesModule,
    ProfilesModule,
  ],
  controllers: [TestsController],
  providers: [TestsService],
})
export class TestsModule {}
