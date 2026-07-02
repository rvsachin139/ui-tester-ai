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
