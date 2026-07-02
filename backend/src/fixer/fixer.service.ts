import { Injectable } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface Issue {
  title: string;
  category: string;
  severity: string;
  description?: string;
  suggestion?: string;
}

@Injectable()
export class FixerService {
  async run(report: { issues: Issue[] }, projectPath: string): Promise<{ fixesApplied: any[]; summary: string }> {
    if (!projectPath || !existsSync(projectPath)) {
      return { fixesApplied: [], summary: 'No project path specified or not found' };
    }

    const results: any[] = [];
    for (const issue of report.issues) {
      try {
        results.push(await this.attemptFix(issue, projectPath));
      } catch (err) {
        results.push({ issue: issue.title, status: 'error', error: err.message });
      }
    }

    const success = results.filter((r) => r.status === 'applied' || r.status === 'skipped').length;
    const failed = results.filter((r) => r.status === 'error').length;

    return {
      fixesApplied: results,
      summary: `Applied ${success} fix(es), ${failed} failed.`,
    };
  }

  private async attemptFix(issue: Issue, projectPath: string): Promise<any> {
    const category = issue.category;

    if (['layout-css', 'responsive', 'typography', 'ios-safari'].includes(category)) {
      return this.fixCSS(issue, projectPath);
    }
    if (category === 'accessibility' || category === 'ios-touch') {
      return this.fixAccessibility(issue, projectPath);
    }
    if (['ios-notch', 'ios-viewport'].includes(category)) {
      return this.fixIOSMeta(issue, projectPath);
    }

    return { issue: issue.title, status: 'skipped', reason: `No handler for category: ${category}` };
  }

  private async fixCSS(issue: Issue, projectPath: string): Promise<any> {
    const files = this.findFiles(projectPath, ['.css', '.scss', '.less']);
    if (files.length === 0) {
      return { issue: issue.title, status: 'skipped', reason: 'No CSS files found' };
    }
    return { issue: issue.title, status: 'skipped', reason: 'CSS fix needs human review' };
  }

  private async fixAccessibility(issue: Issue, projectPath: string): Promise<any> {
    return { issue: issue.title, status: 'skipped', reason: 'Accessibility fix needs human evaluation' };
  }

  private async fixIOSMeta(issue: Issue, projectPath: string): Promise<any> {
    return { issue: issue.title, status: 'skipped', reason: 'iOS meta fix needs human review' };
  }

  private findFiles(dir: string, extensions: string[]): string[] {
    const results: string[] = [];
    if (!existsSync(dir)) return results;

    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.') || ['node_modules', 'dist', 'build', '.git'].includes(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        results.push(...this.findFiles(p, extensions));
      } else if (extensions.some((ext) => e.name.endsWith(ext))) {
        results.push(p);
      }
    }
    return results;
  }
}
