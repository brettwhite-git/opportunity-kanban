# Opportunity Kanban

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![SuiteScript 2.1](https://img.shields.io/badge/SuiteScript-2.1-orange.svg)](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_4387172221.html)
[![Tests: 35 passing](https://img.shields.io/badge/tests-35%20passing-brightgreen.svg)](#development)
[![ESLint](https://img.shields.io/badge/linting-ESLint-purple.svg)](#development)
[![SuiteCloud CLI v3](https://img.shields.io/badge/SuiteCloud_CLI-v3.1.2-lightgrey.svg)](https://github.com/nicholasglesmann/sdf-cli-gem)

A NetSuite SuiteApp that renders a kanban board portlet on dashboards, giving sales reps a visual pipeline of their opportunities organized by status columns.

![oppkanban](https://github.com/user-attachments/assets/b11ba2e7-12f2-4a68-88d1-91d1dc8b87f9)


## Features

- **Kanban board view** — Opportunities displayed as cards in status columns (Proposal, Negotiation, Closed Won, etc.)
- **Inclusive date filters** — This Month, This Quarter, Next Quarter, Last Quarter (a deal closing this month also appears under This Quarter)
- **Click-through navigation** — Click any card to open the full opportunity record; click the transaction ID to open in a new tab
- **Auto-derived columns** — Status columns are built dynamically from your actual data, no configuration needed
- **Currency formatting** — Projected totals shown as $150K, $2.5M, etc.
- **Portlet-safe architecture** — Built to survive NetSuite's iframe extraction process using self-contained onclick handlers

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server-side | SuiteScript 2.1 (`N/search`, `N/runtime`, `N/file`) |
| Client-side | Vanilla JavaScript (no frameworks) |
| Build/Deploy | SuiteCloud CLI v3.1.2 with M2M authentication |
| Testing | Jest 29 + `@oracle/suitecloud-unit-testing` |
| Linting | ESLint 8 + `eslint-plugin-suitescript` |

## Quick Start

### Prerequisites

- Node.js 18+
- A NetSuite account with SuiteCloud Development Framework enabled
- M2M certificate credentials for your target account

### Install

```bash
git clone https://github.com/brettwhite-git/opportunity-kanban.git
cd opportunity-kanban
npm install
```

### Configure Authentication

1. Place your M2M private key as `m2m-key.pem` in the project root
2. Create a `.env` file with your credentials:
   ```
   SUITECLOUD_CI=<your-auth-id>
   SUITECLOUD_CI_PASSKEY=<your-passkey>
   ```
3. Register the credentials (first time only):
   ```bash
   npm run setup:m2m
   ```

### Deploy

```bash
npm run validate    # Validate project structure
npm run deploy      # Deploy to NetSuite
```

After deploying, add the **Opportunity Kanban** portlet to any dashboard via **Personalize Dashboard > Custom Portlets**.

## Project Structure

```
opportunity-kanban/
├── src/
│   ├── manifest.xml                          # SuiteApp bundle metadata (v1.0.5)
│   ├── deploy.xml                            # Deployment paths (wildcard)
│   ├── FileCabinet/SuiteApps/
│   │   └── com.netsuite.opportunitykanban/
│   │       ├── portlet/
│   │       │   ├── OpportunityKanban.js      # Server-side portlet script
│   │       │   └── kanban-client.js          # Client-side board rendering
│   │       └── lib/
│   │           └── queries.js                # Opportunity search & status derivation
│   └── Objects/
│       └── customscript_opp_kanban.xml       # Script deployment definition
├── __tests__/                                # Jest unit tests (4 suites, 35 tests)
├── package.json
├── jest.config.js
└── .eslintrc.json
```

## Development

### Run Tests

```bash
npm test              # Run all 35 tests
npm run test:watch    # Watch mode
```

### Lint

```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix
```

## Architecture

This portlet uses a **hybrid delivery pattern** to work within NetSuite's portlet sandbox:

1. **Inline CSS** — `<style>` blocks render correctly inside portlets
2. **Small inline data script** — Injects `window.KANBAN_DATA` with serialized opportunity data
3. **External JS file** — `kanban-client.js` loaded via `<script src>` handles all DOM construction

This approach is necessary because NetSuite renders portlets inside an iframe, executes scripts there, then extracts the raw HTML into the main page — destroying all JavaScript references. Only HTML attributes (`onclick`, `href`, `data-*`) and CSS survive this process. All interactive elements use self-contained `onclick` strings with only built-in DOM APIs.

## Roadmap

- [x] Phase 1 — Read-only kanban board with filtering and click-through
- [ ] Phase 2 — Drag-and-drop status updates via HTML5 native DnD API

## License

[ISC](https://opensource.org/licenses/ISC)
