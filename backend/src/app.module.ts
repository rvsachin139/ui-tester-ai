import { Module, DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { DevicesModule } from './devices/devices.module';
import { ProfilesModule } from './profiles/profiles.module';
import { TesterModule } from './tester/tester.module';
import { ReviewerModule } from './reviewer/reviewer.module';
import { FixerModule } from './fixer/fixer.module';
import { InstructorModule } from './instructor/instructor.module';
import { CliModule } from './cli/cli.module';
import { TestsModule } from './tests/tests.module';
import { EventsModule } from './events/events.module';
import { AiKeysModule } from './ai-keys/ai-keys.module';
import configuration, { databaseConfig } from './config/configuration';

@Module({})
export class AppModule {
  static async forRoot(): Promise<DynamicModule> {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration, databaseConfig],
          envFilePath: ['.env.test', '.env'],
        }),
        DatabaseModule,
        DevicesModule,
        ProfilesModule,
        TesterModule,
        ReviewerModule,
        FixerModule,
        InstructorModule,
        CliModule,
        TestsModule,
        EventsModule,
        AiKeysModule,
      ],
    };
  }
}
