import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TestProfile {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceBrowser {
  id: number;
  deviceId: number;
  browserKey: string;
  isDefault: boolean;
  sortOrder: number;
}

export interface Device {
  id: number;
  setKey: string;
  deviceId: string;
  label: string;
  width: number;
  height: number;
  os: string | null;
  playwrightDevice: string | null;
  sortOrder: number;
  isActive: boolean;
  browsers: DeviceBrowser[];
}

export interface TestRunRequest {
  url: string;
  profileId?: number;
  instructions?: string;
  projectPath?: string;
}

export interface TestRunResponse {
  success: boolean;
  sessionId?: string;
  report?: ReviewReport;
  message?: string;
}

export interface ReviewReport {
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

export interface Issue {
  title: string;
  severity: 'critical' | 'major' | 'minor';
  category: string;
  device?: string;
  browser?: string;
  description: string;
  suggestion?: string;
}

export interface ScreenshotInfo {
  file: string;
  path: string;
  url?: string;
  device: string;
  browser: string;
  viewport: string;
  state: string;
}

export interface Session {
  id: string;
  appUrl: string;
  timestamp: string;
  score: number;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getProfiles(): Observable<TestProfile[]> {
    return this.http.get<TestProfile[]>(`${this.baseUrl}/profiles`);
  }

  getDeviceSets(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/devices/sets`);
  }

  getDevicesBySet(setKey: string): Observable<Device[]> {
    return this.http.get<Device[]>(`${this.baseUrl}/devices/set/${setKey}`);
  }

  runTest(url: string, profileId?: number, instructions?: string, projectPath?: string, socketId?: string): Observable<{ sessionId: string; status: string }> {
    const body: TestRunRequest = { url };
    if (profileId) body.profileId = profileId;
    if (instructions) body.instructions = instructions;
    if (projectPath) body.projectPath = projectPath;
    if (socketId) (body as any).socketId = socketId;
    return this.http.post<{ sessionId: string; status: string }>(`${this.baseUrl}/tests/run`, body);
  }

  getSessions(): Observable<Session[]> {
    return this.http.get<Session[]>(`${this.baseUrl}/tests/sessions`);
  }

  getSession(id: string): Observable<Session> {
    return this.http.get<Session>(`${this.baseUrl}/tests/sessions/${id}`);
  }

  getActiveSessions(): Observable<{ sessionId: string; url: string; startedAt: string }[]> {
    return this.http.get<{ sessionId: string; url: string; startedAt: string }[]>(`${this.baseUrl}/tests/active`);
  }

  cancelSession(sessionId: string): Observable<{ sessionId: string; status: string }> {
    return this.http.delete<{ sessionId: string; status: string }>(`${this.baseUrl}/tests/active/${sessionId}`);
  }

  // ── AI Key management ──

  getModels(): Observable<ModelInfo[]> {
    return this.http.get<ModelInfo[]>(`${this.baseUrl}/ai-keys/models`);
  }

  getAiKeys(): Observable<AiKey[]> {
    return this.http.get<AiKey[]>(`${this.baseUrl}/ai-keys`);
  }

  createAiKey(data: Partial<AiKey>): Observable<AiKey> {
    return this.http.post<AiKey>(`${this.baseUrl}/ai-keys`, data);
  }

  updateAiKey(id: number, data: Partial<AiKey>): Observable<AiKey> {
    return this.http.patch<AiKey>(`${this.baseUrl}/ai-keys/${id}`, data);
  }

  deleteAiKey(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/ai-keys/${id}`);
  }
}

export interface ModelInfo {
  provider: string;
  model: string;
  supportsImages: boolean;
  label: string;
}

export interface AiKey {
  id: number;
  provider: string;
  model: string;
  label: string;
  apiKey: string;
  supportsImages: boolean;
  isActive: boolean;
  usageCount: number;
  lastError: string | null;
  lastQuotaAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
