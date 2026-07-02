import { Injectable } from '@nestjs/common';

interface StepResult {
  step: string;
  status: 'done' | 'error';
  result?: string;
  error?: string;
}

@Injectable()
export class InstructorService {
  async executeSteps(page: any, instructions: string, params: Record<string, string> = {}): Promise<StepResult[]> {
    const steps = this.parse(instructions, params);
    const results: StepResult[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`[Step ${i + 1}/${steps.length}] ${step.description}`);
      try {
        const result = await this.execute(page, step);
        results.push({ step: step.description, status: 'done', result });
        console.log(`  \u2713 ${result}`);
      } catch (err) {
        const msg = `Failed: ${err.message}`;
        results.push({ step: step.description, status: 'error', error: err.message });
        throw new Error(`Stopped at step ${i + 1}: ${msg}`);
      }
    }

    return results;
  }

  private parse(text: string, params: Record<string, string>) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const steps: any[] = [];

    for (const line of lines) {
      const resolved = line.replace(/\{(\w+)\}/g, (_, k) => params[k] || `{${k}}`);
      let step: any = { description: resolved };

      const patterns: [RegExp, (m: RegExpMatchArray) => any][] = [
        [/^go\s+to\s+(https?:\/\/\S+)/i, (m) => ({ action: 'navigate', url: m[1] })],
        [/^navigate\s+to\s+(https?:\/\/\S+)/i, (m) => ({ action: 'navigate', url: m[1] })],
        [/^click\s+(?:on\s+)?["']?(.+?)["']?$/i, (m) => ({ action: 'click', target: m[1] })],
        [/^type\s+["'](.+?)["']\s+(?:into|in)\s+(?:the\s+)?["']?(.+?)["']?$/i, (m) => ({ action: 'type', text: m[1], target: m[2] })],
        [/^fill\s+["'](.+?)["']\s+(?:into|in)\s+(?:the\s+)?["']?(.+?)["']?$/i, (m) => ({ action: 'type', text: m[1], target: m[2] })],
        [/^(?:select|choose)\s+["'](.+?)["']\s+(?:from|in)\s+(?:the\s+)?["']?(.+?)["']?$/i, (m) => ({ action: 'select', option: m[1], target: m[2] })],
        [/^(?:check|tick)\s+(?:the\s+)?["']?(.+?)["']?$/i, (m) => ({ action: 'check', target: m[1] })],
        [/^(?:uncheck|untick)\s+(?:the\s+)?["']?(.+?)["']?$/i, (m) => ({ action: 'uncheck', target: m[1] })],
        [/^hover\s+(?:over\s+)?["']?(.+?)["']?$/i, (m) => ({ action: 'hover', target: m[1] })],
        [/^scroll\s+(down|up|to\s+.+)/i, (m) => ({ action: 'scroll', direction: m[1] })],
        [/^(?:wait|pause)\s+(?:for\s+)?(\d+)\s*(?:seconds?|s)?$/i, (m) => ({ action: 'wait', ms: parseInt(m[1]) * 1000 })],
        [/^(?:take\s+)?screenshot/i, () => ({ action: 'screenshot' })],
      ];

      for (const [regex, build] of patterns) {
        const m = resolved.match(regex);
        if (m) {
          step = { ...step, ...build(m) };
          break;
        }
      }

      if (!step.action) step.action = 'unknown';
      steps.push(step);
    }

    return steps;
  }

  private async execute(page: any, step: any): Promise<string> {
    switch (step.action) {
      case 'navigate':
        await page.goto(step.url, { waitUntil: 'networkidle', timeout: 30000 });
        return `Navigated to ${step.url}`;

      case 'click':
        return this.executeClick(page, step.target);

      case 'type':
        return this.executeType(page, step.text, step.target);

      case 'select':
        return this.executeSelect(page, step.option, step.target);

      case 'check':
        return this.executeCheck(page, step.target, true);

      case 'uncheck':
        return this.executeCheck(page, step.target, false);

      case 'hover':
        return this.executeHover(page, step.target);

      case 'scroll':
        if (step.direction.startsWith('to ')) {
          await this.executeScrollTo(page, step.direction.slice(3));
        } else {
          const y = step.direction === 'down' ? document.body.scrollHeight : 0;
          await page.evaluate((y: number) => window.scrollTo(0, y), y);
        }
        return `Scrolled ${step.direction}`;

      case 'wait':
        await page.waitForTimeout(step.ms);
        return `Waited ${step.ms}ms`;

      case 'screenshot':
        return 'Screenshot queued';

      default:
        return `Skipped: ${step.description}`;
    }
  }

  private async executeClick(page: any, target: string) {
    const locators = [
      page.getByRole('button', { name: target, exact: false }),
      page.getByRole('link', { name: target, exact: false }),
      page.getByText(target, { exact: false }),
      page.locator(`[data-testid="${target}"]`),
      page.locator(`#${target}`),
    ];
    for (const loc of locators) {
      if ((await loc.count()) > 0) {
        await loc.first().click();
        await page.waitForTimeout(500);
        return `Clicked "${target}"`;
      }
    }
    throw new Error(`Could not find element: "${target}"`);
  }

  private async executeType(page: any, text: string, target: string) {
    const locators = [
      page.getByPlaceholder(target),
      page.getByLabel(target),
      page.getByRole('textbox', { name: target }),
      page.locator(`[name="${target}"]`),
      page.locator(`#${target}`),
    ];
    for (const loc of locators) {
      if ((await loc.count()) > 0) {
        await loc.first().fill(text);
        return `Typed into "${target}"`;
      }
    }
    throw new Error(`Could not find input: "${target}"`);
  }

  private async executeSelect(page: any, option: string, target: string) {
    const locators = [
      page.getByRole('combobox', { name: target }),
      page.getByLabel(target),
      page.locator(`select[name="${target}"]`),
    ];
    for (const loc of locators) {
      if ((await loc.count()) > 0) {
        await loc.first().selectOption(option);
        return `Selected "${option}"`;
      }
    }
    throw new Error(`Could not find select: "${target}"`);
  }

  private async executeCheck(page: any, target: string, checked: boolean) {
    const locators = [
      page.getByRole('checkbox', { name: target }),
      page.getByLabel(target),
      page.locator(`#${target}`),
    ];
    for (const loc of locators) {
      if ((await loc.count()) > 0) {
        if (checked) await loc.first().check();
        else await loc.first().uncheck();
        return `${checked ? 'Checked' : 'Unchecked'} "${target}"`;
      }
    }
    throw new Error(`Could not find checkbox: "${target}"`);
  }

  private async executeHover(page: any, target: string) {
    const locators = [
      page.getByRole('button', { name: target }),
      page.getByRole('link', { name: target }),
      page.getByText(target),
    ];
    for (const loc of locators) {
      if ((await loc.count()) > 0) {
        await loc.first().hover();
        return `Hovered "${target}"`;
      }
    }
    throw new Error(`Could not find element: "${target}"`);
  }

  private async executeScrollTo(page: any, target: string) {
    const locators = [
      page.getByText(target),
      page.getByRole('heading', { name: target }),
      page.locator(`#${target}`),
    ];
    for (const loc of locators) {
      if ((await loc.count()) > 0) {
        await loc.first().scrollIntoViewIfNeeded();
        return true;
      }
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }
}
