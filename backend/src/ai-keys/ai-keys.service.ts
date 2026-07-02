import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiKey } from './ai-key.entity';
import { ModelRegistryService } from '../instructor/model-registry.service';

@Injectable()
export class AiKeysService {
  constructor(
    @InjectRepository(AiKey)
    private readonly repo: Repository<AiKey>,
    private readonly registry: ModelRegistryService,
  ) {}

  async findAll(): Promise<AiKey[]> {
    return this.repo.find({ order: { provider: 'ASC', model: 'ASC' } });
  }

  async findActiveByCapability(supportsImages: boolean): Promise<AiKey[]> {
    return this.repo.find({ where: { isActive: true, supportsImages } });
  }

  async findById(id: number): Promise<AiKey> {
    const key = await this.repo.findOne({ where: { id } });
    if (!key) throw new NotFoundException(`AiKey #${id} not found`);
    return key;
  }

  async create(data: Partial<AiKey>): Promise<AiKey> {
    const key = this.repo.create({
      ...data,
      provider: (data.provider || '').toLowerCase(),
      supportsImages: this.registry.getSupportsImages(data.model || ''),
    });
    return this.repo.save(key);
  }

  async update(id: number, data: Partial<AiKey>): Promise<AiKey> {
    const key = await this.findById(id);
    // Re-detect supportsImages if model changed
    const model = data.model || key.model;
    Object.assign(key, {
      ...data,
      provider: data.provider ? data.provider.toLowerCase() : key.provider,
      supportsImages: this.registry.getSupportsImages(model),
      // Reset error state on manual update
      lastError: null,
      lastQuotaAt: null,
      retryAfter: null,
    });
    return this.repo.save(key);
  }

  async remove(id: number): Promise<void> {
    const key = await this.findById(id);
    await this.repo.remove(key);
  }

  async recordUsage(id: number, error?: string | null, retryAfterSeconds?: number): Promise<void> {
    const key = await this.findById(id);
    key.usageCount += 1;
    key.lastUsedAt = new Date();
    if (error) {
      key.lastError = error;
      if (/429|quota|rate.?limit/i.test(error)) {
        key.lastQuotaAt = new Date();
        key.retryAfter = retryAfterSeconds
          ? new Date(Date.now() + retryAfterSeconds * 1000)
          : new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
    }
    await this.repo.save(key);
  }
}
