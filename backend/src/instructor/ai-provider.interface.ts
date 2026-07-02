export interface AiProviderResult {
  output: string | null;
  reason: string;
}

export interface ModelInfo {
  provider: string;
  model: string;
  supportsImages: boolean;
  label: string;
  baseUrl?: string;
}
