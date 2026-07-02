export class CreateAiKeyDto {
  provider: string;
  model: string;
  label: string;
  apiKey: string;
  supportsImages?: boolean;
  isActive?: boolean;
}

export class UpdateAiKeyDto {
  provider?: string;
  model?: string;
  label?: string;
  apiKey?: string;
  supportsImages?: boolean;
  isActive?: boolean;
}
