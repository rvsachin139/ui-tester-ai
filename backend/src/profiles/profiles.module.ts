import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { TestProfile } from './entities/test-profile.entity';
import { TestProfileCombo } from './entities/test-profile-combo.entity';
import { Device } from '../devices/entities/device.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TestProfile, TestProfileCombo, Device])],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
