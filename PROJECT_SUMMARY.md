# UI Tester AI — Multi-Agent Automation System

## Project Overview

A multi-agent UI testing automation system that uses Playwright for screenshots, AI vision (Gemini) for UX review, and DeepSeek for code fixes. Supports desktop browsers, iOS/iPad emulation, and a MySQL-backed device/browser configuration database.

Built with **NestJS** (TypeScript) on the backend. A legacy Node.js/Express version exists in `backend-legacy/`.

---

## NestJS Backend Architecture

```
ui-tester-ai/
│
├── backend/                         # NestJS API + Playwright engine
│   ├── src/
│   │   ├── main.ts                  # Bootstrap: global prefix `/api`, CORS, ValidationPipe
│   │   ├── app.module.ts            # Root module — dynamic forRoot() pattern
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
│   │   ├── tester/                  # Agent 1: Playwright screenshot engine
│   │   │   └── tester.service.ts
│   │   │
│   │   ├── reviewer/                # Agent 2: Gemini vision + rule-based UX review
│   │   │   └── reviewer.service.ts
│   │   │
│   │   ├── fixer/                   # Agent 3: Source-code fixer (CSS, accessibility, meta)
│   │   │   └── fixer.service.ts
│   │   │
│   │   ├── instructor/              # Natural language → Playwright action parser
│   │   │   └── instructor.service.ts
│   │   │
│   │   ├── cli/                     # CLI runner + session management
│   │   │   ├── cli.service.ts       # Orchestrates the 3-agent pipeline
│   │   │   ├── cli.module.ts
│   │   │   ├── runner.ts            # CLI entry: node dist/cli/runner.js --url <url>
│   │   │   └── session-utils.ts     # Session folder creation & cleanup
│   │   │
│   │   ├── common/                  # (reserved for shared guards, interceptors, filters)
│   │   └── sessions/                # (reserved for session entity/repository)
│   │
│   ├── scripts/                     # SQL scripts for DB setup
│   ├── dist/                        # Compiled output
│   ├── nest-cli.json
│   ├── tsconfig.json
│   ├── .env / .env.test
│   └── package.json                 # NestJS 11, TypeORM, Playwright, class-validator
│
├── backend-legacy/                  # Previous Node.js/Express version (preserved)
│   ├── orchestrator.js              # Entry point — interactive menu or batch mode
│   ├── orchestrator-batch.js
│   ├── interactive-cli.js
│   ├── config.json / credentials.json
│   ├── agents/                      # Agent JS files (tester, reviewer, fixer, instructor)
│   ├── utils/
│   └── scripts/
│
├── frontend/                        # (planned) Angular web app
│   └── (to be scaffolded)
│
├── .agents/                         # AI-tool-agnostic agent definitions
│   └── agents/
│       ├── tester-agent.md
│       ├── reviewer-agent.md
│       └── fixer-agent.md
│
├── AGENTS.md                        # Root-level entrypoint referencing agent definitions
├── sessions/                        # Timestamped run folders
│   └── {timestamp}-{name}/
│       ├── screenshots/
│       └── reports/
├── screenshots/                     # Generated screenshots
├── reports/                         # Generated reports
└── PROJECT_SUMMARY.md
```

---

## Three Agents

| Agent | Role | Model | NestJS Service |
|-------|------|-------|----------------|
| **Agent 1 — Tester** | Takes screenshots across devices × browsers × states | Playwright | `tester.service.ts` |
| **Agent 2 — Reviewer** | Analyzes screenshots for UX bugs using Gemini vision | Gemini 2.0 Flash | `reviewer.service.ts` |
| **Agent 3 — Fixer** | Applies CSS/code fixes in project directory | Rule-based | `fixer.service.ts` |

### Workflow (orchestrated by `cli.service.ts`)

```
1. Tester.run(options)  → screenshots[]
2. Reviewer.run({ appUrl, screenshots }) → ReviewReport { score, issues }
3. Fixer.run(report, projectPath) → { fixesApplied, summary }
```

Loops up to `maxRetries` (default 3) — if Reviewer finds issues and Fixer applies them, re-test until clean or retries exhausted.

---

## Key Features Built

### 1. Multi-Device Screenshots (`tester.service.ts`)
- **Dynamic device/browser config** — fetches from MySQL via Devices API
- **5 desktop/tablet/mobile viewports** (1920×1080, 1440×900, 768×1024, 430×932, 375×812)
- **3 browsers**: Chromium, Firefox, WebKit
- **iOS/iPad emulation** via Playwright device descriptors — sets real user agent, DPR, touch events, isMobile flag
- **States per device**: initial load, scrolled, rotated (mobile only), fullpage

### 2. UX Review (`reviewer.service.ts`)
- **Gemini vision**: Sends screenshots + prompt to Gemini 2.0 Flash for AI-powered review
- **Fallback**: Rule-based analysis when no Gemini key is provided
- **Checklist**: layout-css, responsive, typography, assets, accessibility, cross-browser, interaction
- **iOS-specific checks**: safe areas, touch targets (44pt), -webkit- prefixes, viewport meta
- **Output**: Score (0-100), issue list with severity, JSON + Markdown reports

### 3. Code Fixer (`fixer.service.ts`)
- Reads project source files and applies targeted CSS/accessibility fixes
- Handles iOS-specific categories: ios-safari, ios-notch, ios-touch, ios-viewport
- Currently marks complex fixes for human review (safety-first approach)

### 4. Instruction Engine (`instructor.service.ts`)
Parses natural language into Playwright actions:

| Instruction | Example | Action |
|------------|---------|--------|
| Navigate | `Go to https://example.com/login` | `page.goto()` |
| Login | `Login with username admin and password pass123` | Auto-finds fields, fills, submits |
| Click | `Click on "Products"` | Tries button, link, text, role, selector |
| Type | `Type "hello" into the search box` | Finds input by placeholder/label/name |
| Select | `Select "Premium" from the tier dropdown` | `page.selectOption()` |
| Check/Uncheck | `Check the "Agree" checkbox` | `page.check()` |
| Hover | `Hover over the menu` | `page.hover()` |
| Scroll | `Scroll down` / `Scroll to "Footer"` | `window.scrollTo()` |
| Wait | `Wait for 3 seconds` | `page.waitForTimeout()` |
| Screenshot | `Take a screenshot` | `page.screenshot()` |

### 5. Database-Driven Device Configuration (MySQL via TypeORM)

Tables:

| Table | Purpose |
|---|---|
| `devices` | All devices with `set_key` column ('desktop'/'tablet'/'mobile') |
| `device_browsers` | Available browsers per device + default flag |
| `test_profiles` | Named reusable test configurations |
| `test_profile_combos` | Device × browser picks for each profile |

---

## REST API — Frontend Consumption Guide

All endpoints are prefixed with `/api` and return JSON. CORS is enabled. Validation uses `class-validator` with `ValidationPipe` (transform + whitelist).

### Devices API (`/api/devices`)

| Method | Endpoint | Description | Frontend Use |
|--------|----------|-------------|--------------|
| `GET` | `/api/devices/sets` | List device sets (e.g. `["desktop","tablet","mobile"]`) | Populate tabs/filters for device selection |
| `GET` | `/api/devices/set/:setKey` | Get all devices in a set with their browsers | Device selection checklist/accordion |
| `GET` | `/api/devices/:id` | Get single device details | Device info panel |
| `POST` | `/api/devices` | Create a new device | Admin device management UI |
| `DELETE` | `/api/devices/:id` | Delete a device | Admin device removal |
| `GET` | `/api/devices/:id/browsers` | Get browsers assigned to a device | Show browser toggles per device |
| `POST` | `/api/devices/:id/browsers` | Assign a browser to device | Add browser toggle |
| `DELETE` | `/api/devices/:id/browsers/:browserKey` | Remove a browser assignment | Remove browser toggle |

### Profiles API (`/api/profiles`)

| Method | Endpoint | Description | Frontend Use |
|--------|----------|-------------|--------------|
| `GET` | `/api/profiles` | List all test profiles | Profile selection dropdown/cards |
| `GET` | `/api/profiles/:id` | Get profile with associated device×browser combos | Load saved configuration |
| `POST` | `/api/profiles` | Create a new profile with combos | "Save as profile" feature |
| `DELETE` | `/api/profiles/:id` | Delete a profile | Profile management UI |
| `GET` | `/api/profiles/:id/combos` | Get device×browser combos for a profile | Resolve selected profile into test config |

### Frontend Integration Example

```
[Frontend App]
     │
     ├─ GET  /api/devices/sets          ──→ Show tabs: Desktop / Tablet / Mobile
     ├─ GET  /api/devices/set/desktop   ──→ Render device cards with browser checkboxes
     │
     ├─ User selects devices + browsers
     │     │
     │     ├─ POST /api/profiles          ──→ Save as named profile
     │     └─ (or use inline selection)   ──→ Trigger test run via backend CLI
     │
     └─ GET  /api/profiles              ──→ Load saved profiles for quick re-run
```

**Request flow**:
1. Frontend fetches device sets → displays categorized device picker
2. User picks devices × browsers (or loads a saved profile)
3. Frontend sends the config to the backend to trigger a test run
4. Backend runs Tester → Reviewer → Fixer pipeline
5. Results (screenshots + review report) are served from the session folder

---

## CLI Usage (NestJS)

```bash
cd backend
npm run build

# CLI runner
node dist/cli/runner.js --url "https://example.com" --project "E:/Projects/my-app"

# Start API server
npm run start

# Development with watch
npm run start:dev
```

---

## How to Run (Dev)

```bash
cd backend
npm install
npx playwright install chromium firefox webkit
npm run start:dev        # API server on port 3000
# or
npm run build
node dist/cli/runner.js --url "https://example.com"
```

---

## Known Issues

1. **iOS screenshot timeout**: `page.screenshot` sometimes hangs on emulated iOS devices for heavy sites. Fullpage screenshot on iOS emulation needs investigation — skip is thrown and continues to next device.
2. **Fullpage on iOS**: Playwright's fullPage screenshots on emulated devices can time out on font loading. Current fix: iOS devices skip fullpage state.
3. **Gemini API key required**: Without it, review falls back to basic rule-based analysis (minimal findings).
4. **Fixer is conservative**: Most fixes marked for human review to avoid breaking changes.
5. **Frontend not yet scaffolded**: Angular web UI is planned but not started.
6. **No API schemas/docs**: No Swagger/OpenAPI integration yet (planned).
