import { AppModule } from '../app.module';
import { CliService } from './cli.service';
import { createSession } from './session-utils';

async function bootstrap() {
  const { NestFactory } = await import('@nestjs/core');
  const app = await NestFactory.createApplicationContext(await AppModule.forRoot());
  const cli = app.get(CliService);

  const args = process.argv.slice(2);
  const urlIdx = args.indexOf('--url');
  const appUrl = urlIdx !== -1 ? args[urlIdx + 1] : null;

  if (!appUrl) {
    console.log('Usage: node dist/cli/runner.js --url <url> [--project <path>]');
    await app.close();
    return;
  }

  const profileIdx = args.indexOf('--profile');
  const profileName = profileIdx !== -1 ? args[profileIdx + 1] : undefined;

  const projectIdx = args.indexOf('--project');
  const projectPath = projectIdx !== -1 ? args[projectIdx + 1] : undefined;

  const session = createSession(appUrl.replace(/https?:\/\//, '').replace(/[\/.]/g, '-').slice(0, 40));

  const result = await cli.runTest({
    appUrl,
    projectPath,
    screenshotDir: session.screenshotDir,
    profile: {
      devices: [
        { deviceId: 'desktop', width: 1440, height: 900, label: 'Desktop' },
      ],
      browsers: [{ browserKey: 'chromium', isDefault: true }],
    },

  });

  console.log(`\nSession: ${session.sessionDir}`);
  if (result.report) {
    console.log(`Score: ${result.report.overallScore}/100`);
    console.log(`Issues: ${result.report.issues.length}`);
  }

  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
