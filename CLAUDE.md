# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, testing, deployment and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Project Overview

NetSuite Opportunity Kanban Portlet — a SuiteApp (SuiteScript 2.1) that renders a drag-and-drop kanban board on NetSuite dashboards, letting sales reps move opportunities between status columns via AJAX.

**Status**: Empty shell project. No application code yet. Ready to build from scratch.

## Commands

```bash
npm install                            # Install @oracle/suitecloud-cli dependency
npm run validate                       # Validate project structure and syntax
npm run deploy                         # Deploy SuiteApp to NetSuite
npm run deploy:validate                # Deploy with validation
npm run setup:m2m                      # Re-register M2M credentials (if .p12 is stale)
```

M2M auth env vars (`SUITECLOUD_CI`, `SUITECLOUD_CI_PASSKEY`) are stored in `.env` (gitignored) and auto-sourced by all npm scripts. No manual `export` needed.

### Testing & Linting

```bash
npm test                               # Run Jest unit tests
npm run test:watch                     # Run Jest in watch mode
npm run lint                           # Lint SuiteScript source with ESLint
npm run lint:fix                       # Auto-fix lint issues
```

## Project Structure

This is a **SuiteCloud Development Framework (SDF)** project using CLI v3.x, not a typical Node.js app.

```
opportunity-kanban/
├── src/
│   ├── manifest.xml                    # SuiteApp bundle metadata
│   ├── deploy.xml                      # Deployment file/object paths
│   ├── FileCabinet/
│   │   └── SuiteApps/
│   │       └── com.netsuite.opportunitykanban/   # App code goes here
│   ├── Objects/                        # Script definitions (XML)
│   ├── InstallationPreferences/        # Install behavior config
│   └── Translations/                   # Localization (unused)
├── suitecloud.config.js                # CLI v3 project config
├── project.json                        # Auth default (gitignored, auto-generated)
├── package.json                        # npm scripts + CLI dependency
├── m2m-key.pem                         # M2M private key (gitignored)
├── m2m-cert.pem                        # M2M certificate (gitignored)
├── .env                                # Auth env vars (gitignored)
├── __tests__/                          # Jest unit tests (not deployed)
├── jest.config.js                      # SuiteCloud Jest configuration
├── .eslintrc.json                      # ESLint config with suitescript plugin
├── archive/                            # Previous iteration reference docs
├── docs/solutions/                     # Documented fixes and patterns (YAML frontmatter: module, tags, problem_type); search before debugging portlet/SDF issues
└── CHANGELOG.md                        # Version history
```

- **SuiteApp ID**: `com.netsuite.opportunitykanban`
- **Publisher ID**: `com.netsuite`
- **deploy.xml** uses `~/FileCabinet/*` wildcard — new files deploy automatically

## M2M Authentication

- **Auth ID**: `m2m-kanban` — stored in `project.json` (project root, gitignored)
- **Account**: `td3061543` (MFG 25.2 AI, role Administrator)
- **Certificate ID**: `Se82Nm_f75pjdaX6dnCeZfR8QF6MY6dxSRNpCJyHSv0`
- **Private key**: `m2m-key.pem` (project root, gitignored)
- **Credentials store**: `~/.suitecloud-sdk/credentials_ci.p12` (encrypted with passkey from `.env`)

If credentials become stale or `.p12` won't decrypt, delete `~/.suitecloud-sdk/credentials_ci.p12` and run `npm run setup:m2m`.

## SDF Gotchas (Learned from v1.x iterations)

- **No large inline scripts**: NetSuite portlets do NOT execute large inline `<script>` blocks. Use external JS files via `<script src>` (resolved with `N/file`). Small inline scripts for data injection are fine. CSS can be safely inlined in `<style>` blocks.
- **Hybrid delivery pattern**: Inline CSS + small data `<script>` + external JS file = proven working approach
- **Dragula/jKanban**: Incompatible with portlet sandboxing (global event listeners). Use HTML5 native DnD API instead (element-scoped events).
- **XML element names**: Use `<portlet>`, `<suitelet>`, `<bundleinstallationscript>` — NOT `<portletscripttype>` etc.
- **Portlet XML requires `<portlettype>`**: Must be HTML, FORM, LIST, or LINKS
- **Publisher ID**: Must be fully qualified with exactly one period (e.g., `com.netsuite`)
- **deploy.xml**: SuiteApp projects don't support `<configuration>` or `<translationcollections>` sections
- **`isinactive` filter**: Not valid on opportunity records

## Unit Testing

- **Framework**: Jest 29 + `@oracle/suitecloud-unit-testing` (official Oracle package)
- **Config**: `jest.config.js` uses `SuiteCloudJestConfiguration.build()` which auto-provides stubs for all `N/` modules and transforms AMD `define([...])` to CommonJS
- **Test location**: `__tests__/` at project root (keeps tests out of `src/` which gets deployed)
- **Stubs**: All `N/*` modules are auto-mocked — use `jest.fn()` / `mockReturnValue()` / `mockImplementation()` to control behavior in tests

## Linting

- **Engine**: ESLint 8 + `eslint-plugin-suitescript` (community standard — no official Oracle ESLint plugin exists)
- **Config**: `.eslintrc.json` extends `plugin:suitescript/recommended` (all 10 rules at error level)
- **Key rules**: `api-version`, `script-type`, `entry-points`, `module-vars`, `no-extra-modules`, `no-invalid-modules`
- **Scope**: Lints only `src/FileCabinet/SuiteApps/com.netsuite.opportunitykanban/`

## SuiteScript Conventions

- All server-side scripts use SuiteScript 2.1 module pattern (`@NApiVersion 2.1`, `define([...])`)
- Logging uses `N/log` (not `console.log`) on server side; client-side uses `console.log`
- Script definitions in `src/Objects/` XML files control deployment, audience, and execution role

## Reference

Previous iteration docs archived in `archive/CLAUDE.md.v1` for file path/architecture reference from v1.0–v1.2.
