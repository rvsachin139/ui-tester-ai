import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService, TestProfile, ReviewReport, Issue, AiKey, ModelInfo } from '../services/api.service';
import { SocketService, TestProgress, TestResult, TestError, ScreenshotData, SessionEvent } from '../services/socket.service';
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
          <button class="btn-settings" (click)="openSettings()">⚙ Settings</button>

          <div class="sessions-section">
            <div class="sessions-header" (click)="showActiveSessions = !showActiveSessions">
              <span class="sessions-title">Active Sessions</span>
              <div class="sessions-meta">
                <span class="sessions-count">{{ activeSessions.length }}</span>
                <span class="chevron">{{ showActiveSessions ? '▼' : '▶' }}</span>
              </div>
            </div>
            @if (showActiveSessions) {
              <div class="sessions-list">
                @for (s of activeSessions; track s.sessionId) {
                  <div class="session-item">
                    <div class="session-body">
                      <span class="session-url" title="{{ s.url }}">{{ s.url }}</span>
                      <span class="session-time">{{ s.startedAt.slice(11, 19) }}</span>
                    </div>
                    <button
                      class="btn-terminate"
                      (click)="terminateSession(s.sessionId)"
                      [disabled]="terminatingId === s.sessionId"
                      title="Terminate session"
                    >{{ terminatingId === s.sessionId ? '...' : '✕' }}</button>
                  </div>
                }
                @if (activeSessions.length === 0) {
                  <div class="sessions-empty">No active sessions</div>
                }
              </div>
            }
          </div>
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
          <div class="section-header">
            <h2 class="section-title">{{ showGallery ? 'Screenshot Gallery' : 'Activity Log' }}</h2>
            <div class="view-toggle">
              <button
                class="toggle-btn"
                [class.active]="!showGallery"
                (click)="showGallery = false"
              >Log</button>
              <button
                class="toggle-btn"
                [class.active]="showGallery"
                (click)="showGallery = true"
                [disabled]="screenshots.length === 0"
              >Gallery ({{ screenshots.length }})</button>
            </div>
          </div>

          @if (!showGallery) {
            <div class="log-container">
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
                <div class="log-entry" [class.log-running]="log.type === 'running' && isLastRunning(log)">
                  <span class="log-time">{{ log.timestamp }}</span>
                  <span class="log-badge" [class]="'badge-' + log.type">{{ getBadgeText(log.type) }}</span>
                  <span class="log-msg">{{ log.message }}</span>
                </div>
              }
            </div>
          } @else {
            <div class="gallery-container">
              @if (screenshots.length === 0) {
                <div class="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3a3c42" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                  </svg>
                  <p>No screenshots captured yet.</p>
                </div>
              }
              <div class="gallery-grid">
                @for (s of screenshots; track s.file) {
                  <div
                    class="gallery-thumb"
                    (mouseenter)="hoveredScreenshot = s"
                    (mouseleave)="hoveredScreenshot = null"
                    (click)="viewingScreenshot = s"
                  >
                    <img [src]="s.url" [alt]="s.file" class="thumb-img" loading="lazy" />
                    @if (hoveredScreenshot === s) {
                      <div class="thumb-overlay">
                        <span class="overlay-row"><span class="overlay-label">Device:</span> {{ s.device }}</span>
                        <span class="overlay-row"><span class="overlay-label">Browser:</span> {{ s.browser }}</span>
                        <span class="overlay-row"><span class="overlay-label">Viewport:</span> {{ s.viewport }}</span>
                        <span class="overlay-row"><span class="overlay-label">State:</span> {{ s.state }}</span>
                      </div>
                    }
                    <div class="thumb-badges">
                      <span class="thumb-badge badge-device">{{ s.device }}</span>
                      <span class="thumb-badge badge-state">{{ s.state }}</span>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        @if (isRunning) {
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
        }
      </main>
    </div>

    @if (viewingScreenshot) {
      <div class="lightbox-backdrop" (click)="viewingScreenshot = null">
        <div class="lightbox-content" (click)="$event.stopPropagation()">
          <button class="lightbox-close" (click)="viewingScreenshot = null">✕</button>
          <img [src]="viewingScreenshot.url" [alt]="viewingScreenshot.file" class="lightbox-img" />
          <div class="lightbox-info">
            <span><span class="info-label">Device:</span> {{ viewingScreenshot.device }}</span>
            <span><span class="info-label">Browser:</span> {{ viewingScreenshot.browser }}</span>
            <span><span class="info-label">Viewport:</span> {{ viewingScreenshot.viewport }}</span>
            <span><span class="info-label">State:</span> {{ viewingScreenshot.state }}</span>
          </div>
        </div>
      </div>
    }

    @if (showSettings) {
      <div class="modal-backdrop" (click)="closeSettings()">
        <div class="modal-content modal-wide" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>AI Provider Settings</h3>
            <button class="modal-close" (click)="closeSettings()">✕</button>
          </div>

          <div class="modal-body">
            @if (aiModels.length === 0) {
              <div class="loading-hint">Loading models...</div>
            }

            <!-- Existing keys -->
            @if (aiKeys.length > 0) {
              <table class="keys-table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Provider</th>
                    <th>Model</th>
                    <th>Vision</th>
                    <th>Active</th>
                    <th>Usage</th>
                    <th>Last Error</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (k of aiKeys; track k.id) {
                    <tr>
                      <td>{{ k.label }}</td>
                      <td>{{ k.provider }}</td>
                      <td>{{ k.model }}</td>
                      <td>
                        @if (k.supportsImages) {
                          <span class="badge-yes">✓</span>
                        } @else {
                          <span class="badge-no">—</span>
                        }
                      </td>
                      <td>
                        <label class="toggle-label">
                          <input type="checkbox" [checked]="k.isActive" (change)="toggleActive(k)" />
                          <span class="toggle-slider"></span>
                        </label>
                      </td>
                      <td class="num-cell">{{ k.usageCount }}</td>
                      <td class="error-cell" [title]="k.lastError || ''">
                        @if (k.lastQuotaAt) {
                          <span class="quota-warn">⚠ Quota</span>
                        } @else if (k.lastError) {
                          <span class="err-text">Error</span>
                        } @else {
                          <span class="ok-text">OK</span>
                        }
                      </td>
                      <td>
                        <button class="btn-icon" (click)="deleteKey(k)" title="Delete">✕</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <div class="empty-hint">No API keys configured.</div>
            }

            <!-- Add key form -->
              <div class="add-key-form">
                <h4>Add API Key</h4>
                <div class="form-row">
                  <input class="input-field form-select" type="text" placeholder="Provider (e.g. gemini, groq, openai, anthropic...)" [(ngModel)]="newKey.provider" (ngModelChange)="onProviderChange()" list="provider-list" />
                  <datalist id="provider-list">
                    @for (p of providers; track p) {
                      <option [value]="p">{{ p }}</option>
                    }
                  </datalist>
                  <input class="input-field form-select" type="text" placeholder="Model (e.g. gemini-2.0-flash, gpt-4o...)" [(ngModel)]="newKey.model" (ngModelChange)="onModelChange()" list="model-list" />
                  <datalist id="model-list">
                    @for (m of filteredModels; track m.model) {
                      <option [value]="m.model">{{ m.label }}</option>
                    }
                  </datalist>
                  <input class="input-field" type="text" placeholder="Label (e.g. My Gemini Key)" [(ngModel)]="newKey.label" />
                </div>
                <div class="form-row">
                  <input class="input-field form-api-key" type="password" placeholder="API Key" [(ngModel)]="newKey.apiKey" />
                  <label class="vision-toggle">
                    <input type="checkbox" [(ngModel)]="newKey.supportsImages" />
                    <span class="toggle-label-text">Supports images (vision)</span>
                  </label>
                </div>
                <button class="btn-add-key" (click)="saveNewKey()" [disabled]="!canAddKey()">Add Key</button>
              </div>
          </div>
        </div>
      </div>
    }

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

    .btn-settings {
      width: 100%; padding: 8px; margin-top: 6px;
      background: transparent; color: #6b6d76;
      border: 1px solid #2a2b30; border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px; cursor: pointer; transition: all 0.2s;
    }
    .btn-settings:hover { color: #e8e9ed; border-color: #3a3c42; }

    .sessions-section {
      margin-top: 16px; padding-top: 16px;
      border-top: 1px solid #1e1f24;
    }
    .sessions-header {
      display: flex; align-items: center; justify-content: space-between;
      cursor: pointer; padding: 6px 0;
      user-select: none;
    }
    .sessions-header:hover .sessions-title { color: #e8e9ed; }
    .sessions-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px; font-weight: 500;
      color: #6b6d76;
      text-transform: uppercase; letter-spacing: 1px;
      transition: color 0.15s;
    }
    .sessions-meta { display: flex; align-items: center; gap: 6px; }
    .sessions-count {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px; font-weight: 600;
      background: #1a1b20; color: #c8a45c;
      padding: 1px 7px; border-radius: 8px;
      min-width: 20px; text-align: center;
    }
    .chevron { font-size: 10px; color: #3a3c42; }
    .sessions-list {
      display: flex; flex-direction: column; gap: 4px;
      margin-top: 6px;
    }
    .session-item {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 8px; border-radius: 4px;
      background: #0e0f12; border: 1px solid #1e1f24;
    }
    .session-body {
      flex: 1; display: flex; flex-direction: column;
      gap: 2px; min-width: 0;
    }
    .session-url {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px; color: #9a9ba3;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .session-time {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px; color: #3a3c42;
    }
    .btn-terminate {
      width: 26px; height: 26px; min-width: 26px;
      display: flex; align-items: center; justify-content: center;
      background: transparent; color: #6b6d76;
      border: 1px solid #2a2b30; border-radius: 4px;
      font-size: 12px; cursor: pointer; transition: all 0.15s;
    }
    .btn-terminate:hover:not(:disabled) { color: #e45a5a; border-color: #e45a5a; }
    .btn-terminate:disabled { opacity: 0.4; cursor: not-allowed; }
    .sessions-empty {
      font-size: 11px; color: #3a3c42; font-style: italic;
      padding: 8px; text-align: center;
    }

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
    .section-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px;
    }
    .section-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px; font-weight: 500;
      color: #6b6d76;
      text-transform: uppercase; letter-spacing: 1.5px;
      margin: 0;
    }
    .view-toggle { display: flex; gap: 4px; }
    .toggle-btn {
      padding: 4px 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px; font-weight: 500;
      background: transparent; color: #6b6d76;
      border: 1px solid #2a2b30; border-radius: 4px;
      cursor: pointer; transition: all 0.15s;
    }
    .toggle-btn:hover:not(:disabled) { color: #e8e9ed; border-color: #3a3c42; }
    .toggle-btn.active {
      background: #1a1b20; color: #c8a45c; border-color: #c8a45c;
    }
    .toggle-btn:disabled { opacity: 0.3; cursor: not-allowed; }
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

    .modal-backdrop {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(0,0,0,0.7);
      display: flex; align-items: center; justify-content: center;
    }
    .modal-content {
      background: #121317; border: 1px solid #2a2b30;
      border-radius: 10px; width: 90%; max-width: 900px;
      max-height: 85vh; display: flex; flex-direction: column;
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 24px; border-bottom: 1px solid #1e1f24;
    }
    .modal-header h3 {
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px; color: #e8e9ed; margin: 0;
    }
    .modal-close {
      background: none; border: none; color: #6b6d76;
      font-size: 18px; cursor: pointer;
    }
    .modal-close:hover { color: #e8e9ed; }
    .modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }

    .keys-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
    .keys-table th {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
      color: #6b6d76; text-align: left;
      padding: 8px 10px; border-bottom: 1px solid #1e1f24;
    }
    .keys-table td { padding: 8px 10px; color: #e8e9ed; border-bottom: 1px solid #1e1f24; }
    .keys-table tr:hover td { background: rgba(255,255,255,0.02); }
    .num-cell { font-family: 'JetBrains Mono', monospace; text-align: center; }
    .error-cell { font-size: 11px; }
    .badge-yes { color: #4caf7d; font-weight: bold; }
    .badge-no { color: #3a3c42; }
    .quota-warn { color: #c8a45c; font-weight: 600; }
    .err-text { color: #e45a5a; }
    .ok-text { color: #4caf7d; }
    .btn-icon {
      background: none; border: 1px solid #2a2b30;
      color: #6b6d76; width: 26px; height: 26px;
      border-radius: 4px; cursor: pointer; font-size: 12px;
    }
    .btn-icon:hover { color: #e45a5a; border-color: #e45a5a; }

    .toggle-label { display: inline-flex; align-items: center; cursor: pointer; gap: 6px; }
    .toggle-label input { display: none; }
    .toggle-slider {
      width: 32px; height: 18px; background: #2a2b30;
      border-radius: 9px; position: relative; transition: 0.2s;
    }
    .toggle-slider::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 14px; height: 14px; background: #6b6d76;
      border-radius: 50%; transition: 0.2s;
    }
    .toggle-label input:checked + .toggle-slider { background: #c8a45c; }
    .toggle-label input:checked + .toggle-slider::after { left: 16px; background: #0e0f12; }

    .empty-hint { color: #6b6d76; font-style: italic; margin-bottom: 20px; }

    .add-key-form {
      border-top: 1px solid #1e1f24; padding-top: 16px;
    }
    .add-key-form h4 {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px; color: #9a9ba3; margin: 0 0 12px;
    }
    .form-row { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
    .form-select { flex: 1; min-width: 160px; }
    .form-api-key { flex: 2; min-width: 200px; }
    .form-ro { flex: 1; min-width: 140px; opacity: 0.6; }
    .btn-add-key {
      padding: 8px 20px;
      background: #c8a45c; color: #0e0f12;
      border: none; border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .btn-add-key:hover:not(:disabled) { background: #dbb96e; }
    .btn-add-key:disabled { opacity: 0.4; cursor: not-allowed; }
    .vision-toggle {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; cursor: pointer;
      color: #9a9ba3; font-size: 12px;
    }
    .vision-toggle input { width: 16px; height: 16px; accent-color: #c8a45c; }
    .toggle-label-text { color: #e8e9ed; }

    .gallery-container { flex: 1; overflow-y: auto; padding-bottom: 12px; }
    .gallery-container::-webkit-scrollbar { width: 4px; }
    .gallery-container::-webkit-scrollbar-track { background: transparent; }
    .gallery-container::-webkit-scrollbar-thumb { background: #2a2b30; border-radius: 2px; }
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }
    .gallery-thumb {
      position: relative;
      border-radius: 6px; overflow: hidden;
      background: #0e0f12;
      border: 1px solid #1e1f24;
      aspect-ratio: 16 / 10;
      cursor: pointer;
      transition: border-color 0.2s;
    }
    .gallery-thumb:hover { border-color: #c8a45c; }
    .thumb-img {
      width: 100%; height: 100%;
      object-fit: cover; display: block;
    }
    .thumb-overlay {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.82);
      display: flex; flex-direction: column;
      justify-content: center; align-items: center;
      gap: 6px; padding: 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px; color: #e8e9ed;
    }
    .overlay-row { display: flex; gap: 4px; }
    .overlay-label { color: #c8a45c; font-weight: 500; }
    .thumb-badges {
      position: absolute; top: 6px; left: 6px;
      display: flex; gap: 4px;
    }
    .thumb-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px; font-weight: 600;
      padding: 2px 6px; border-radius: 3px;
      text-transform: uppercase;
      backdrop-filter: blur(4px);
    }
    .badge-device { background: rgba(0,0,0,0.6); color: #9a9ba3; }
    .badge-state { background: rgba(200,164,92,0.2); color: #c8a45c; }

    .lightbox-backdrop {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(0,0,0,0.85);
      display: flex; align-items: center; justify-content: center;
      padding: 40px;
    }
    .lightbox-content {
      position: relative; max-width: 90vw; max-height: 90vh;
      display: flex; flex-direction: column; align-items: center;
      gap: 16px;
    }
    .lightbox-close {
      position: absolute; top: -36px; right: 0;
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.1); color: #e8e9ed;
      border: none; border-radius: 4px;
      font-size: 16px; cursor: pointer;
      transition: background 0.15s;
    }
    .lightbox-close:hover { background: rgba(255,255,255,0.2); }
    .lightbox-img {
      max-width: 100%; max-height: calc(90vh - 60px);
      border-radius: 6px; object-fit: contain;
      border: 1px solid #2a2b30;
    }
    .lightbox-info {
      display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px; color: #9a9ba3;
    }
    .info-label { color: #c8a45c; font-weight: 500; }

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
  showGallery = false;
  screenshots: ScreenshotData[] = [];
  hoveredScreenshot: ScreenshotData | null = null;
  showActiveSessions = false;
  activeSessions: { sessionId: string; url: string; startedAt: string }[] = [];
  terminatingId: string | null = null;
  viewingScreenshot: ScreenshotData | null = null;

  private subs: Subscription[] = [];
  private sessionSubs: Subscription[] = [];
  private testTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentSessionId: string | null = null;

  // ── Settings modal state ──
  showSettings = false;
  aiKeys: AiKey[] = [];
  aiModels: ModelInfo[] = [];
  newKey: Partial<AiKey> & { supportsImages: boolean } = { provider: '', model: '', label: '', apiKey: '', supportsImages: false };
  providers: string[] = [];
  filteredModels: ModelInfo[] = [];

  constructor(private api: ApiService, private socket: SocketService) {}

  // ── Settings methods ──
  openSettings() {
    this.showSettings = true;
    this.loadAiKeys();
    this.api.getModels().subscribe((m) => {
      this.aiModels = m;
      this.providers = [...new Set(m.map(mm => mm.provider))];
    });
  }

  closeSettings() {
    this.showSettings = false;
  }

  loadAiKeys() {
    this.api.getAiKeys().subscribe((k) => this.aiKeys = k);
  }

  onProviderChange() {
    this.filteredModels = this.aiModels.filter((m) =>
      m.provider.toLowerCase() === (this.newKey.provider || '').toLowerCase()
    );
    // Don't clear model — user may be typing custom
    const m = this.filteredModels.find(mm => mm.model === this.newKey.model);
    if (!m) {
      // Custom model — keep user's value, don't auto-toggle images
    }
  }

  onModelChange() {
    const m = this.aiModels.find(mm => mm.model === this.newKey.model);
    if (m) {
      this.newKey.supportsImages = m.supportsImages;
    }
    // If custom model, user sets supportsImages manually via checkbox
  }

  canAddKey(): boolean {
    return !!this.newKey.provider && !!this.newKey.model && !!this.newKey.label && !!this.newKey.apiKey;
  }

  saveNewKey() {
    if (!this.canAddKey()) return;
    const sub = this.api.createAiKey({
      provider: this.newKey.provider!,
      model: this.newKey.model!,
      label: this.newKey.label!,
      apiKey: this.newKey.apiKey!,
      supportsImages: this.newKey.supportsImages,
      isActive: true,
    } as any).subscribe({
      next: () => {
        this.loadAiKeys();
        this.newKey = { provider: '', model: '', label: '', apiKey: '', supportsImages: false };
        this.filteredModels = [];
      },
      error: (err) => this.addLog(`Failed to save key: ${err.message}`, 'error'),
    });
    this.subs.push(sub);
  }

  deleteKey(k: AiKey) {
    if (!confirm(`Delete key "${k.label}"?`)) return;
    const sub = this.api.deleteAiKey(k.id).subscribe({
      next: () => this.loadAiKeys(),
      error: (err) => this.addLog(`Failed to delete key: ${err.message}`, 'error'),
    });
    this.subs.push(sub);
  }

  toggleActive(k: AiKey) {
    const sub = this.api.updateAiKey(k.id, { isActive: !k.isActive }).subscribe({
      next: () => this.loadAiKeys(),
      error: (err) => this.addLog(`Failed to update key: ${err.message}`, 'error'),
    });
    this.subs.push(sub);
  }

  ngOnInit() {
    this.loadSavedState();
    this.loadProfiles();
    this.loadActiveSessions();
    this.socket.waitForConnection().then(() => {
      this.addLog('Real-time connection established.', 'info');
    });
    this.addLog('Dashboard initialized. Ready to run tests.', 'info');

    const startedSub = this.socket.onSessionStarted().subscribe((data) => {
      if (!this.activeSessions.find(s => s.sessionId === data.sessionId)) {
        this.activeSessions = [...this.activeSessions, { sessionId: data.sessionId, url: data.url, startedAt: data.startedAt }];
      }
    });
    const removedSub = this.socket.onSessionRemoved().subscribe((data) => {
      this.activeSessions = this.activeSessions.filter(s => s.sessionId !== data.sessionId);
      if (data.sessionId === this.currentSessionId) {
        this.clearTestTimeout();
        this.isRunning = false;
        this.currentSessionId = null;
        this.subs.forEach(s => s.unsubscribe());
        this.subs = [];
      }
    });
    this.sessionSubs.push(startedSub, removedSub);
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
    this.clearTestTimeout();
    this.subs.forEach(s => s.unsubscribe());
    this.sessionSubs.forEach(s => s.unsubscribe());
  }

  loadActiveSessions() {
    const sub = this.api.getActiveSessions().subscribe({
      next: (data) => { this.activeSessions = data; },
      error: () => {},
    });
    this.sessionSubs.push(sub);
  }

  terminateSession(sessionId: string) {
    this.terminatingId = sessionId;
    const sub = this.api.cancelSession(sessionId).subscribe({
      next: () => {
        this.activeSessions = this.activeSessions.filter(s => s.sessionId !== sessionId);
        this.terminatingId = null;
        if (sessionId === this.currentSessionId) {
          this.clearTestTimeout();
          this.isRunning = false;
          this.subs.forEach(s => s.unsubscribe());
          this.subs = [];
          this.addLog(`Test terminated.`, 'error');
        } else {
          this.addLog(`Session ${sessionId.slice(0, 8)}… terminated.`, 'error');
        }
      },
      error: () => {
        this.terminatingId = null;
        this.activeSessions = this.activeSessions.filter(s => s.sessionId !== sessionId);
      }
    });
    this.subs.push(sub);
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

    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    this.clearTestTimeout();

    this.saveState();
    this.isRunning = true;
    this.score = null;
    this.issuesCount = 0;
    this.stepsCompleted = 0;
    this.logs = [];
    this.screenshots = [];
    this.hoveredScreenshot = null;
    this.viewingScreenshot = null;

    this.addLog(`Initiating test for ${this.url}...`, 'running');


    const profile = this.selectedProfileId
      ? this.profiles.find(p => p.id === this.selectedProfileId)
      : null;
    if (profile) {
      this.addLog(`Profile selected: ${profile.name}`, 'info');
    }

    const progressSub = this.socket.onProgress().subscribe((data: TestProgress) => {
      if (data.progress != null) this.stepsCompleted = data.progress;
      this.addLog(data.message, data.type || 'running');
    });

    const screenshotSub = this.socket.onScreenshot().subscribe((data) => {
      this.screenshots = [...this.screenshots, data.screenshot];
      this.addLog(`Captured: ${data.screenshot.browser} / ${data.screenshot.device} (${data.screenshot.state})`, 'info');
    });

    const completeSub = this.socket.onComplete().subscribe((data: TestResult) => {
      this.logs = this.logs.map(l => l.type === 'running' ? { ...l, type: 'success' as const } : l);
      const result = data.result as any;
      if (result.screenshots) {
        for (const s of result.screenshots) {
          if (!this.screenshots.find(ex => ex.file === s.file)) {
            this.screenshots = [...this.screenshots, s];
          }
        }
      }
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
      this.clearTestTimeout();
      this.currentSessionId = null;
      this.isRunning = false;
    });

    const errorSub = this.socket.onError().subscribe((data: TestError) => {
      this.logs = this.logs.map(l => l.type === 'running' ? { ...l, type: 'error' as const } : l);
      this.addLog(`Error: ${data.error}`, 'error');
      this.clearTestTimeout();
      this.currentSessionId = null;
      this.isRunning = false;
    });

    this.subs.push(progressSub, screenshotSub, completeSub, errorSub);

    const socketId = await this.socket.waitForConnection();

    const sub = this.api.runTest(
      this.url.trim(),
      this.selectedProfileId ?? undefined,
      this.instructions || undefined,
      undefined,
      socketId
    ).subscribe({
      next: (res) => { this.currentSessionId = res.sessionId; },
      error: (err) => {
        this.addLog(`Failed to start test: ${err.message || 'Unknown error'}`, 'error');
        this.clearTestTimeout();
        this.currentSessionId = null;
        this.isRunning = false;
      }
    });
    this.subs.push(sub);

    this.testTimeout = setTimeout(() => {
      if (!this.isRunning) return;
      this.addLog('Test timed out — no response from backend after 3 minutes. The server may have crashed or the connection was lost.', 'error');
      this.currentSessionId = null;
      this.isRunning = false;
      this.subs.forEach(s => s.unsubscribe());
      this.subs = [];
    }, 180000);
  }

  reset() {
    this.url = '';
    this.instructions = '';
    this.selectedProfileId = null;
    this.score = null;
    this.issuesCount = 0;
    this.stepsCompleted = 0;
    this.logs = [];
    this.screenshots = [];
    this.hoveredScreenshot = null;
    this.viewingScreenshot = null;
    this.showGallery = false;
    this.terminatingId = null;
    this.currentSessionId = null;
    this.clearTestTimeout();
    this.saveState();
    this.addLog('Dashboard reset.', 'info');
  }

  private clearTestTimeout() {
    if (this.testTimeout) { clearTimeout(this.testTimeout); this.testTimeout = null; }
  }

  isLastRunning(log: LogEntry): boolean {
    if (log.type !== 'running') return false;
    for (let i = this.logs.length - 1; i >= 0; i--) {
      if (this.logs[i].type === 'running') return this.logs[i] === log;
    }
    return false;
  }

  private addLog(message: string, type: LogEntry['type']) {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour12: false });
    if (type === 'running') {
      this.logs = this.logs.map(l => l.type === 'running' ? { ...l, type: 'info' as const } : l);
    }
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
