import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';

interface ScreenshotInfo {
  file: string;
  path: string;
  device: string;
  browser: string;
  viewport: string;
  state: string;
}

interface Issue {
  title: string;
  severity: 'critical' | 'major' | 'minor';
  category: string;
  device?: string;
  browser?: string;
  description: string;
  suggestion?: string;
}

interface ReviewReport {
  timestamp: number;
  appUrl: string;
  overallScore: number;
  issues: Issue[];
  summary: string;
  screenshots: ScreenshotInfo[];
  details: {
    totalScreenshots: number;
    browsers: string[];
    devices: string[];
    categoryBreakdown: Record<string, number>;
  };
}

@Injectable()
export class ReviewerService {
  private geminiApiKey: string;

  constructor(private readonly config: ConfigService) {
    this.geminiApiKey = config.get<string>('app.geminiApiKey') || '';
  }

  async run(screenshotData: { appUrl: string; screenshots: ScreenshotInfo[] }): Promise<ReviewReport> {
    const hasIOS = screenshotData.screenshots.some((s) => s.browser === 'safari-ios');

    const checklist = [
      'layout-css: Check for layout shifts, broken CSS, overflow issues',
      'responsive: Check responsiveness across breakpoints',
      'typography: Check inconsistent fonts, sizes, spacing',
      'assets: Check broken images, missing icons, loading states',
      'accessibility: Check color contrast, focus states, alt text',
      'cross-browser: Check rendering differences across browsers',
      'interaction: Check hover, click, and form states',
      ...(hasIOS
        ? [
            'ios-safari: Check iOS Safari-specific rendering (-webkit- prefixes, flexbox bugs)',
            'ios-notch: Check safe area insets for notch/home indicator on iPhone',
            'ios-touch: Check touch target sizes meet Apple HIG (min 44x44pt)',
            'ios-viewport: Check viewport meta tag handling on iOS',
          ]
        : []),
    ];

    let issues: Issue[];
    if (this.geminiApiKey && screenshotData.screenshots.length > 0) {
      issues = await this.reviewWithGemini(screenshotData, checklist);
    } else {
      issues = this.ruleBasedReview(screenshotData);
    }

    return this.buildReport(screenshotData, issues);
  }

  private async reviewWithGemini(screenshotData: { appUrl: string; screenshots: ScreenshotInfo[] }, checklist: string[]): Promise<Issue[]> {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(this.geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const firstScreenshots = screenshotData.screenshots.slice(0, 5);
      const imageParts: any[] = [];

      for (const s of firstScreenshots) {
        try {
          const data = readFileSync(s.path);
          imageParts.push({
            inlineData: { data: data.toString('base64'), mimeType: 'image/png' },
          });
        } catch {
          // skip unreadable images
        }
      }

      const prompt = `You are a senior UX reviewer. Review these screenshots for UI/UX issues.
Checklist:
${checklist.map((c) => `- ${c}`).join('\n')}

For each issue found, provide: title, severity (critical/major/minor), category, device/browser, description, and fix suggestion.

Respond with ONLY a JSON array of issues:
[
  {
    "title": "...",
    "severity": "critical|major|minor",
    "category": "...",
    "device": "...",
    "browser": "...",
    "description": "...",
    "suggestion": "..."
  }
]
If no issues found, return [].`;

      const result = await model.generateContent([prompt, ...imageParts]);
      const text = result.response.text();
      const match = text.match(/\[[\s\S]*\]/);
      return match ? JSON.parse(match[0]) : [];
    } catch (err) {
      console.error(`[Reviewer] Gemini error: ${err.message}`);
      return this.ruleBasedReview(screenshotData);
    }
  }

  private ruleBasedReview(screenshotData: { appUrl: string; screenshots: ScreenshotInfo[] }): Issue[] {
    const issues: Issue[] = [];
    const groups: Record<string, ScreenshotInfo[]> = {};

    for (const s of screenshotData.screenshots) {
      const key = `${s.device}-${s.browser}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }

    for (const [, group] of Object.entries(groups)) {
      const initial = group.filter((s) => s.state === 'initial');
      if (initial.length > 1) {
        const sizes = new Set(initial.map((s) => s.viewport));
        if (sizes.size > 1) {
          issues.push({
            title: 'Consistency check needed',
            severity: 'minor',
            category: 'responsive',
            device: initial[0].device,
            browser: initial[0].browser,
            description: `Multiple viewport sizes captured: ${[...sizes].join(', ')}`,
            suggestion: 'Manual review recommended for responsive breakpoint behavior',
          });
        }
      }
    }

    return issues;
  }

  private buildReport(screenshotData: { appUrl: string; screenshots: ScreenshotInfo[] }, issues: Issue[]): ReviewReport {
    const weights: Record<string, number> = { critical: 30, major: 15, minor: 5 };
    let deduction = 0;
    for (const issue of issues) deduction += weights[issue.severity] || 5;
    const score = Math.max(0, 100 - deduction);

    const breakdown: Record<string, number> = {};
    for (const issue of issues) {
      breakdown[issue.category] = (breakdown[issue.category] || 0) + 1;
    }

    const summary =
      issues.length === 0
        ? 'No issues found. The UI appears clean.'
        : `Found ${issues.length} issue(s): ` +
          Object.entries(breakdown)
            .map(([cat, n]) => `${n} ${cat}`)
            .join(', ') +
          '.';

    return {
      timestamp: Date.now(),
      appUrl: screenshotData.appUrl,
      overallScore: score,
      issues,
      summary,
      screenshots: screenshotData.screenshots,
      details: {
        totalScreenshots: screenshotData.screenshots.length,
        browsers: [...new Set(screenshotData.screenshots.map((s) => s.browser))],
        devices: [...new Set(screenshotData.screenshots.map((s) => s.device))],
        categoryBreakdown: breakdown,
      },
    };
  }
}
