import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { DeviceBrowser } from './device-browser.entity';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'set_key', length: 30 })
  setKey: string;

  @Column({ name: 'device_id', length: 80, unique: true })
  deviceId: string;

  @Column({ length: 150 })
  label: string;

  @Column()
  width: number;

  @Column()
  height: number;

  @Column({ length: 30, nullable: true })
  os: string | null;

  @Column({ name: 'playwright_device', length: 200, nullable: true })
  playwrightDevice: string | null;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => DeviceBrowser, (b) => b.device)
  browsers: DeviceBrowser[];
}
