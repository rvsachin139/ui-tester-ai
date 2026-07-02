import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';

export interface TestProgress {
  sessionId: string;
  phase: string;
  message: string;
  progress?: number;
  type?: 'info' | 'running' | 'success' | 'error';
}

export interface TestResult {
  sessionId: string;
  result: Record<string, unknown>;
}

export interface TestError {
  sessionId: string;
  error: string;
}

export interface ScreenshotData {
  file: string;
  path: string;
  url: string;
  device: string;
  browser: string;
  viewport: string;
  state: string;
}

export interface ScreenshotEvent {
  sessionId: string;
  screenshot: ScreenshotData;
}

export interface SessionEvent {
  sessionId: string;
  url: string;
  startedAt: string;
}

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket;
  private connected$ = new Subject<string>();

  constructor() {
    this.socket = io('http://localhost:3000', {
      transports: ['websocket', 'polling'],
    });
    this.socket.on('connect', () => {
      this.connected$.next(this.socket.id!);
    });
  }

  get socketId(): string | undefined {
    return this.socket.id;
  }

  waitForConnection(): Promise<string> {
    if (this.socket.connected) return Promise.resolve(this.socket.id!);
    return new Promise((resolve) => {
      const sub = this.connected$.subscribe((id) => {
        resolve(id);
        sub.unsubscribe();
      });
    });
  }

  onProgress(): Observable<TestProgress> {
    return new Observable((observer) => {
      this.socket.on('test:progress', (data: TestProgress) => observer.next(data));
      return () => this.socket.off('test:progress');
    });
  }

  onComplete(): Observable<TestResult> {
    return new Observable((observer) => {
      this.socket.on('test:complete', (data: TestResult) => observer.next(data));
      return () => this.socket.off('test:complete');
    });
  }

  onError(): Observable<TestError> {
    return new Observable((observer) => {
      this.socket.on('test:error', (data: TestError) => observer.next(data));
      return () => this.socket.off('test:error');
    });
  }

  onScreenshot(): Observable<ScreenshotEvent> {
    return new Observable((observer) => {
      this.socket.on('test:screenshot', (data: ScreenshotEvent) => observer.next(data));
      return () => this.socket.off('test:screenshot');
    });
  }

  onSessionStarted(): Observable<SessionEvent> {
    return new Observable((observer) => {
      this.socket.on('test:started', (data: SessionEvent) => observer.next(data));
      return () => this.socket.off('test:started');
    });
  }

  onSessionRemoved(): Observable<{ sessionId: string }> {
    return new Observable((observer) => {
      this.socket.on('test:removed', (data: { sessionId: string }) => observer.next(data));
      return () => this.socket.off('test:removed');
    });
  }

  ngOnDestroy() {
    this.socket.disconnect();
  }
}
