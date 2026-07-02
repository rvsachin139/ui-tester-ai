export interface AiProviderResult {
  output: string | null;
  reason: string;
  retryAfter?: number; // seconds to wait before retrying (parsed from error)
}

export interface ModelInfo {
  provider: string;
  model: string;
  supportsImages: boolean;
  label: string;
  baseUrl?: string;
}
