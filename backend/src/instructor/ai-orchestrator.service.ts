import { Injectable } from '@nestjs/common';
import { AiProviderResult } from './ai-provider.interface';
import { AiExecutorService } from './ai-executor.service';
import { AiKeysService } from '../ai-keys/ai-keys.service';
import { AiKey } from '../ai-keys/ai-key.entity';

@Injectable()
export class AiOrchestratorService {
  constructor(
    private executor: AiExecutorService,
    private aiKeys: AiKeysService,
  ) {}

  async reformatForParser(instructions: string): Promise<AiProviderResult> {
    const activeKeys = await this.getActiveKeys();
    const groups = this.groupKeys(activeKeys);
    const cooldownKeys: { label: string; remaining: number }[] = [];

    for (const [, keys] of groups) {
      for (const key of keys) {
        const remaining = this.cooldownRemaining(key);
        if (remaining > 0) {
          cooldownKeys.push({ label: `${key.provider}/${key.model} (${key.label})`, remaining });
          continue;
        }

        const result = await this.executor.reformat(key, instructions);
        await this.aiKeys.recordUsage(key.id, result.output ? null : result.reason, result.retryAfter);

        if (result.output) {
          return result;
        }

        const isQuota = /429|quota|rate.?limit|exhausted/i.test(result.reason);
        if (!isQuota) {
          break;
        }
      }
    }

    const reasons = activeKeys.map((k) => k.lastError).filter(Boolean).join('; ');
    const cooldownMsg = cooldownKeys.length
      ? ` (${cooldownKeys.length} key(s) on cooldown: ${cooldownKeys.map(c => `${Math.round(c.remaining / 60 / 60)}h`).join(', ')})`
      : '';
    return {
      output: null,
      reason: reasons
        ? `All providers failed: ${reasons}${cooldownMsg}`
        : `No AI provider returned a result${cooldownMsg}`,
    };
  }

  async reviewScreenshot(
    imageBase64: string,
    mimeType: string,
    instructions: string,
  ): Promise<AiProviderResult> {
    const allKeys = await this.aiKeys.findAll();
    const imageKeys = allKeys.filter((k) => k.isActive && k.supportsImages);

    for (const key of imageKeys) {
      if (this.cooldownRemaining(key) > 0) continue;

      try {
        const result = await this.executor.reviewScreenshot(key, instructions, imageBase64, mimeType);
        await this.aiKeys.recordUsage(key.id, result.output ? null : result.reason, result.retryAfter);
        if (result.output) return result;
      } catch (err: any) {
        await this.aiKeys.recordUsage(key.id, err.message);
      }
    }

    return { output: null, reason: 'No image-capable AI provider returned a result' };
  }

  private cooldownRemaining(key: AiKey): number {
    if (!key.retryAfter) return 0;
    const msLeft = new Date(key.retryAfter).getTime() - Date.now();
    return msLeft > 0 ? msLeft : 0;
  }

  private async getActiveKeys(): Promise<AiKey[]> {
    const all = await this.aiKeys.findAll();
    return all.filter((k) => k.isActive);
  }

  private groupKeys(keys: AiKey[]): Map<string, AiKey[]> {
    const groups = new Map<string, AiKey[]>();
    for (const key of keys) {
      const g = `${key.provider}:${key.model}`;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(key);
    }
    return groups;
  }
}
