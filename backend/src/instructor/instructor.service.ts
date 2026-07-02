import { Injectable } from '@nestjs/common';
import { AiInstructorService } from './ai-instructor.service';

interface StepResult {
  step: string;
  status: 'done' | 'error';
  result?: string;
  error?: string;
}

@Injectable()
export class InstructorService {
  constructor(private readonly aiInstructor: AiInstructorService) {}

  async executeSteps(page: any, instructions: string, params: Record<string, string> = {}): Promise<StepResult[]> {
    const steps = await this.parse(instructions, params);
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
        console.log(`  \u2717 ${msg}`);
      }
    }

    return results;
  }

  private async parse(text: string, params: Record<string, string>): Promise<any[]> {
    const aiSteps = await this.aiInstructor.parse(text);
    if (aiSteps && aiSteps.length > 0) {
      console.log(`  [AiInstructor] Generated ${aiSteps.length} step(s):`, JSON.stringify(aiSteps));
      return aiSteps.map((s: any) => ({
        description: s.text ? `${s.action} "${s.text}" into "${s.target}"` : s.target ? `${s.action} "${s.target}"` : s.action,
        ...s,
      }));
    }

    const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const lines: string[] = [];
    for (const line of rawLines) {
      const parts = line.split(/\s+(?:and|then|so\s+that)\s+/i);
      for (const p of parts) {
        const sub = p.trim();
        if (sub) lines.push(sub);
      }
    }

    const steps: any[] = [];

    for (const line of lines) {
      const resolved = line.replace(/\{(\w+)\}/g, (_, k) => params[k] || `{${k}}`);
      let step: any = { description: resolved };

      const patterns: [RegExp, (m: RegExpMatchArray) => any][] = [
        [/^go\s+to\s+(https?:\/\/\S+)/i, (m) => ({ action: 'navigate', url: m[1] })],
        [/^navigate\s+to\s+(https?:\/\/\S+)/i, (m) => ({ action: 'navigate', url: m[1] })],
        [/^(?:click|tap|press)\s+(?:on\s+)?["']?(.+?)["']?$/i, (m) => ({ action: 'click', target: m[1].replace(/\s+(?:button|link|icon)$/i, '').trim() })],
        [/^(?:type|enter)\s+["'](.+?)["']\s+(?:into|in)\s+(?:the\s+)?["']?(.+?)["']?$/i, (m) => ({ action: 'type', text: m[1], target: m[2] })],
        [/^(?:type|enter)\s+(?:the\s+)?["'](.+?)["'](?:\s+(?:into|in)\s+(?:the\s+)?["']?(.+?)["']?)?$/i, (m) => ({ action: 'type', text: m[1], target: m[2] || 'field' })],
        [/^fill\s+["'](.+?)["']\s+(?:into|in)\s+(?:the\s+)?["']?(.+?)["']?$/i, (m) => ({ action: 'type', text: m[1], target: m[2] })],
        [/^input\s+["'](.+?)["']\s+(?:into|in)\s+(?:the\s+)?["']?(.+?)["']?$/i, (m) => ({ action: 'type', text: m[1], target: m[2] })],
        [/^(?:select|choose)\s+["'](.+?)["']\s+(?:from|in)\s+(?:the\s+)?["']?(.+?)["']?$/i, (m) => ({ action: 'select', option: m[1], target: m[2] })],
        [/^(?:check|tick)\s+(?:the\s+)?["']?(.+?)["']?$/i, (m) => ({ action: 'check', target: m[1] })],
        [/^(?:uncheck|untick)\s+(?:the\s+)?["']?(.+?)["']?$/i, (m) => ({ action: 'uncheck', target: m[1] })],
        [/^hover\s+(?:over\s+)?["']?(.+?)["']?$/i, (m) => ({ action: 'hover', target: m[1] })],
        [/^scroll\s+(down|up|to\s+.+)/i, (m) => ({ action: 'scroll', direction: m[1] })],
        [/^(?:wait|pause)\s+(?:for\s+)?(\d+)\s*(?:seconds?|s)?$/i, (m) => ({ action: 'wait', ms: parseInt(m[1]) * 1000 })],
        [/^(?:take\s+)?screenshot/i, () => ({ action: 'screenshot' })],
        [/^try\s+to\s+(?:log\s*in|login|sign\s*in).*/i, () => ({ action: 'wait', ms: 500 })],
        [/^(?:log\s*in|login|sign\s*in)$/i, () => ({ action: 'click', target: 'login' })],
        [/^(?:try\s+to\s+)?register|sign\s*up|create\s+(?:an?\s+)?account/i, () => ({ action: 'click', target: 'sign up' })],
        [/^.+\s+with\s+(?:below\s+)?(creds|credentials|info)$/i, () => ({ action: 'wait', ms: 500 })],
        [/^user[:\s]+(.+)/i, (m) => ({ action: 'type', text: m[1].trim(), target: 'email' })],
        [/^email[:\s]+(.+)/i, (m) => ({ action: 'type', text: m[1].trim(), target: 'email' })],
        [/^pass(?:word)?[:\s]+(.+)/i, (m) => ({ action: 'type', text: m[1].trim(), target: 'password' })],
        [/^(.+@.+\..+)$/i, (m) => ({ action: 'type', text: m[1].trim(), target: 'email' })],
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

  private escapeRegex(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private generateClickTargets(target: string): string[] {
    const targets = [target];
    const stripped = target.replace(/\s+(button|link|icon|menu|tab|item|option)$/i, '').trim();
    if (stripped !== target) targets.push(stripped);

    const lower = target.toLowerCase();
    if (lower === 'login' || lower === 'log in') {
      targets.push('Log In', 'Sign In', 'sign in');
    } else if (lower === 'sign in' || lower === 'signin') {
      targets.push('Sign In', 'Log In', 'login');
    } else if (lower === 'submit') {
      targets.push('Submit', 'submit');
    }

    const words = target.split(/\s+/);
    if (words.length > 1) {
      targets.push(words[0]);
    }

    return [...new Set(targets)];
  }

  private async executeClick(page: any, target: string) {
    const candidates = this.generateClickTargets(target);
    for (const t of candidates) {
      const escaped = this.escapeRegex(t);
      const locators: any[] = [
        page.getByRole('button', { name: new RegExp(escaped, 'i') }),
        page.getByRole('link', { name: new RegExp(escaped, 'i') }),
        page.getByText(new RegExp(escaped, 'i')),
        page.locator(`button:has-text("${t}"), a:has-text("${t}"), [role="button"]:has-text("${t}")`),
        page.locator(`[data-testid="${t}"]`),
        page.locator(`#${t}`),
        page.locator(`[aria-label="${t}"]`),
        page.locator(`[href*="${t.toLowerCase()}"]`),
        page.locator(`[href*="${t.toLowerCase().replace(/\s+/g, '-')}"]`),
        page.locator(`[href*="${t.toLowerCase().replace(/\s+/g, '')}"]`),
      ];
      for (const loc of locators) {
        if ((await loc.count()) > 0) {
          await loc.first().evaluate((el: any) => el.click());
          await page.waitForTimeout(2000);
          await page.waitForLoadState('networkidle').catch(() => {});
          const afterUrl = page.url();
          return `Clicked "${t}" (now at: ${afterUrl})`;
        }
      }

      const found = await page.evaluate((text: string) => {
        const tags = ['button', 'a', 'span', 'div', 'input', 'li', 'label'];
        const lower = text.toLowerCase();
        for (const tag of tags) {
          const els = document.querySelectorAll(tag);
          for (const el of els) {
            if (el.textContent?.toLowerCase().includes(lower) &&
                (el instanceof HTMLElement || el instanceof SVGElement)) {
              (el as HTMLElement).click();
              return { clicked: true, tag: el.tagName, text: el.textContent?.trim().slice(0, 50) };
            }
          }
        }
        return null;
      }, t);
      if (found) {
        await page.waitForTimeout(2000);
        await page.waitForLoadState('networkidle').catch(() => {});
        return `Clicked "${t}" via evaluate (${found.tag}: "${found.text}")`;
      }
    }
    throw new Error(`Could not find clickable element for: "${target}"`);
  }

  private async executeType(page: any, text: string, target: string) {
    const escaped = this.escapeRegex(target);
    const isPassword = /pass/i.test(target);
    const locators: any[] = [
      page.getByPlaceholder(new RegExp(escaped, 'i')),
      page.getByLabel(new RegExp(escaped, 'i')),
      page.getByRole('textbox', { name: new RegExp(escaped, 'i') }),
      ...(isPassword ? [page.locator('input[type="password"]')] : []),
      page.locator(`[name*="${target}"]`),
      page.locator(`[id*="${target}"]`),
      page.locator(`#${target}`),
      page.locator(`[aria-label="${target}"]`),
      page.locator(`input[type="${isPassword ? 'password' : 'text'}"], input:not([type])`),
    ];
    for (const loc of locators) {
      if ((await loc.count()) > 0) {
        await loc.first().fill(text);
        return `Typed "${text}" into "${target}"`;
      }
    }
    throw new Error(`Could not find input for: "${target}"`);
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
