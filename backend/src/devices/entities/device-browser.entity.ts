import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Device } from './device.entity';

@Entity('device_browsers')
export class DeviceBrowser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'device_id' })
  deviceId: number;

  @Column({ name: 'browser_key', length: 30 })
  browserKey: string;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Device, (d) => d.browsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
