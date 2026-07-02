import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface AiStep {
  action: string;
  target?: string;
  text?: string;
  ms?: number;
  url?: string;
  description?: string;
}

@Injectable()
export class AiInstructorService {
  private geminiApiKey: string;

  constructor(private config: ConfigService) {
    this.geminiApiKey = this.config.get<string>('app.geminiApiKey') || '';
  }

  async parse(instructions: string): Promise<AiStep[] | null> {
    if (!this.geminiApiKey) return null;

    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(this.geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `You convert natural language UI testing instructions into structured steps for Playwright.

Instructions: "${instructions}"

Return a JSON array of steps. Each step must follow this schema:
{ "action": string, "target"?: string, "text"?: string, "ms"?: number, "url"?: string }

Valid actions and their fields:
- "navigate": { url: "https://..." }
- "click": { target: "button text or label" }
- "type": { text: "value to type", target: "field label or placeholder" }
- "select": { option: "option text", target: "select label" }
- "check": { target: "checkbox label" }
- "uncheck": { target: "checkbox label" }
- "hover": { target: "element text" }
- "scroll": { target: "down|up|element text" }
- "wait": { ms: number }
- "screenshot": {}

Rules:
- Infer the correct action from natural language. "click login" → click target "Log In"
- "user: ..." or "email: ..." → type into "Email"
- "pass:" or "password:" → type into "Password"
- Email addresses → type into "Email"
- "try to login" → wait 500ms
- Split compound instructions into separate steps
- If unsure, use description field for the raw text

Return ONLY the JSON array, no other text. If no steps can be derived, return [].`;

      const genResult = await model.generateContent(prompt);
      const responseText = genResult.response.text();
      const match = responseText.match(/\[[\s\S]*\]/);
      if (!match) return [];

      const steps: AiStep[] = JSON.parse(match[0]);
      return steps.filter((s) => s.action && s.action !== 'unknown');
    } catch (err) {
      console.error(`[AiInstructor] Gemini error: ${err.message}`);
      return null;
    }
  }
}
