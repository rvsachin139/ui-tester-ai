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
}
