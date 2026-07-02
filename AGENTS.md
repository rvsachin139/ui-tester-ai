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
