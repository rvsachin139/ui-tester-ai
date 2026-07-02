import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { TestProfile } from './test-profile.entity';
import { Device } from '../../devices/entities/device.entity';

@Entity('test_profile_combos')
@Unique('uq_profile_device_browser', ['profileId', 'deviceId', 'browserKey'])
export class TestProfileCombo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'profile_id' })
  profileId: number;

  @Column({ name: 'device_id' })
  deviceId: number;

  @Column({ name: 'browser_key', length: 30 })
  browserKey: string;

  @ManyToOne(() => TestProfile, (p) => p.combos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile: TestProfile;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
