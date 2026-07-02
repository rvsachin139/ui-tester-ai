import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, TestProfile, ReviewReport, Issue } from '../services/api.service';
import { SocketService, TestProgress, TestResult, TestError } from '../services/socket.service';
import { Subscription } from 'rxjs';

interface LogEntry {
  message: string;
  type: 'info' | 'running' | 'success' | 'error';
  timestamp: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="logo">
            <div class="logo-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c8a45c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </div>
            <div>
              <h1 class="app-title">UI Tester AI</h1>
              <span class="app-subtitle">Multi-Agent Testing</span>
            </div>
          </div>
        </div>

        <div class="sidebar-body">
          <div class="field-group">
            <label class="field-label">Target URL</label>
            <input
              type="text"
              class="input-field"
              placeholder="https://example.com"
              [(ngModel)]="url"
              [disabled]="isRunning"
              (ngModelChange)="saveState()"
            />
          </div>

          <div class="field-group">
            <label class="field-label">Test Profile</label>
            @if (profiles.length === 0) {
              <div class="loading-hint">Loading profiles...</div>
            }
            <div class="radio-group">
              <label class="radio-option" [class.active]="selectedProfileId === null">
                <input type="radio" name="profile" [value]="null" [(ngModel)]="selectedProfileId" [disabled]="isRunning" (ngModelChange)="saveState()" />
                <span class="radio-dot"></span>
                <span>Quick Test (default)</span>
              </label>
              @for (p of profiles; track p.id) {
                <label class="radio-option" [class.active]="selectedProfileId === p.id">
                  <input type="radio" name="profile" [value]="p.id" [(ngModel)]="selectedProfileId" [disabled]="isRunning" (ngModelChange)="saveState()" />
                  <span class="radio-dot"></span>
                  <span>{{ p.name }}</span>
                </label>
              }
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Custom Instructions</label>
            <textarea
              class="input-field textarea"
              placeholder="Optional: specify what to check or any special instructions..."
              [(ngModel)]="instructions"
              [disabled]="isRunning"
              (ngModelChange)="saveState()"
              rows="4"
            ></textarea>
          </div>

          <button class="btn-launch" (click)="launchTest()" [disabled]="isRunning || !url.trim()">
            @if (isRunning) {
              <span class="btn-loading">
                <span class="spinner"></span>
                Running...
              </span>
            } @else {
              Launch Test
            }
          </button>

          <button class="btn-reset" (click)="reset()" [disabled]="isRunning">Reset</button>
        </div>
      </aside>

      <main class="main-area">
        <div class="summary-bar">
          <div class="summary-item">
            <span class="summary-label">Score</span>
            <span class="summary-value amber" [class.pulse]="isRunning">{{ score !== null ? score + '/100' : '--' }}</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-item">
            <span class="summary-label">Issues</span>
            <span class="summary-value red">{{ issuesCount }}</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-item">
            <span class="summary-label">Steps</span>
            <span class="summary-value green">{{ stepsCompleted }}</span>
          </div>
        </div>

        <div class="activity-area">
          <h2 class="section-title">Activity Log</h2>
          <div class="log-container" #logContainer>
            @if (logs.length === 0) {
              <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3a3c42" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="9" y1="21" x2="9" y2="9"/>
                </svg>
                <p>Enter a URL and launch a test to see activity here.</p>
              </div>
            }
            @for (log of logs; track log.timestamp) {
              <div class="log-entry" [class]="'log-' + log.type">
                <span class="log-time">{{ log.timestamp }}</span>
                <span class="log-badge" [class]="'badge-' + log.type">{{ getBadgeText(log.type) }}</span>
                <span class="log-msg">{{ log.message }}</span>
              </div>
            }
            <div #scrollAnchor></div>
          </div>
        </div>

        @if (isRunning) {
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
        }
      </main>
    </div>

    <footer class="app-footer">
      <span>&copy; {{ currentYear }} UI Tester AI</span>
      <div class="footer-links">
        <a href="https://github.com/anomalyco/opencode" target="_blank" rel="noopener">GitHub</a>
        <a href="#" target="_blank" rel="noopener">Docs</a>
      </div>
    </footer>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100vh; }
    .app-shell { display: flex; flex: 1; overflow: hidden; }

    .sidebar {
      width: 320px; min-width: 320px;
      background: #121317;
      border-right: 1px solid #1e1f24;
      display: flex; flex-direction: column;
      overflow-y: auto;
    }
    .sidebar-header {
      padding: 20px 20px 16px;
      border-bottom: 1px solid #1e1f24;
    }
    .logo { display: flex; align-items: center; gap: 12px; }
    .logo-icon {
      width: 42px; height: 42px;
      background: #1a1b20;
      border: 1px solid #2a2b30;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
    }
    .app-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 15px; font-weight: 600;
      color: #e8e9ed; margin: 0; letter-spacing: -0.3px;
    }
    .app-subtitle {
      font-size: 11px; color: #6b6d76;
      text-transform: uppercase; letter-spacing: 1.5px;
    }
    .sidebar-body { padding: 16px 20px; flex: 1; }
    .field-group { margin-bottom: 18px; }
    .field-label {
      display: block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px; font-weight: 500;
      color: #6b6d76;
      text-transform: uppercase; letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .loading-hint { font-size: 13px; color: #6b6d76; font-style: italic; padding: 4px 0; }
    .input-field {
      width: 100%; padding: 10px 12px;
      background: #0e0f12; border: 1px solid #2a2b30;
      border-radius: 6px; color: #e8e9ed;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px; outline: none;
      transition: border-color 0.2s;
    }
    .input-field:focus { border-color: #c8a45c; }
    .input-field:disabled { opacity: 0.5; }
    .input-field::placeholder { color: #3a3c42; }
    .textarea { resize: vertical; min-height: 80px; }

    .radio-group { display: flex; flex-direction: column; gap: 6px; }
    .radio-option {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px; border-radius: 6px;
      cursor: pointer; font-size: 13px; color: #9a9ba3;
      transition: all 0.15s;
    }
    .radio-option:hover { background: #1a1b20; color: #e8e9ed; }
    .radio-option.active { background: #1a1b20; color: #e8e9ed; }
    .radio-option input { display: none; }
    .radio-dot {
      width: 16px; height: 16px; min-width: 16px;
      border-radius: 50%; border: 2px solid #3a3c42;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    .radio-option.active .radio-dot {
      border-color: #c8a45c;
    }
    .radio-option.active .radio-dot::after {
      content: ''; display: block; width: 8px; height: 8px;
      border-radius: 50%; background: #c8a45c;
    }

    .btn-launch {
      width: 100%; padding: 12px; margin-top: 4px;
      background: #c8a45c; color: #0e0f12;
      border: none; border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px; font-weight: 600;
      cursor: pointer; transition: all 0.2s;
    }
    .btn-launch:hover:not(:disabled) { background: #dbb96e; }
    .btn-launch:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-loading { display: flex; align-items: center; justify-content: center; gap: 8px; }
    .spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(14,15,18,0.3);
      border-top-color: #0e0f12;
      border-radius: 50%; animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .btn-reset {
      width: 100%; padding: 10px; margin-top: 10px;
      background: transparent; color: #6b6d76;
      border: 1px solid #2a2b30; border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px; cursor: pointer; transition: all 0.2s;
    }
    .btn-reset:hover:not(:disabled) { color: #e8e9ed; border-color: #3a3c42; }
    .btn-reset:disabled { opacity: 0.3; cursor: not-allowed; }

    .main-area {
      flex: 1; display: flex; flex-direction: column;
      overflow: hidden; min-width: 0;
    }

    .summary-bar {
      display: flex; align-items: center; gap: 0;
      padding: 16px 32px;
      background: #121317;
      border-bottom: 1px solid #1e1f24;
    }
    .summary-item {
      display: flex; flex-direction: column; align-items: center;
      flex: 1; gap: 4px;
    }
    .summary-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px; text-transform: uppercase;
      letter-spacing: 1.5px; color: #6b6d76;
    }
    .summary-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 28px; font-weight: 700;
    }
    .summary-value.amber { color: #c8a45c; }
    .summary-value.red { color: #e45a5a; }
    .summary-value.green { color: #4caf7d; }
    .summary-value.pulse { animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .summary-divider {
      width: 1px; height: 40px;
      background: #1e1f24; margin: 0 16px;
    }

    .activity-area {
      flex: 1; display: flex; flex-direction: column;
      padding: 24px 32px 0; overflow: hidden;
    }
    .section-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px; font-weight: 500;
      color: #6b6d76;
      text-transform: uppercase; letter-spacing: 1.5px;
      margin: 0 0 12px;
    }
    .log-container {
      flex: 1; overflow-y: auto;
      display: flex; flex-direction: column; gap: 4px;
      padding-bottom: 12px;
    }
    .log-container::-webkit-scrollbar { width: 4px; }
    .log-container::-webkit-scrollbar-track { background: transparent; }
    .log-container::-webkit-scrollbar-thumb { background: #2a2b30; border-radius: 2px; }

    .empty-state {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      flex: 1; gap: 16px; color: #3a3c42;
      font-size: 14px; text-align: center;
      padding: 60px 20px;
    }

    .log-entry {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px; border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px; line-height: 1.4;
      background: transparent; transition: background 0.15s;
    }
    .log-entry:hover { background: rgba(255,255,255,0.02); }
    .log-time { color: #3a3c42; min-width: 80px; font-size: 11px; }
    .log-badge {
      font-size: 10px; font-weight: 600;
      padding: 2px 6px; border-radius: 3px;
      text-transform: uppercase; letter-spacing: 0.5px;
      min-width: 52px; text-align: center;
    }
    .badge-info { background: rgba(70, 185, 255, 0.12); color: #46b9ff; }
    .badge-running { background: rgba(200, 164, 92, 0.12); color: #c8a45c; }
    .badge-success { background: rgba(76, 175, 125, 0.12); color: #4caf7d; }
    .badge-error { background: rgba(228, 90, 90, 0.12); color: #e45a5a; }
    .log-running .log-badge { animation: pulse 1.2s ease-in-out infinite; }

    .log-msg { color: #e8e9ed; flex: 1; }

    .progress-bar {
      height: 3px; background: #1e1f24; overflow: hidden;
    }
    .progress-fill {
      height: 100%; width: 30%;
      background: linear-gradient(90deg, #c8a45c, #dbb96e, #c8a45c);
      background-size: 200% 100%;
      animation: progressSlide 1.5s ease-in-out infinite;
    }
    @keyframes progressSlide {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(400%); }
    }

    .app-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 32px;
      background: #0a0b0f;
      border-top: 1px solid #1e1f24;
      font-size: 12px; color: #3a3c42;
    }
    .footer-links { display: flex; gap: 16px; }
    .footer-links a {
      color: #3a3c42; text-decoration: none;
      transition: color 0.2s;
    }
    .footer-links a:hover { color: #6b6d76; }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  url = '';
  instructions = '';
  selectedProfileId: number | null = null;
  profiles: TestProfile[] = [];
  logs: LogEntry[] = [];
  score: number | null = null;
  issuesCount = 0;
  stepsCompleted = 0;
  isRunning = false;
  currentYear = new Date().getFullYear();

  private subs: Subscription[] = [];

  constructor(private api: ApiService, private socket: SocketService) {}

  ngOnInit() {
    this.loadSavedState();
    this.loadProfiles();
    this.socket.waitForConnection().then(() => {
      this.addLog('Real-time connection established.', 'info');
    });
    this.addLog('Dashboard initialized. Ready to run tests.', 'info');
  }

  loadSavedState() {
    try {
      const saved = localStorage.getItem('uiTester-dashboard');
      if (saved) {
        const state = JSON.parse(saved);
        this.url = state.url || '';
        this.selectedProfileId = state.selectedProfileId ?? null;
        this.instructions = state.instructions || '';
      }
    } catch {}
  }

  saveState() {
    try {
      localStorage.setItem('uiTester-dashboard', JSON.stringify({
        url: this.url,
        selectedProfileId: this.selectedProfileId,
        instructions: this.instructions,
      }));
    } catch {}
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  loadProfiles() {
    const sub = this.api.getProfiles().subscribe({
      next: (data) => {
        this.profiles = data;
        if (data.length > 0) {
          this.addLog(`Loaded ${data.length} test profile(s) from API.`, 'info');
        }
      },
      error: () => {
        this.addLog('Could not load profiles from API. Using defaults.', 'info');
      }
    });
    this.subs.push(sub);
  }

  async launchTest() {
    if (!this.url.trim() || this.isRunning) return;

    this.saveState();
    this.isRunning = true;
    this.score = null;
    this.issuesCount = 0;
    this.stepsCompleted = 0;
    this.logs = [];

    this.addLog(`Initiating test for ${this.url}...`, 'running');

    const profile = this.selectedProfileId
      ? this.profiles.find(p => p.id === this.selectedProfileId)
      : null;
    if (profile) {
      this.addLog(`Profile selected: ${profile.name}`, 'info');
    }

    const progressSub = this.socket.onProgress().subscribe((data: TestProgress) => {
      if (data.progress != null) this.stepsCompleted = data.progress;
      this.addLog(data.message, 'running');
    });

    const completeSub = this.socket.onComplete().subscribe((data: TestResult) => {
      const result = data.result as any;
      if (result.report) {
        const r: ReviewReport = result.report;
        this.score = r.overallScore;
        this.issuesCount = r.issues.length;
        this.stepsCompleted = r.details.totalScreenshots;

        this.addLog(`Test completed for ${r.appUrl}`, 'success');
        this.addLog(`Score: ${r.overallScore}/100 | Issues: ${r.issues.length} | Screenshots: ${r.details.totalScreenshots}`, 'info');
        this.addLog(`Browsers tested: ${r.details.browsers.join(', ')}`, 'info');
        this.addLog(`Devices tested: ${r.details.devices.join(', ')}`, 'info');

        if (r.issues.length > 0) {
          for (const issue of r.issues) {
            this.addLog(`[${issue.severity.toUpperCase()}] ${issue.title} — ${issue.category}`, 'error');
            this.addLog(`  ${issue.description}`, 'error');
            if (issue.suggestion) {
              this.addLog(`  Fix: ${issue.suggestion}`, 'info');
            }
          }
          this.addLog(`${r.issues.length} issue(s) found.`, 'error');
        } else {
          this.addLog('No issues found. The UI looks clean!', 'success');
        }
        this.addLog(`Summary: ${r.summary}`, 'info');
      } else {
        this.addLog(`Test completed: ${result.summary || 'No report data'}`, 'info');
      }
      this.isRunning = false;
    });

    const errorSub = this.socket.onError().subscribe((data: TestError) => {
      this.addLog(`Error: ${data.error}`, 'error');
      this.isRunning = false;
    });

    this.subs.push(progressSub, completeSub, errorSub);

    const socketId = await this.socket.waitForConnection();

    const sub = this.api.runTest(
      this.url.trim(),
      this.selectedProfileId ?? undefined,
      this.instructions || undefined,
      undefined,
      socketId
    ).subscribe({
      error: (err) => {
        this.addLog(`Failed to start test: ${err.message || 'Unknown error'}`, 'error');
        this.isRunning = false;
      }
    });
    this.subs.push(sub);
  }

  reset() {
    this.url = '';
    this.instructions = '';
    this.selectedProfileId = null;
    this.score = null;
    this.issuesCount = 0;
    this.stepsCompleted = 0;
    this.logs = [];
    this.saveState();
    this.addLog('Dashboard reset.', 'info');
  }

  private addLog(message: string, type: LogEntry['type']) {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour12: false });
    this.logs = [...this.logs, { message, type, timestamp }];
  }

  getBadgeText(type: LogEntry['type']): string {
    switch (type) {
      case 'info': return 'INFO';
      case 'running': return 'RUNNING';
      case 'success': return 'SUCCESS';
      case 'error': return 'ERROR';
    }
  }
}
