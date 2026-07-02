# UI Tester AI — Multi-Agent Automation System

## Project Overview

A multi-agent UI testing automation system — 3 AI agents orchestrated to capture Playwright screenshots, review them for UX bugs via vision AI, and apply code fixes. Backend is **NestJS** (TypeScript + TypeORM/MySQL). Frontend is **Angular 19** with real-time dashboard.

**GitHub**: https://github.com/rvsachin139/ui-tester-ai

---

## Architecture

```
ui-tester-ai/
│
├── backend/                         # NestJS API + Playwright engine
│   ├── src/
│   │   ├── main.ts                  # Bootstrap: global prefix `/api`, CORS, ValidationPipe
│   │   ├── app.module.ts            # Root module
│   │   │
│   │   ├── config/
│   │   │   ├── configuration.ts     # NestJS ConfigModule — app & database configs
│   │   │   └── typeorm.config.ts    # Standalone TypeORM DataSource for migrations
│   │   │
│   │   ├── database/
│   │   │   └── database.module.ts   # TypeORM async connection using ConfigService
│   │   │
│   │   ├── devices/                 # Device CRUD + browser assignment
│   │   │   ├── devices.controller.ts
│   │   │   ├── devices.service.ts
│   │   │   ├── entities/
│   │   │   │   ├── device.entity.ts
│   │   │   │   └── device-browser.entity.ts
│   │   │   └── dto/
│   │   │       ├── create-device.dto.ts
│   │   │       └── assign-browser.dto.ts
│   │   │
│   │   ├── profiles/                # Named test profiles with device×browser combos
│   │   │   ├── profiles.controller.ts
│   │   │   ├── profiles.service.ts
│   │   │   ├── entities/
│   │   │   │   ├── test-profile.entity.ts
│   │   │   │   └── test-profile-combo.entity.ts
│   │   │   └── dto/
│   │   │       └── create-profile.dto.ts
│   │   │
│   │   ├── tests/                   # Tests controller/service — orchestrates full pipeline
│   │   │   ├── tests.controller.ts  # POST /api/tests/run, GET /api/tests/sessions
│   │   │   ├── tests.service.ts     # Orchestrates Tester → Reviewer → Fixer
│   │   │   └── tests.module.ts
│   │   │
│   │   ├── tester/                  # Agent 1: Playwright screenshot engine
│   │   │   └── tester.service.ts
│   │   │
│   │   ├── reviewer/                # Agent 2: Gemini vision + rule-based UX review
│   │   │   └── reviewer.service.ts
│   │   │
│   │   ├── fixer/                   # Agent 3: Source-code fixer (CSS, a11y, meta)
│   │   │   └── fixer.service.ts
│   │   │
│   │   ├── instructor/              # Natural language → Playwright action parser
│   │   │   └── instructor.service.ts
│   │   │
│   │   ├── cli/                     # Legacy CLI runner + session management
│   │   │   ├── cli.service.ts
│   │   │   ├── cli.module.ts
│   │   │   ├── runner.ts
│   │   │   └── session-utils.ts
│   │   │
│   │   └── sessions/                # (reserved for session entity)
│   │
│   ├── scripts/                     # SQL seed scripts
│   ├── dist/                        # Compiled output
│   ├── .env                         # MySQL credentials
│   ├── nest-cli.json
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/                        # Angular 19 dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/           # Main dashboard component
│   │   │   │   └── dashboard.component.ts
│   │   │   ├── services/
│   │   │   │   └── api.service.ts   # typed HTTP client
│   │   │   ├── app.component.ts
│   │   │   └── app.config.ts
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── styles.css
│   ├── package.json
│   ├── angular.json
│   └── tsconfig.json
│
├── .agents/agents/                  # AI-tool-agnostic agent definitions
│   ├── tester-agent.md
│   ├── reviewer-agent.md
│   └── fixer-agent.md
│
├── AGENTS.md                        # Root-level entrypoint
├── sessions/                        # Timestamped run folders
│   └── {timestamp}/
│       ├── screenshots/
│       └── reports/
├── .gitignore
└── PROJECT_SUMMARY.md
```

---

## Three Agents

| Agent | Role | Model | Service |
|-------|------|-------|---------|
| **Agent 1 — Tester** | Playwright screenshots across devices × browsers × states | Playwright | `tester.service.ts` |
| **Agent 2 — Reviewer** | Analyzes screenshots for UX bugs via vision AI | Gemini 2.0 Flash / rule-based fallback | `reviewer.service.ts` |
| **Agent 3 — Fixer** | Applies CSS/code fixes in project directory | Rule-based | `fixer.service.ts` |

### Workflow

```
1. Tester.run(options)  → screenshots[]
2. Reviewer.run({ appUrl, screenshots }) → ReviewReport { score, issues }
3. Fixer.run(report, projectPath) → { fixesApplied, summary }
```

Loops up to `maxRetries` (default 3) — if Reviewer finds issues and Fixer applies them, re-test until clean or retries exhausted.

---

## Entry Points

| Entry Point | Purpose | Port |
|-------------|---------|------|
| **`backend/src/main.ts`** | NestJS API server | `:3000` |
| **`frontend/`** | Angular dev server | `:4200` |
| **`backend/src/cli/runner.ts`** | Headless CLI runner | — |

---

## REST API

All endpoints prefixed with `/api`. CORS enabled.

### Tests API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/tests/run` | Run a test — `{ url, profileId, instructions? }` |
| `GET` | `/api/tests/sessions` | List past sessions |
| `GET` | `/api/tests/sessions/:id` | Get session detail + screenshots + report |

### Devices API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/devices/sets` | List device set keys |
| `GET` | `/api/devices/set/:setKey` | Get devices in a set with browsers |
| `GET` | `/api/devices/:id` | Single device details |
| `POST` | `/api/devices` | Create device |
| `DELETE` | `/api/devices/:id` | Delete device |

### Profiles API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/profiles` | List test profiles |
| `GET` | `/api/profiles/:id` | Profile with device×browser combos |
| `POST` | `/api/profiles` | Create profile with combos |
| `DELETE` | `/api/profiles/:id` | Delete profile |
| `GET` | `/api/profiles/:id/combos` | Get combos for a profile |

---

## Dashboard Features

- **URL input** — target site to test, auto-saved on change
- **Profile selector** — radio list loaded from `GET /api/profiles`, "Quick Test (default)" fallback
- **Custom instructions** — freeform text for the reviewer, auto-saved on change
- **Launch Test** — calls `POST /api/tests/run` and shows progress via polling
- **Reset** — clears form and saved state
- **Summary bar** — score, issues count, test steps completed
- **Activity timeline** — scrollable log of pipeline events
- **Progress bar** — visual state indicator during test run
- **localStorage persistence** — URL, profile ID, and instructions saved/restored under `uiTester-dashboard`

---

## Session Storage

```
sessions/{timestamp}/
├── screenshots/
│   ├── desktop-chromium-1920.png
│   ├── desktop-firefox-1920.png
│   ├── mobile-iphone-17-pro-430.png
│   └── ...
└── reports/
    └── report.json
```

---

## How to Run

```bash
# Backend
cd backend
npm install
npx playwright install chromium firefox webkit
npm run start          # Port 3000

# Frontend (separate terminal)
cd frontend
npm install
npx ng serve           # Port 4200
```

---

## Known Issues

1. **iOS screenshot timeout**: Fullpage screenshots on emulated iOS devices can hang on font loading — iOS devices skip fullpage state.
2. **Gemini API key**: Without `GEMINI_API_KEY` in `.env`, reviewer falls back to rule-based analysis (minimal findings, always scores 100).
3. **Fixer is conservative**: Most fixes marked for human review to avoid breaking changes.
4. **No WebSocket/SSE**: Dashboard polls for results; no real-time streaming yet.
5. **No Swagger/OpenAPI docs**.
