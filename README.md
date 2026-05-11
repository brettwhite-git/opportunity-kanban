# Opportunity Kanban

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![SuiteScript 2.1](https://img.shields.io/badge/SuiteScript-2.1-orange.svg)](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_4387172221.html)
[![Tests: 50 passing](https://img.shields.io/badge/tests-50%20passing-brightgreen.svg)](#development)
[![ESLint](https://img.shields.io/badge/linting-ESLint-purple.svg)](#development)
[![SuiteCloud CLI v3](https://img.shields.io/badge/SuiteCloud_CLI-v3.1.2-lightgrey.svg)](https://github.com/nicholasglesmann/sdf-cli-gem)

A NetSuite SuiteApp that renders a kanban board portlet on dashboards, giving sales reps a visual pipeline of their opportunities organized by status columns.

> **Educational use only**
>
> This project is provided for educational and demonstration purposes only. The code is not certified for quality, security, correctness, or production readiness. Review, test, secure, and validate it in your own NetSuite account before relying on it.

<img width="3012" height="1348" alt="oppkanban" src="https://github.com/user-attachments/assets/5df79493-5884-46b1-aa94-8797b5167286" />

## Optional Status Filter

By default, the portlet shows every Opportunity status found in the current user's opportunities. To limit the board to specific statuses for a deployment, set the **Opportunity Status Filter** script parameter after deployment:

1. In NetSuite, go to **Customization > Scripting > Script Deployments**
2. Open the **Opportunity Kanban Board** deployment
3. On **Parameters**, set **Opportunity Status Filter** to comma-separated Opportunity status internal IDs
4. Save the deployment and reload the dashboard portlet

Example values:

```text
6,7,8
```
<img width="3320" height="1278" alt="oppstatusfilter" src="https://github.com/user-attachments/assets/cce7e1da-d064-48d4-aca7-0fd3a417b4d3" />

Leave the field blank to show all statuses. Use internal IDs, not status names; IDs can vary by NetSuite account, so this SuiteApp ships with the parameter blank.

## Features

- **Kanban board view** — Opportunities displayed as cards in status columns (Proposal, Negotiation, Closed Won, etc.)
- **Inclusive date filters** — This Month, This Quarter, Next Quarter, Last Quarter (a deal closing this month also appears under This Quarter)
- **Click-through navigation** — Click any card to open the full opportunity record; click the transaction ID to open in a new tab
- **Auto-derived columns** — Status columns are built dynamically from your actual data, no configuration needed
- **Optional status filter** — Admins can limit the board to selected Opportunity statuses from the script deployment record
- **Currency formatting** — Projected totals shown as $150K, $2.5M, etc.
- **Portlet-safe architecture** — Built to survive NetSuite's iframe extraction process using self-contained onclick handlers

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server-side | SuiteScript 2.1 (`N/search`, `N/runtime`, `N/file`) |
| Client-side | Vanilla JavaScript (no frameworks) |
| Build/Deploy | SuiteCloud SDK / SuiteCloud CLI |
| Testing | Jest 29 + `@oracle/suitecloud-unit-testing` |
| Linting | ESLint 8 + `eslint-plugin-suitescript` |

## Quick Start

### Prerequisites

- Node.js 18+
- Java 17+ available on your PATH
- SuiteCloud CLI or the SuiteCloud IDE extension
- A NetSuite account with SuiteCloud Development Framework enabled

### Install

```bash
git clone https://github.com/brettwhite-git/opportunity-kanban.git
cd opportunity-kanban
npm install
```

### Configure Authentication

Authenticate with NetSuite using whichever SuiteCloud SDK flow fits your environment:

- SuiteCloud CLI browser-based authentication
- SuiteCloud IDE extension authentication
- Existing local SuiteCloud auth IDs
- CI credentials for automated validation or deployment

The SuiteCloud commands use the authentication context you have already configured locally.

### Deploy

```bash
suitecloud project:validate           # Validate project structure
suitecloud project:deploy --validate  # Validate deployment without deploying
suitecloud project:deploy             # Deploy to NetSuite
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
│   │       │   ├── opportunity-kanban.js     # Server-side portlet script
│   │       │   └── kanban-client.js          # Client-side board rendering
│   │       └── lib/
│   │           └── queries.js                # Opportunity search & status derivation
│   └── Objects/
│       └── customscript_opp_kanban.xml       # Script deployment definition
├── package.json
└── .eslintrc.json
```

## Development

### Run Tests

```bash
npm test              # Run all 50 tests
npm run test:watch    # Watch mode
```

### Lint

```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix
```

## License

[MIT](https://opensource.org/licenses/MIT)
