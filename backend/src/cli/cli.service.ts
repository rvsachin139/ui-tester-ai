import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { TesterService } from '../tester/tester.service';
import { ReviewerService } from '../reviewer/reviewer.service';
import { FixerService } from '../fixer/fixer.service';

@Injectable()
export class CliService {
  constructor(
    private readonly tester: TesterService,
    private readonly reviewer: ReviewerService,
    private readonly fixer: FixerService,
    private readonly config: ConfigService,
  ) {}

  async runTest(options: {
    appUrl: string;
    projectPath?: string;
    profile?: { devices: any[]; browsers: any[] };
    screenshotDir: string;
    maxRetries?: number;
  }) {
    const maxRetries = options.maxRetries ?? 3;

    console.log(`Target: ${options.appUrl}`);
    console.log(`Devices: ${options.profile?.devices.map((d) => d.deviceId || d.label).join(', ')}`);
    console.log();

    const tester = this.tester;
    const reviewer = this.reviewer;
    const fixer = this.fixer;

    let allFixed = false;
    let lastReport: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`\n=== Attempt ${attempt}/${maxRetries} ===\n`);

      console.log('Agent 1: Taking screenshots...');
      const { screenshots, results } = await tester.run({
        appUrl: options.appUrl,
        browsers: options.profile?.browsers || [],
        devices: options.profile?.devices || [],
        screenshotDir: options.screenshotDir,
      });

      if (screenshots.length === 0) {
        console.error('No screenshots captured. Aborting.');
        break;
      }

      console.log(`Captured ${screenshots.length} screenshots`);
      console.log('Agent 2: Reviewing screenshots...');
      lastReport = await reviewer.run({ appUrl: options.appUrl, screenshots });

      if (lastReport.issues.length === 0) {
        console.log('No issues found!');
        allFixed = true;
        break;
      }

      console.log(`Found ${lastReport.issues.length} issue(s). Score: ${lastReport.overallScore}/100`);

      if (options.projectPath && existsSync(options.projectPath)) {
        console.log('Agent 3: Applying fixes...');
        const fixResult = await fixer.run(lastReport, options.projectPath);
        console.log(fixResult.summary);
      } else {
        console.log('No project path. Issues need manual fixing.');
        break;
      }
    }

    return {
      success: allFixed,
      report: lastReport,
    };
  }
}
