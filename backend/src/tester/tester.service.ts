import { Injectable } from '@nestjs/common';
import { chromium, firefox, webkit, devices } from 'playwright';
import { join } from 'path';

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
}

@Injectable()
export class TesterService {
  async run(options: TestRunOptions): Promise<{
    screenshots: ScreenshotResult[];
    results: any[];
  }> {
    const results: any[] = [];
    const screenshots: ScreenshotResult[] = [];

    for (const bc of options.browsers) {
      const browserType = BROWSER_MAP[bc.browserKey];
      if (!browserType) {
        continue;
      }

      const browser = await browserType.launch({ headless: true });

      for (const device of options.devices) {
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
                screenshots, options.screenshotDir,
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
                screenshots, options.screenshotDir,
              );
            } finally {
              await page.close().catch(() => {});
              await context.close().catch(() => {});
            }
          }
        } catch (err: any) {
          console.error(`[Tester] Error on ${deviceName}/${bc.browserKey}: ${err.message}`);
          results.push({ device: deviceName, browser: bc.browserKey, status: 'error', error: err.message });
        }
      }

      await browser.close().catch(() => {});
    }

    return { screenshots, results };
  }

  private async captureDeviceStates(
    page: any,
    appUrl: string,
    browserName: string,
    deviceName: string,
    viewportStr: string,
    screenshots: ScreenshotResult[],
    screenshotDir: string,
  ): Promise<void> {
    const isIOS = browserName === 'safari-ios';
    console.log(`[Tester] ${appUrl} (${deviceName}, ${browserName}, ${viewportStr})`);

    await page.goto(appUrl, { waitUntil: isIOS ? 'domcontentloaded' : 'networkidle', timeout: 45000 });
    await page.waitForTimeout(isIOS ? 3000 : 1000);

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
      screenshots.push({
        file: filename,
        path: filepath,
        device: deviceName,
        browser: browserName,
        viewport: viewportStr,
        state: state.name,
      });
      console.log(`  [${state.name}] ${filename}`);
    }
  }
}
