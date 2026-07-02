import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiKey } from './ai-key.entity';
import { AiKeysService } from './ai-keys.service';
import { AiKeysController } from './ai-keys.controller';
import { ModelRegistryService } from '../instructor/model-registry.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiKey])],
  controllers: [AiKeysController],
  providers: [AiKeysService, ModelRegistryService],
  exports: [AiKeysService],
})
export class AiKeysModule {}
