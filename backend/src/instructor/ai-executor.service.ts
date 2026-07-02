import { Injectable } from '@nestjs/common';
import { AiProviderResult } from './ai-provider.interface';
import { ModelRegistryService } from './model-registry.service';
import { AiKey } from '../ai-keys/ai-key.entity';

const PARSER_PROMPT = `Convert these UI testing instructions into simple Playwright commands.

Instructions:
{instructions}

Rules:
- Output one command per line
- Each line must be one of these formats:
  click "TARGET"
  type "VALUE" into "FIELD"
  navigate "URL"
  wait N
  scroll down / scroll up / scroll to "TARGET"
  hover "TARGET"
  screenshot

- For "click" commands: keep ALL words of the button/link name
- Drop validation/review lines (checking, verifying, ensuring, visibility)
- Keep only concrete actions

Output ONLY the commands, one per line. No explanations. If nothing actionable, output nothing.`;

@Injectable()
export class AiExecutorService {
  constructor(private registry: ModelRegistryService) {}

  async reformat(key: AiKey, instructions: string): Promise<AiProviderResult> {
    const prompt = PARSER_PROMPT.replace('{instructions}', instructions);

    // Only try the key's configured model. Key rotation across fresh APIs
    // is handled by the orchestrator — don't change models within a single key.
    const result = key.provider === 'gemini'
      ? await this.callGemini(key.apiKey, key.model, prompt)
      : await this.callOpenAI(key, key.model, prompt);

    return result;
  }

  async reviewScreenshot(
    key: AiKey,
    instructions: string,
    imageBase64: string,
    mimeType: string,
  ): Promise<AiProviderResult> {
    const result = key.provider === 'gemini'
      ? await this.callGeminiVision(key.apiKey, key.model, instructions, imageBase64, mimeType)
      : await this.callOpenAIVision(key, key.model, instructions, imageBase64, mimeType);

    return result;
  }

  // ── Gemini ──

  private async callGemini(apiKey: string, model: string, prompt: string): Promise<AiProviderResult> {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const m = genAI.getGenerativeModel({ model });
      const result = await m.generateContent(prompt);
      const output = result.response.text().trim();
      return output
        ? { output, reason: `Gemini ${model}` }
        : { output: null, reason: `Gemini ${model} returned empty` };
    } catch (err: any) {
      return { output: null, reason: `Gemini ${model} error: ${(err?.message || err).slice(0, 300)}` };
    }
  }

  private async callGeminiVision(
    apiKey: string,
    model: string,
    instructions: string,
    imageBase64: string,
    mimeType: string,
  ): Promise<AiProviderResult> {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const m = genAI.getGenerativeModel({ model });
      const result = await m.generateContent([
        { text: instructions },
        { inlineData: { data: imageBase64, mimeType } },
      ]);
      const output = result.response.text().trim();
      return output
        ? { output, reason: `Gemini ${model} (vision)` }
        : { output: null, reason: 'Gemini vision returned empty' };
    } catch (err: any) {
      return { output: null, reason: `Gemini ${model} vision error: ${(err?.message || err).slice(0, 300)}` };
    }
  }

  // ── OpenAI-compatible ──

  private async callOpenAI(key: AiKey, model: string, prompt: string): Promise<AiProviderResult> {
    const baseUrl = this.registry.getBaseUrl(key.provider) || 'https://api.openai.com/v1';
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        return { output: null, reason: `${key.provider} ${model} (${response.status}): ${body.slice(0, 200)}` };
      }

      const data = await response.json() as any;
      const output = data?.choices?.[0]?.message?.content?.trim();
      return output
        ? { output, reason: `${key.provider} ${model}` }
        : { output: null, reason: `${key.provider} ${model} returned empty` };
    } catch (err: any) {
      return { output: null, reason: `${key.provider} error: ${(err?.message || err).slice(0, 300)}` };
    }
  }

  private async callOpenAIVision(
    key: AiKey,
    model: string,
    instructions: string,
    imageBase64: string,
    mimeType: string,
  ): Promise<AiProviderResult> {
    const baseUrl = this.registry.getBaseUrl(key.provider) || 'https://api.openai.com/v1';
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: instructions },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          }],
          temperature: 0.2,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        return { output: null, reason: `${key.provider} ${model} vision (${response.status}): ${body.slice(0, 200)}` };
      }

      const data = await response.json() as any;
      const output = data?.choices?.[0]?.message?.content?.trim();
      return output
        ? { output, reason: `${key.provider} ${model} (vision)` }
        : { output: null, reason: `${key.provider} vision returned empty` };
    } catch (err: any) {
      return { output: null, reason: `${key.provider} vision error: ${(err?.message || err).slice(0, 300)}` };
    }
  }
}
