import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiInstructorService {
  private geminiApiKey: string;

  constructor(private config: ConfigService) {
    this.geminiApiKey = this.config.get<string>('app.geminiApiKey') || '';
  }

  async reformat(instructions: string): Promise<string | null> {
    if (!this.geminiApiKey) return null;

    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(this.geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `Convert these UI testing instructions into simple Playwright commands.

Instructions:
${instructions}

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

- For "click" commands: keep ALL words of the button/link name. Examples:
  "click on Ask AI button" → click "Ask AI"
  "click on Sign In button in header" → click "Sign In"
  "click login link" → click "Log In"
  NEVER drop words from names: "Ask AI" stays "Ask AI", "Sign In" stays "Sign In"

- For login flows:
  "click login and try to login with user: X pass: Y" →
  click "Log In"
  wait 500
  type "X" into "Email"
  type "Y" into "Password"

- Drop validation/review lines about: checking, verifying, ensuring, visibility, viewport, clipping
- Skip sentences like "check if content is visible" or "should not be clipped"
- Keep only concrete actions (click, type, navigate, wait, scroll, hover, screenshot)

Output ONLY the commands, one per line. No explanations. If nothing actionable, output nothing.`;

      const result = await model.generateContent(prompt);
      const output = result.response.text().trim();
      return output || null;
    } catch (err) {
      console.error(`[AiInstructor] Gemini error: ${err.message}`);
      return null;
    }
  }
}
