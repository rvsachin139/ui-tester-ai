import { Injectable } from '@nestjs/common';
import { AiInstructorService } from './ai-instructor.service';

interface StepResult {
  step: string;
  status: 'done' | 'error' | 'info';
  result?: string;
  error?: string;
  evidence?: string;
}

@Injectable()
export class InstructorService {
  constructor(private readonly aiInstructor: AiInstructorService) {}

  async executeSteps(
    page: any,
    instructions: string,
    _params: Record<string, string> = {},
    onStep?: (r: StepResult) => void,
    screenshotDir?: string,
    onEvidence?: (file: string) => void,
  ): Promise<StepResult[]> {
    const results: StepResult[] = [];
    if (!instructions) return results;

    console.log(`[Instructor] Input: ${instructions}`);

    // Extract page elements so AI can reference real element names
    let pageElements = '';
    try {
      const elements = await this.getPageElements(page);
      pageElements = elements.join('\n');
      console.log(`[Instructor] Page elements (${elements.length}): ${pageElements.slice(0, 500)}`);
    } catch (e: any) {
      console.log(`[Instructor] getPageElements error: ${e.message}`);
    }

    const enhancedInstructions = pageElements
      ? `${instructions}\n\nPage interactive elements (use these exact labels):\n${pageElements}`
      : instructions;

    const { output: reformatted, reason: aiReason } = await this.aiInstructor.reformat(enhancedInstructions);
    let lines: string[] = [];

    if (reformatted) {
      // Extract only lines matching the expected command format
      const cmdRe = /^(click\s+"|type\s+"|navigate\s+"|wait\s+\d|scroll\s|hover\s+"|screenshot)/i;
      lines = reformatted
        .replace(/`/g, '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => cmdRe.test(l))
        .filter((l) => !/"(?:TARGET|VALUE|FIELD|URL|N)"|TARGET|VALUE|FIELD/i.test(l));
      if (onStep) onStep({ step: `Parser: ${aiReason}`, status: 'done', result: `Generated ${lines.length} command(s)` });
    } else {
      console.log(`[Instructor] ${aiReason}, using regex fallback`);
      if (onStep) onStep({ step: `Parser: ${aiReason}`, status: 'info' });
    }

    if (lines.length === 0) {
      lines = this.parseRawInstructions(instructions);
      if (lines.length > 0) {
        console.log(`[Instructor] Regex fallback produced: ${JSON.stringify(lines)}`);
        if (onStep) onStep({ step: `Parser: Regex fallback`, status: 'done', result: `Generated ${lines.length} command(s)` });
      } else {
        if (onStep) onStep({ step: `Parser: Regex fallback`, status: 'error', error: 'Could not parse any commands' });
      }
    }

    if (lines.length === 0) {
      const r: StepResult = { step: instructions, status: 'error', error: 'Could not parse any actionable steps' };
      results.push(r);
      if (onStep) onStep(r);
      return results;
    }

    for (const line of lines) {
      console.log(`[Instructor] Exec: ${line}`);
      const step = this.parseLine(line);
      if (!step) {
        console.log(`[Instructor] Unrecognized: ${line}`);
        const r: StepResult = { step: line, status: 'error', error: 'Unrecognized command format' };
        results.push(r);
        if (onStep) onStep(r);
        continue;
      }
      try {
        const result = await this.execute(page, step);
        const r: StepResult = { step: step.description, status: 'done', result };
        results.push(r);
        console.log(`  \u2713 ${result}`);
        if (onStep) onStep(r);
      } catch (err) {
        const msg = err.message || 'Unknown error';
        const r: StepResult = { step: step.description, status: 'error', error: msg };
        if (screenshotDir) {
          try {
            await page.waitForLoadState('load').catch(() => {});
            await page.waitForTimeout(2000);
            const evidenceBuf = await page.screenshot({ fullPage: true });
            const evidenceFile = `evidence-${Date.now()}.png`;
            const { writeFileSync } = require('fs');
            const { join } = require('path');
            writeFileSync(join(screenshotDir, evidenceFile), evidenceBuf);
            r.evidence = evidenceFile;
            if (onEvidence) onEvidence(evidenceFile);
          } catch {}
        }
        results.push(r);
        console.log(`  \u2717 ${msg}`);
        if (onStep) onStep(r);
        throw new Error(`Stopped at step: ${msg}`);
      }
    }

    return results;
  }

  private parseLine(line: string): any {
    const patterns: [RegExp, (m: RegExpMatchArray) => any][] = [
      [/^click\s+"(.+?)"$/i, (m) => ({ action: 'click', target: m[1] })],
      [/^type\s+"(.+?)"\s+into\s+"(.+?)"$/i, (m) => ({ action: 'type', text: m[1], target: m[2] })],
      [/^navigate\s+"(.+?)"$/i, (m) => ({ action: 'navigate', url: m[1] })],
      [/^wait\s+(\d+)$/i, (m) => ({ action: 'wait', ms: (parseInt(m[1]) || 1) * 1000 })],
      [/^scroll\s+(down|up)$/i, (m) => ({ action: 'scroll', direction: m[1] })],
      [/^scroll\s+to\s+"(.+?)"$/i, (m) => ({ action: 'scroll', direction: 'to ' + m[1] })],
      [/^hover\s+"(.+?)"$/i, (m) => ({ action: 'hover', target: m[1] })],
      [/^screenshot/i, () => ({ action: 'screenshot' })],
    ];
    for (const [regex, build] of patterns) {
      const m = line.match(regex);
      if (m) {
        const step = build(m);
        step.description = line;
        return step;
      }
    }
    return null;
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
      case 'wait':
        await page.waitForTimeout(step.ms);
        return `Waited ${step.ms}ms`;
      case 'scroll':
        if (step.direction.startsWith('to ')) {
          await this.executeScrollTo(page, step.direction.slice(3));
        } else {
          const y = step.direction === 'down' ? document.body.scrollHeight : 0;
          await page.evaluate((y: number) => window.scrollTo(0, y), y);
        }
        return `Scrolled ${step.direction}`;
      case 'hover':
        return this.executeHover(page, step.target);
      case 'screenshot':
        return 'Screenshot taken';
      default:
        return `Skipped: ${step.description}`;
    }
  }

  private async executeClick(page: any, target: string) {
    // Strip HTML tags from target (AI sometimes outputs tag names from user hints)
    target = target.replace(/<[^>]+>/g, '').trim();
    const targets = [target];
    if (target.includes(' ')) targets.push(target.replace(/\s+/g, ''));
    // Login/sign-in variants — try common alternatives
    if (/log\s*in/i.test(target) && !targets.includes('Sign In')) targets.push('Sign In');
    if (/sign\s*in/i.test(target) && !targets.includes('Log In')) targets.push('Log In');
    for (const t of targets) {
      const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flexEscaped = escaped.replace(/\s+/g, '\\s*');
      const isCssSelector = /^[.#[\w-]/.test(t) && /[ >+~]/.test(t);
      const locators: any[] = [
        page.getByRole('button', { name: new RegExp(flexEscaped, 'i') }),
        page.getByRole('link', { name: new RegExp(flexEscaped, 'i') }),
        page.getByRole('menuitem', { name: new RegExp(flexEscaped, 'i') }),
        page.getByText(new RegExp(flexEscaped, 'i')),
        page.locator(`button:has-text("${t}"), a:has-text("${t}"), [role="button"]:has-text("${t}")`),
        page.locator(`[aria-label="${t}"]`),
        page.locator(`[title="${t}"]`),
        page.locator(`[data-testid="${t}"]`),
        page.locator(`[href*="${t.toLowerCase()}"]`),
        page.locator(`text="${t}"`).first(),
        ...(isCssSelector ? [
          page.locator(t),
          page.locator(t.replace(/\s*>\s*/g, ' ')),  // descendant version (pierces shadow DOM)
        ] : []),
      ];
      for (const loc of locators) {
        if (await this.safeCount(loc)) {
          try {
            await loc.first().click({ timeout: 5000 });
          } catch {
            await loc.first().evaluate((el: any) => el.click());
          }
          await page.waitForTimeout(2000);
          await page.waitForLoadState('networkidle').catch(() => {});
          return `Clicked "${t}"`;
        }
      }
    }
    const found = await page.evaluate(({ text, allTargets }: { text: string; allTargets: string[] }) => {
      // Deep query that traverses shadow DOM roots
      const deepQuery = (root: Document | ShadowRoot, selector: string): Element | null => {
        let found = root.querySelector(selector);
        if (found) return found;
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) {
            found = deepQuery(el.shadowRoot, selector);
            if (found) return found;
          }
        }
        return null;
      };

      const deepQueryAll = (root: Document | ShadowRoot): Element[] => {
        const result: Element[] = [];
        result.push(...Array.from(root.querySelectorAll('*')));
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) {
            result.push(...deepQueryAll(el.shadowRoot));
          }
        }
        return result;
      };

      // If target looks like a CSS selector, try it with shadow DOM piercing
      if (/[ >+~]/.test(text) || text.startsWith('.') || text.startsWith('#')) {
        try {
          const descendant = text.replace(/\s*>\s*/g, ' ');
          const el = deepQuery(document, descendant);
          if (el instanceof HTMLElement || el instanceof SVGElement) {
            (el as HTMLElement).scrollIntoView({ block: 'center' });
            (el as HTMLElement).click();
            return { tag: el.tagName, text: el.textContent?.trim().slice(0, 50) || '' };
          }
        } catch {}
      }

      const isClickable = (el: Element) =>
        (el instanceof HTMLElement || el instanceof SVGElement) &&
        (getComputedStyle(el).cursor === 'pointer' ||
         /^(button|a|input|select|textarea|label)$/i.test(el.tagName) ||
         el.getAttribute('role') === 'button' ||
         el.hasAttribute('onclick') ||
         el.getAttribute('tabindex') === '0');

      const allElements = deepQueryAll(document);

      // Search by text content — prefer pointer-cursor elements
      for (const el of allElements) {
        if (el.textContent?.trim().toLowerCase() === text.toLowerCase() && isClickable(el)) {
          (el as HTMLElement).scrollIntoView({ block: 'center' });
          (el as HTMLElement).click();
          return { tag: el.tagName, text: el.textContent.trim().slice(0, 50) };
        }
      }
      for (const el of allElements) {
        if (el.textContent?.toLowerCase().includes(text.toLowerCase()) && isClickable(el)) {
          (el as HTMLElement).scrollIntoView({ block: 'center' });
          (el as HTMLElement).click();
          return { tag: el.tagName, text: el.textContent.trim().slice(0, 50) };
        }
      }
      // Search by alt text (image icons)
      for (const t of allTargets) {
        const img = deepQuery(document, `img[alt*="${t}" i]`);
        if (img && (img instanceof HTMLElement)) {
          img.scrollIntoView({ block: 'center' });
          img.click();
          return { tag: 'img', text: img.getAttribute('alt') || '' };
        }
      }
      // Last resort — any element with matching text
      for (const el of allElements) {
        if (el.textContent?.toLowerCase().includes(text.toLowerCase()) &&
            (el instanceof HTMLElement || el instanceof SVGElement)) {
          (el as HTMLElement).scrollIntoView({ block: 'center' });
          (el as HTMLElement).click();
          return { tag: el.tagName, text: el.textContent.trim().slice(0, 50) };
        }
      }
      return null;
    }, { text: target, allTargets: targets });
    if (found) {
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle').catch(() => {});
      return `Clicked "${target}" via evaluate (${found.tag})`;
    }
    throw new Error(`Could not find clickable element: "${target}"`);
  }

  private async executeType(page: any, text: string, target: string) {
    // Strip CSS selectors and parenthetical hints that AI sometimes includes
    target = target.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').replace(/<[^>]+>/g, '').trim();
    // Build candidate targets — try common field name variants
    const candidates = [target];
    if (/user|email/i.test(target)) {
      candidates.push('email', 'username', 'user');
    }
    if (/pass/i.test(target)) {
      candidates.push('password');
    }
    for (const t of candidates) {
      const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const isPassword = /pass/i.test(t);
      const locators: any[] = [
        page.getByPlaceholder(new RegExp(escaped, 'i')),
        page.getByLabel(new RegExp(escaped, 'i')),
        page.getByRole('textbox', { name: new RegExp(escaped, 'i') }),
        ...(isPassword ? [
          page.locator('input[type="password"]'),
          page.locator('input[type="password"]:visible'),
        ] : []),
        page.locator(`[name*="${t}"]:visible`),
        page.locator(`[id*="${t}"]:visible`),
        page.locator(`[aria-label="${t}"]:visible`),
      ];
      for (const loc of locators) {
        if (await this.safeCount(loc)) {
          await loc.first().fill(text);
          return `Typed "${text}" into "${t}"`;
        }
      }
      // Last resort for password: force-fill any password input
      if (isPassword) {
        const pwField = page.locator('input[type="password"]').first();
        if (await this.safeCount(pwField)) {
          await pwField.fill(text, { force: true });
          return `Typed "${text}" into password field (forced)`;
        }
      }
    }
    throw new Error(`Could not find input: "${target}"`);
  }

  private async executeHover(page: any, target: string) {
    target = target.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').replace(/<[^>]+>/g, '').trim();
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const locators = [
      page.getByRole('button', { name: new RegExp(escaped, 'i') }),
      page.getByRole('link', { name: new RegExp(escaped, 'i') }),
      page.getByText(new RegExp(escaped, 'i')),
      page.locator(`button:has-text("${target}"), a:has-text("${target}")`),
    ];
    for (const loc of locators) {
      if (await this.safeCount(loc)) {
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
      if (await this.safeCount(loc)) {
        await loc.first().scrollIntoViewIfNeeded();
        return true;
      }
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  private parseRawInstructions(text: string): string[] {
    const lines: string[] = [];
    const lower = text.toLowerCase();

    // === Login with credentials (user: X pass: Y) ===
    const loginMatch = lower.match(
      /(?:user|username|email)\s*:\s*(\S+@?\S*)\s+(?:pass|password)\s*:\s*(\S+)/i
    );
    if (loginMatch) {
      const idxUser = lower.indexOf('user');
      const before = idxUser >= 0 ? text.slice(0, idxUser) : '';
      for (const t of this.extractClicks(before)) {
        lines.push(`click "${t}"`);
      }
      // Determine field labels from instructions
      const emailLabel = /username/i.test(lower) ? 'Username' : 'Email';
      const passLabel = /pass/i.test(lower) ? 'Password' : 'Password';
      lines.push(`type "${loginMatch[1]}" into "${emailLabel}"`);
      lines.push(`type "${loginMatch[2]}" into "${passLabel}"`);
      const idxPass = lower.indexOf('pass');
      const after = idxPass >= 4 ? text.slice(idxPass + 4) : text;
      // Check if any login-submit click exists in the after-text
      const afterClicks = this.extractClicks(after);
      const hasSubmit = afterClicks.some((t) => /log\s*in|sign\s*in/i.test(t));
      if (!hasSubmit && /(?:once|after|when)\s+log/i.test(text)) {
        // Instructions imply a submit is needed but none was found — wait briefly then try Log In
        lines.push('wait 1');
        lines.push('click "Log In"');
        lines.push('wait 3');
      }
      for (const t of afterClicks) {
        if (!/(log|sign)\s*(in|on)/i.test(t)) {
          lines.push(`click "${t}"`);
        }
      }
      return lines;
    }

    // === Individual clicks ===
    for (const t of this.extractClicks(text)) {
      lines.push(`click "${t}"`);
    }

    // === Type / fill ===
    const typeRe = /(?:type|enter|fill)\s+["""]?(.+?)["""]\s+(?:into|in)\s+["""]?(.+?)["""]/gi;
    let tm: RegExpExecArray | null;
    while ((tm = typeRe.exec(text)) !== null) {
      lines.push(`type "${tm[1]}" into "${tm[2]}"`);
    }

    // === Navigate ===
    const navM = text.match(/(?:navigate|go)\s+to\s+["""]?(.+?)["""]?[.,!?]?$/im);
    if (navM) lines.push(`navigate "${navM[1]}"`);

    // === Scroll ===
    if (/scroll\s+down/i.test(text)) lines.push('scroll down');
    if (/scroll\s+up/i.test(text)) lines.push('scroll up');

    // === Hover ===
    const hoverRe = /hover\s+(?:over\s+)?["""]?(.+?)["""]?(?:\s+[.,!?]|$)/gi;
    let hm: RegExpExecArray | null;
    while ((hm = hoverRe.exec(text)) !== null) {
      const t = hm[1].trim();
      if (t && t.length > 1) lines.push(`hover "${t}"`);
    }

    return [...new Set(lines)];
  }

  private extractClicks(text: string): string[] {
    const targets: string[] = [];
    // Split on sentence boundaries / list connectors
    const segments = text.split(/(?:\.\s*|;\s*|and\s+|then\s+)/i);
    for (const seg of segments) {
      const s = seg.trim();
      const m = s.match(/click\s+(?:on\s+)?(.+)/i);
      if (!m) continue;
      let raw = m[1].trim();
      // Strip parenthetical details like "(gb-icon name=ai-sparkle)"
      raw = raw.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      // Strip location phrases first ("in header", "on page", etc.)
      raw = raw.replace(/\s+(?:in|on|at)\s+\S+/i, '');
      // Strip trailing element types
      raw = raw.replace(/\s+(?:button|link|icon|tab|item|checkbox|radio|option|toggle|menu)\s*$/i, '');
      // Strip quotes and punctuation
      raw = raw.replace(/^\s*["""]+|["""]+\s*$/g, '').replace(/[.,!?]+$/, '').trim();
      // Normalize common login variants
      if (/^login$/i.test(raw)) raw = 'Log In';
      else if (/^signin$/i.test(raw)) raw = 'Sign In';
      if (raw && raw.length > 1) targets.push(raw);
    }
    return targets;
  }

  private async getPageElements(page: any): Promise<string[]> {
    try {
      const snapshot = await page.accessibility.snapshot();
      if (!snapshot) return [];
      const items: string[] = [];
      const seen = new Set<string>();
      const interactives = new Set(['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio',
        'tab', 'menuitem', 'menuitemcheckbox', 'switch', 'slider', 'searchbox',
        'text', 'generic', 'group', 'heading', 'dialog', 'listitem', 'option']);
      const skip = /skip|menu|toggle|hamburger|navigation|navbar/i;

      const walk = (node: any) => {
        if (!node || items.length >= 50) return;
        const role = (node.role || '').toLowerCase();
        const name = (node.name || '').trim();
        if (interactives.has(role) && name.length > 0 && !skip.test(name)) {
          const key = `${role}:${name.toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            items.push(`${role}=${name}`);
          }
        }
        if (node.children) {
          for (const c of node.children) walk(c);
        }
      };
      walk(snapshot);
      return items;
    } catch {
      return [];
    }
  }

  private async safeCount(loc: any): Promise<boolean> {
    try { return (await loc.count()) > 0; } catch { return false; }
  }
}
