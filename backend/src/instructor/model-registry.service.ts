import { Injectable } from '@nestjs/common';
import { ModelInfo } from './ai-provider.interface';

const MODELS: ModelInfo[] = [
  // Gemini — supports images (uses @google/generative-ai SDK)
  // Only models confirmed available on v1beta API are listed below.
  { provider: 'gemini', model: 'gemini-2.0-flash', supportsImages: true, label: 'Gemini 2.0 Flash' },
  { provider: 'gemini', model: 'gemini-2.0-flash-lite', supportsImages: true, label: 'Gemini 2.0 Flash-Lite' },

  // OpenAI-compatible providers (use HTTP API)
  { provider: 'openai', model: 'gpt-4o', supportsImages: true, label: 'GPT-4o', baseUrl: 'https://api.openai.com/v1' },
  { provider: 'openai', model: 'gpt-4o-mini', supportsImages: true, label: 'GPT-4o Mini', baseUrl: 'https://api.openai.com/v1' },
  { provider: 'openai', model: 'gpt-4.1-nano', supportsImages: false, label: 'GPT-4.1 Nano', baseUrl: 'https://api.openai.com/v1' },

  { provider: 'groq', model: 'llama-3.3-70b-versatile', supportsImages: false, label: 'Llama 3.3 70B', baseUrl: 'https://api.groq.com/openai/v1' },
  { provider: 'groq', model: 'llama-3.1-8b-instant', supportsImages: false, label: 'Llama 3.1 8B', baseUrl: 'https://api.groq.com/openai/v1' },
  { provider: 'groq', model: 'mixtral-8x7b-32768', supportsImages: false, label: 'Mixtral 8x7B', baseUrl: 'https://api.groq.com/openai/v1' },
  { provider: 'groq', model: 'meta-llama/llama-4-scout-17b-16e-instruct', supportsImages: true, label: 'Llama 4 Scout 17B', baseUrl: 'https://api.groq.com/openai/v1' },
  { provider: 'groq', model: 'meta-llama/llama-4-maverick-17b-128e-instruct', supportsImages: true, label: 'Llama 4 Maverick 17B', baseUrl: 'https://api.groq.com/openai/v1' },

  { provider: 'openrouter', model: 'google/gemini-2.0-flash-001', supportsImages: true, label: 'Gemini 2.0 Flash (OpenRouter)', baseUrl: 'https://openrouter.ai/api/v1' },
  { provider: 'openrouter', model: 'openai/gpt-4o', supportsImages: true, label: 'GPT-4o (OpenRouter)', baseUrl: 'https://openrouter.ai/api/v1' },
  { provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct', supportsImages: false, label: 'Llama 3.1 8B (OpenRouter)', baseUrl: 'https://openrouter.ai/api/v1' },

  { provider: 'together', model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', supportsImages: false, label: 'Llama 3.1 8B (Together)', baseUrl: 'https://api.together.xyz/v1' },
  { provider: 'together', model: 'mistralai/Mixtral-8x7B-Instruct-v0.1', supportsImages: false, label: 'Mixtral 8x7B (Together)', baseUrl: 'https://api.together.xyz/v1' },
];

/** Default base URL for providers not in the registry */
const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  together: 'https://api.together.xyz/v1',
  deepseek: 'https://api.deepseek.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
};

@Injectable()
export class ModelRegistryService {
  getAll(): ModelInfo[] {
    return MODELS;
  }

  getByProvider(provider: string): ModelInfo[] {
    return MODELS.filter((m) => m.provider === provider);
  }

  getSupportsImages(model: string): boolean {
    return MODELS.find((m) => m.model === model)?.supportsImages ?? false;
  }

  getProviders(): string[] {
    return [...new Set(MODELS.map((m) => m.provider))];
  }

  getBaseUrl(provider: string): string | null {
    const fromModel = MODELS.find((m) => m.provider === provider)?.baseUrl;
    if (fromModel) return fromModel;
    return DEFAULT_BASE_URLS[provider] ?? null;
  }
}
