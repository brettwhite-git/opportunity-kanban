# Opportunity Kanban

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![SuiteScript 2.1](https://img.shields.io/badge/SuiteScript-2.1-orange.svg)](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_4387172221.html)
[![Tests: 95 passing](https://img.shields.io/badge/tests-95%20passing-brightgreen.svg)](#development)
[![ESLint](https://img.shields.io/badge/linting-ESLint-purple.svg)](#development)
[![SuiteCloud CLI v3](https://img.shields.io/badge/SuiteCloud_CLI-v3.1.2-lightgrey.svg)](https://github.com/nicholasglesmann/sdf-cli-gem)

A NetSuite SuiteApp that renders a kanban board portlet on dashboards, giving sales reps a visual pipeline of their opportunities organized by status columns—with KPI summaries, period filters, search, and drag-and-drop status updates.

> [!IMPORTANT]
> **Demonstration SuiteApp — verify in your account before production use**
>
> This repository is an open-source **example** of a NetSuite HTML portlet with drag-and-drop opportunity updates. It is provided for educational and demonstration purposes only. There is **no warranty** of any kind; you **use it at your own risk**. The code is not certified for quality, security, correctness, or production readiness in your environment.
>
> NetSuite **extracts portlet HTML** into the dashboard after render. Event handling must use **inline `onclick` (and similar) attributes** with self-contained logic; patterns that work on normal pages (`addEventListener`, globals on `window`) may fail after extraction. UI state such as filter checkboxes relies on **HTML attributes** (e.g. `checked`), not only JavaScript properties.
>
> Status columns, accounting periods, and permissions **vary by account**. Configure script deployment parameters, test with the same roles that will use the board (including drag-and-drop saves), and review execution logs in a **sandbox** before relying on this in production.

<img width="3012" height="1348" alt="oppkanban" src="https://github.com/user-attachments/assets/5df79493-5884-46b1-aa94-8797b5167286" />

## Features

- **Kanban board view** — Opportunities as cards in status columns (Proposal, Negotiation, Closed Won, etc.)
- **Drag-and-drop status updates** — Move cards between columns; changes persist via a Suitelet (`entitystatus` on the opportunity), with optimistic UI and revert on failure
- **KPI row** — Opportunities count, Open Value, Closed Won, and Lost totals update for visible cards after filters apply
- **Period filter chip** — Accounting period, fiscal quarter, or custom close-date range; defaults to the current period; list scrolls to the active selection when opened
- **Search** — Filter visible cards by opportunity text without reloading the board
- **Click-through navigation** — Click a card to open the opportunity record; click the transaction ID to open in a new tab
- **Pipeline columns from script parameter** — When **Opportunity Status Filter** is set, the board shows exactly those statuses (including empty columns as drop targets)
- **Auto-derived columns when unconfigured** — If the parameter is blank, columns are built from statuses that have opportunities for the current user
- **Expand board overlay** — Toolbar expand opens a margined modal with a dimmed dashboard behind for full-pipeline visibility
- **Currency formatting** — Projected totals shown as $150K, $2.5M, etc.
- **Portlet-safe architecture** — Hybrid delivery (inline CSS, data injection, external client script) and self-contained inline handlers designed for NetSuite’s portlet HTML extraction

See [CHANGELOG.md](CHANGELOG.md) for release notes and recent changes.

## How this portlet works

NetSuite renders HTML portlets inside an iframe, executes scripts, then **moves the resulting HTML onto the dashboard** and destroys the iframe. That behavior drives several design choices in this project:

| Survives extraction | Typically lost |
|---------------------|----------------|
| Inline `onclick` / `oninput` / drag attributes with **built-in DOM logic only** | `addEventListener` on elements |
| `checked` and other HTML **attributes** on inputs | `.checked` (and similar) set only in JS |
| External `kanban-client.js` loaded via `<script src>` (generates handler strings at build time) | `window` / custom global functions referenced from handlers |

**Delivery pattern:** inlined `<style>` and a small `KANBAN_DATA` script, plus `kanban-client.js` for board render, filters, and HTML5 drag-and-drop (no third-party DnD libraries).

**Status saves:** the update Suitelet applies `entitystatus` without requiring **Manage Accounting Periods** on every save—closed accounting period metadata is supplied from the board payload loaded with the portlet.

## Configuration

### Opportunity Status Filter (optional)

By default, the portlet shows every Opportunity status found in the current user's opportunities. To limit the board to specific statuses for a deployment, set the **Opportunity Status Filter** script parameter after deployment:

1. In NetSuite, go to **Customization > Scripting > Script Deployments**
2. Open the **Opportunity Kanban Board** deployment
3. On **Parameters**, set **Opportunity Status Filter** to comma-separated Opportunity status internal IDs
4. Save the deployment and reload the dashboard portlet

Example internal ID values:

```text
6,7,8,9
```

Leave the field blank to derive columns from the user's opportunities only (no empty columns). Set the parameter to define a fixed pipeline with empty drop zones. Use internal IDs, not status names; IDs can vary by NetSuite account, so this SuiteApp ships with the parameter blank.

<img width="3320" height="1278" alt="oppstatusfilter" src="https://github.com/user-attachments/assets/cce7e1da-d064-48d4-aca7-0fd3a417b4d3" />

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server-side | SuiteScript 2.1 (`N/search`, `N/runtime`, `N/file`, `N/url`) |
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
npm run validate              # Validate project structure
npm run deploy:validate         # Validate deployment without applying
npm run deploy                  # Deploy to NetSuite
```

After deploying, add the **Opportunity Kanban** portlet to any dashboard via **Personalize Dashboard > Custom Portlets**.

## Project Structure

```
opportunity-kanban/
├── src/
│   ├── manifest.xml                          # SuiteApp bundle metadata
│   ├── deploy.xml                            # Deployment paths (wildcard)
│   ├── FileCabinet/SuiteApps/
│   │   └── com.netsuite.opportunitykanban/
│   │       ├── portlet/
│   │       │   ├── opportunity-kanban.js     # Server-side portlet (HTML, CSS, data)
│   │       │   └── kanban-client.js          # Client board, filters, DnD
│   │       ├── suitelet/
│   │       │   └── update-opportunity-status.js
│   │       └── lib/
│   │           └── queries.js                # Search, periods, status columns
│   └── Objects/
│       ├── customscript_opp_kanban.xml
│       └── customscript_opp_kanban_update.xml
├── __tests__/                                # Jest unit tests (not deployed)
├── package.json
└── .eslintrc.json
```

## Development

### Run Tests

```bash
npm test              # Run all 95 tests
npm run test:watch    # Watch mode
```

### Lint

```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix
```

## License

[MIT](https://opensource.org/licenses/MIT)
