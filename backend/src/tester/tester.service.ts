import { Injectable } from '@nestjs/common';
import { chromium, firefox, webkit, devices } from 'playwright';
import { join } from 'path';
import { InstructorService } from '../instructor/instructor.service';

const BROWSER_MAP: Record<string, any> = { chromium, firefox, webkit };

interface DeviceConfig {
  id?: number;
  deviceId?: string;
  label?: string;
  width: number;
  height: number;
  os?: string;
  playwrightDevice?: string;
}

interface BrowserConfig {
  browserKey: string;
  isDefault?: boolean;
}

interface ScreenshotResult {
  file: string;
  path: string;
  device: string;
  browser: string;
  viewport: string;
  state: string;
}

interface TestRunOptions {
  appUrl: string;
  browsers: BrowserConfig[];
  devices: DeviceConfig[];
  screenshotDir: string;
  instructions?: string;
  onScreenshot?: (screenshot: ScreenshotResult) => void;
  onInstruction?: (result: { step: string; status: string; result?: string; error?: string; evidence?: string }) => void;
  shouldAbort?: () => boolean;
}

@Injectable()
export class TesterService {
  constructor(private readonly instructor: InstructorService) {}

  async run(options: TestRunOptions): Promise<{
    screenshots: ScreenshotResult[];
    results: any[];
    instructionResults?: any[];
  }> {
    const results: any[] = [];
    const screenshots: ScreenshotResult[] = [];
    const allInstructionResults: any[] = [];
    let instructionFailed = false;

    for (const bc of options.browsers) {
      if (options.shouldAbort?.() || instructionFailed) break;

      const browserType = BROWSER_MAP[bc.browserKey];
      if (!browserType) {
        continue;
      }

      const browser = await browserType.launch({ headless: true });

      for (const device of options.devices) {
        if (options.shouldAbort?.() || instructionFailed) break;
        const deviceName = device.deviceId || device.label || 'unknown';
        const isPlaywrightDevice = !!device.playwrightDevice;

        try {
          if (isPlaywrightDevice) {
            const descriptor = devices[device.playwrightDevice!];
            if (!descriptor) {
              results.push({ device: deviceName, browser: bc.browserKey, status: 'error', error: `Unknown Playwright device: ${device.playwrightDevice}` });
              continue;
            }

            const context = await browser.newContext({
              ...descriptor,
              ignoreHTTPSErrors: true,
              bypassCSP: true,
            });
            const page = await context.newPage();
            try {
              await this.captureDeviceStates(
                page, options.appUrl, 'safari-ios', deviceName,
                `${descriptor.viewport.width}x${descriptor.viewport.height}`,
                screenshots, options.screenshotDir, options.instructions, options.onScreenshot, options.onInstruction, allInstructionResults,
              );
            } finally {
              await page.close().catch(() => {});
              await context.close().catch(() => {});
            }
          } else {
            const context = await browser.newContext({
              ignoreHTTPSErrors: true,
              bypassCSP: true,
              viewport: { width: device.width, height: device.height },
            });
            const page = await context.newPage();
            try {
              await this.captureDeviceStates(
                page, options.appUrl, bc.browserKey, deviceName,
                `${device.width}x${device.height}`,
                screenshots, options.screenshotDir, options.instructions, options.onScreenshot, options.onInstruction, allInstructionResults,
              );
            } finally {
              await page.close().catch(() => {});
              await context.close().catch(() => {});
            }
          }
        } catch (err: any) {
          if (err.isInstructionError) {
            results.push({ device: deviceName, browser: bc.browserKey, status: 'error', error: `Instruction failed: ${err.message}` });
            instructionFailed = true;
            break;
          }
          console.error(`[Tester] Error on ${deviceName}/${bc.browserKey}: ${err.message}`);
          results.push({ device: deviceName, browser: bc.browserKey, status: 'error', error: err.message });
        }
      }

      await browser.close().catch(() => {});
    }

    return { screenshots, results, instructionResults: allInstructionResults.length > 0 ? allInstructionResults : undefined };
  }

  private async captureDeviceStates(
    page: any,
    appUrl: string,
    browserName: string,
    deviceName: string,
    viewportStr: string,
    screenshots: ScreenshotResult[],
    screenshotDir: string,
    instructions?: string,
    onScreenshot?: (s: ScreenshotResult) => void,
    onInstruction?: (r: { step: string; status: string; result?: string; error?: string; evidence?: string }) => void,
    allInstructionResults?: any[],
  ): Promise<void> {
    console.log(`[Tester] ${appUrl} (${deviceName}, ${browserName}, ${viewportStr})`);

    let pageLoaded = false;
    let navError: string | null = null;
    try {
      await page.goto(appUrl, { waitUntil: 'load', timeout: 30000 });
      pageLoaded = true;
    } catch (e: any) {
      navError = `load event timed out, trying domcontentloaded...`;
      console.log(`  ${navError}`);
      try {
        await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        pageLoaded = true;
      } catch (e2: any) {
        navError = `Page navigation failed: ${e2.message}`;
        console.log(`  ${navError}`);
        // Even if navigation throws, the page might be partially rendered
        pageLoaded = await page.evaluate(() => {
          return !!(document.body && document.body.textContent && document.body.textContent.trim().length > 0);
        }).catch(() => false);
      }
    }
    await page.waitForTimeout(pageLoaded ? 2000 : 500);
    const title = await page.title().catch(() => '');
    const url = page.url();
    console.log(`  Page: "${title}" [${url}] loaded=${pageLoaded}`);
    if (!pageLoaded && navError) {
      throw new Error(navError);
    }

    if (instructions) {
      console.log(`  [instructions] Executing: ${instructions}`);
      try {
        const steps = await this.instructor.executeSteps(page, instructions, {}, onInstruction, screenshotDir, (file) => {
          if (onScreenshot) {
            onScreenshot({ file, path: file, device: 'evidence', browser: 'instruction', viewport: '', state: 'error' });
          }
        });
        if (steps) {
          for (const step of steps) {
            allInstructionResults!.push(step);
          }
        }
      } catch (err: any) {
        console.log(`  [instructions] Stopped at failed step: ${err.message}`);
        allInstructionResults!.push({ step: 'instructions', status: 'error', error: err.message });
        const instrErr = new Error(err.message);
        (instrErr as any).isInstructionError = true;
        throw instrErr;
      }
      console.log(`  [instructions] Done`);
      const afterUrl = page.url();
      console.log(`  After instructions: "${await page.title()}" [${afterUrl}]`);
    }

    const prefix = `ss-${Date.now()}`;
    const states: { name: string; action: () => Promise<void> }[] = [
      { name: 'initial', action: async () => {} },
      {
        name: 'scrolled',
        action: async () => {
          await page.evaluate(() => window.scrollTo(0, Math.min(document.body.scrollHeight * 0.3, 600)));
          await page.waitForTimeout(500);
        },
      },
    ];

    const isMobile =
      deviceName.toLowerCase().includes('ipad') ||
      deviceName.toLowerCase().includes('iphone') ||
      viewportStr.startsWith('430') ||
      viewportStr.startsWith('375') ||
      viewportStr.startsWith('393');

    if (isMobile) {
      states.push({
        name: 'rotated',
        action: async () => {
          const [w, h] = viewportStr.split('x').map(Number);
          await page.setViewportSize({ width: h, height: w });
          await page.waitForTimeout(500);
        },
      });
    }

    states.push({ name: 'fullpage', action: async () => {} });

    for (const state of states) {
      await state.action();
      const filename = `${prefix}-${browserName}-${deviceName.replace(/\s+/g, '-')}-${state.name}.png`;
      const filepath = join(screenshotDir, filename);
      if (state.name === 'fullpage') {
        await page.screenshot({ path: filepath, fullPage: true });
      } else {
        await page.screenshot({ path: filepath });
      }
      const screenshot: ScreenshotResult = {
        file: filename,
        path: filepath,
        device: deviceName,
        browser: browserName,
        viewport: viewportStr,
        state: state.name,
      };
      screenshots.push(screenshot);
      if (onScreenshot) onScreenshot(screenshot);
      console.log(`  [${state.name}] ${filename}`);
    }
  }
}
