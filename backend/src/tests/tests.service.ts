import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TesterService } from '../tester/tester.service';
import { ReviewerService } from '../reviewer/reviewer.service';
import { FixerService } from '../fixer/fixer.service';
import { ProfilesService } from '../profiles/profiles.service';

const SESSIONS_DIR = join(process.cwd(), '..', 'sessions');

@Injectable()
export class TestsService {
  constructor(
    private readonly tester: TesterService,
    private readonly reviewer: ReviewerService,
    private readonly fixer: FixerService,
    private readonly profiles: ProfilesService,
  ) {}

  async runTest(options: {
    url: string;
    profileId?: number;
    instructions?: string;
    projectPath?: string;
  }): Promise<any> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const sessionDir = join(SESSIONS_DIR, timestamp);
    const screenshotDir = join(sessionDir, 'screenshots');
    const reportDir = join(sessionDir, 'reports');
    mkdirSync(screenshotDir, { recursive: true });
    mkdirSync(reportDir, { recursive: true });

    let devices: any[];
    let browsers: any[];

    if (options.profileId) {
      const profile = await this.profiles.findOne(options.profileId);
      if (!profile) throw new NotFoundException(`Profile #${options.profileId} not found`);
      const combos = await this.profiles.getCombos(options.profileId);
      devices = combos.map((c) => c.device);
      browsers = [...new Set(combos.map((c) => ({ browserKey: c.browserKey })))];
    } else {
      devices = [
        { deviceId: 'desktop-1920', label: 'Desktop 1920', width: 1920, height: 1080 },
        { deviceId: 'tablet-768', label: 'Tablet 768', width: 768, height: 1024 },
        { deviceId: 'mobile-375', label: 'Mobile 375', width: 375, height: 812 },
      ];
      browsers = [
        { browserKey: 'chromium', isDefault: true },
        { browserKey: 'firefox', isDefault: false },
        { browserKey: 'webkit', isDefault: false },
      ];
    }

    const { screenshots } = await this.tester.run({
      appUrl: options.url,
      browsers,
      devices,
      screenshotDir,
    });

    if (screenshots.length === 0) {
      return {
        sessionId: timestamp,
        sessionDir,
        screenshots: [],
        report: null,
        summary: 'No screenshots captured',
        success: false,
      };
    }

    const report = await this.reviewer.run({ appUrl: options.url, screenshots });

    const reportPath = join(reportDir, 'review-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    let fixResult = null;
    if (options.projectPath && existsSync(options.projectPath)) {
      fixResult = await this.fixer.run(report, options.projectPath);
      const fixPath = join(reportDir, 'fix-result.json');
      writeFileSync(fixPath, JSON.stringify(fixResult, null, 2));
    }

    return {
      sessionId: timestamp,
      sessionDir,
      screenshots: screenshots.map((s) => ({
        file: s.file,
        path: s.path,
        device: s.device,
        browser: s.browser,
        viewport: s.viewport,
        state: s.state,
      })),
      report,
      fixResult,
      summary: report.summary,
      success: report.issues.length === 0,
    };
  }

  listSessions(): any[] {
    if (!existsSync(SESSIONS_DIR)) return [];
    const entries = readdirSync(SESSIONS_DIR, { withFileTypes: true });
    const sessions = entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const sessionDir = join(SESSIONS_DIR, e.name);
        const screenshotDir = join(sessionDir, 'screenshots');
        const reportDir = join(sessionDir, 'reports');
        const screenshotCount = existsSync(screenshotDir)
          ? readdirSync(screenshotDir).filter((f) => f.endsWith('.png')).length
          : 0;
        const reportPath = join(reportDir, 'review-report.json');
        let score: number | null = null;
        if (existsSync(reportPath)) {
          try {
            const data = JSON.parse(readFileSync(reportPath, 'utf-8'));
            score = data.overallScore ?? null;
          } catch {}
        }
        return {
          id: e.name,
          createdAt: e.name.replace(/T/, ' ').replace(/-/g, ':').slice(0, 19),
          screenshotCount,
          score,
        };
      })
      .sort((a, b) => b.id.localeCompare(a.id));
    return sessions;
  }

  getSession(id: string): any {
    const sessionDir = join(SESSIONS_DIR, id);
    if (!existsSync(sessionDir)) throw new NotFoundException(`Session #${id} not found`);

    const screenshotDir = join(sessionDir, 'screenshots');
    const reportDir = join(sessionDir, 'reports');

    let screenshots: any[] = [];
    if (existsSync(screenshotDir)) {
      screenshots = readdirSync(screenshotDir)
        .filter((f) => f.endsWith('.png'))
        .map((f) => ({
          file: f,
          path: join(screenshotDir, f),
          device: '',
          browser: '',
          viewport: '',
          state: '',
        }));
    }

    let report: any = null;
    const reportPath = join(reportDir, 'review-report.json');
    if (existsSync(reportPath)) {
      try {
        report = JSON.parse(readFileSync(reportPath, 'utf-8'));
      } catch {}
    }

    let fixResult: any = null;
    const fixPath = join(reportDir, 'fix-result.json');
    if (existsSync(fixPath)) {
      try {
        fixResult = JSON.parse(readFileSync(fixPath, 'utf-8'));
      } catch {}
    }

    return { id, sessionDir, screenshots, report, fixResult };
  }
}
