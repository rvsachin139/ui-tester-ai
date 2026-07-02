# UI Tester AI — Multi-Agent System

This project uses a multi-agent automation system for UI testing. Three specialized agents work together via an orchestrator to capture, review, and fix UI issues.

## Agents

### [Agent 1 — Tester](.agents/agents/tester-agent.md)
Takes Playwright screenshots across devices (desktop/tablet/mobile) and browsers (Chromium, Firefox, WebKit).

### [Agent 2 — Reviewer](.agents/agents/reviewer-agent.md)
Analyzes screenshots for UX/UI bugs using vision AI — layout, responsive, typography, accessibility, cross-browser issues.

### [Agent 3 — Fixer](.agents/agents/fixer-agent.md)
Applies code fixes based on review reports — CSS, accessibility, typography, responsive fixes.

## Workflow

```
Tester (screenshots) → Reviewer (analyzes) → Fixer (applies fixes)
```

1. **Tester** captures screenshots across device/browser matrix
2. **Reviewer** scores each screenshot (0-100) and flags issues
3. **Fixer** reads the review report and applies targeted source-code fixes

## Entry Points

- **Orchestrator**: `backend/orchestrator.js` (interactive) or `backend/orchestrator-batch.js` (CI)
- **Config**: `backend/config.json`
- **Agent definitions**: `.agents/agents/*.md`

## Project Structure

```
.agents/agents/         ← Agent definition files
backend/                ← Node.js API + Playwright engine
  agents/               ← Agent implementation scripts
  orchestrator.js       ← Interactive CLI entry point
sessions/               ← Per-run screenshot + report folders
reports/                ← Generated reports
```

## Coding Standards

When writing or modifying Angular code in `frontend/`, you MUST first read and follow `frontend/ANGULAR_BEST_PRACTICES.md`. This file contains the official Angular style guide rules, signal patterns, template conventions, DI patterns, performance best practices, and a project audit with specific migration targets. All Angular code should conform to these standards before being considered complete.

When writing or modifying NestJS code in `backend/`, follow NestJS modular architecture conventions: feature modules with controllers/services/entities, TypeORM for database access, and class-validator for request validation.

## Skills

Whenever you create a new skill or instruction file anywhere in this project, you MUST add a reference entry in this section pointing to its location and describing when to use it.

- `playwright-instructor` at `.agents/skills/playwright-instructor/` — Load this skill via the skill tool whenever the user gives natural language UI testing/scraping instructions that need conversion to Playwright commands.

## Standing Instructions

These instructions apply to ALL future interactions unless explicitly overridden:

### Dev Server
- The backend runs via `npm run start:dev` (watch mode) from `backend/` — it auto-reloads on file changes
- **Never open a new terminal if one is already running.** If a backend terminal is already open, just run `npm run build` — watch mode will pick up the changes automatically
- Always run `npm run build` from `backend/` after code changes to verify no errors
- **If port 3000 is already in use (EADDRINUSE): close the old terminal and open a new one.** Press Ctrl+C in the old terminal, or kill the process occupying the port
- When both backend and frontend work is involved, start both dev servers (only if not already running)
