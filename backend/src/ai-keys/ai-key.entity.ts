import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ai_keys')
export class AiKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 30 })
  provider: string;

  @Column({ length: 80 })
  model: string;

  @Column({ length: 200 })
  label: string;

  @Column({ name: 'api_key', length: 500 })
  apiKey: string;

  @Column({ name: 'supports_images', default: false })
  supportsImages: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'last_quota_at', type: 'datetime', nullable: true })
  lastQuotaAt: Date | null;

  @Column({ name: 'last_used_at', type: 'datetime', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
