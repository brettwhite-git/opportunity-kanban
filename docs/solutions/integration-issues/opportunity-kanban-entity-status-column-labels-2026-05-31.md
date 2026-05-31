---
title: Kanban portlet shows STATUS N column headers and ENTITYSTATUS render errors
date: 2026-05-31
category: docs/solutions/integration-issues/
module: Opportunity Kanban
problem_type: integration_issue
component: tooling
symptoms:
  - "CRM and Sales Manager roles see column headers like STATUS 9 instead of In Discussion or Closed Won"
  - "Script log OpportunityKanban.render error: The record type [ENTITYSTATUS] is invalid"
  - "Red portlet message Error loading kanban board. Check script logs for some roles"
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags:
  - netsuite
  - portlet
  - entitystatus
  - suitescript
  - opportunity-kanban
  - sales-rep
---

# Kanban portlet shows STATUS N column headers and ENTITYSTATUS render errors

## Problem

When the **Opportunity Status Filter** deployment parameter lists fixed status internal IDs, the kanban portlet showed generic headers (`STATUS 8`, `STATUS 9`, …) for sales roles, or failed to render entirely. Administrators and reps with opportunities in only some statuses saw a mix of real names and fallbacks.

## Symptoms

- Column headers like **STATUS 9** / **STATUS 10** instead of pipeline stage names.
- **Opportunity Kanban** portlet error: `Error loading kanban board. Check script logs.`
- Execution log: `OpportunityKanban.render` → `The record type [ENTITYSTATUS] is invalid.` (Ed Sullivan, Tracie Windbourne, Burt Brocus).
- KPI meters may still show open opportunity counts while the board shows **0** cards (separate `salesrep` filter scope).

## What Didn't Work

1. **Inferring names only from the current rep’s opportunity search rows** — `buildStatusColumns()` mapped `entitystatusText` only from `getOpportunitiesByUser()`. Reps with no opps in a configured status never supplied a label → fallback `'Status ' + id`.
2. **`search.create({ type: 'entitystatus', filters: [['type', 'anyof', 'Opprtnty']] })`** — Threw at render time and broke the whole portlet for all roles.
3. **`record.load({ type: 'entitystatus', id })`** — NetSuite error: **ENTITYSTATUS is not a valid loadable record type**. Per-id `try/catch` still logged errors; uncaught paths surfaced as `OpportunityKanban.render` failures.

## Solution

Resolve status display names in `lib/queries.js` without `record.load` or entitystatus search:

1. **SuiteQL** (primary): `SELECT key, name FROM entitystatus WHERE key IN (?)`
2. **Grouped opportunity search** (fallback, no `salesrep` filter): `search.Type.OPPORTUNITY` with `entitystatus` summary `GROUP` + `getText` for labels still missing after SuiteQL
3. **Overlay** opportunity row text when present: `opp.entitystatusText` from the rep’s search
4. **Never** call `record.load` on `entitystatus`

```javascript
// queries.js — loadEntityStatusNames (pattern)
loadEntityStatusNamesFromSuiteQL(statusIds, nameById);
loadEntityStatusNamesFromOpportunitySearch(missingIds, nameById); // account-wide, script role
// record.load('entitystatus') — do not use
```

Wrap each strategy in `try/catch` so a single failure returns `{}` for names instead of aborting `render()`.

### Related fixes in the same session (same portlet)

| Issue | Fix |
|-------|-----|
| Filter checkboxes empty on first open | Sync `checked` **attribute** and `.checked` after portlet HTML extraction (`kanban-client.js`) |
| Filter apply hook early `return` killed DnD | Restructure hidden apply-hook `onclick` without aborting whole handler |
| Save permission “Manage Accounting Periods” | Pass `closedAccountingRanges` from board data; parse in suitelet — no accounting-period search on every drag |
| Optimistic drag `removeChild` errors | Optimistic DOM move + revert on failed save |

## Why This Works

- **Param-driven columns** must show labels for statuses with **zero** cards for the current rep; only a master list lookup (SuiteQL / account opportunity search) can supply those names.
- **Entity status** in NetSuite is a list/reference type exposed via search and SuiteQL, not via `N/record.load` — the execution log error is literal.
- Portlet runs with **`runasrole` Administrator** on deployment, so account-wide SuiteQL and opportunity searches are appropriate for label resolution; card data remains filtered by `salesrep` in `getOpportunitiesByUser()`.

## Prevention

- Do **not** use `N/record.load` for `entitystatus` (or assume any status list is loadable — verify in execution log).
- For fixed pipeline columns from script parameters, **always** resolve labels from SuiteQL or a grouped search, not only from the current user’s opportunity rows.
- Add unit tests in `__tests__/queries.test.js` for `loadEntityStatusNames` (SuiteQL + opportunity search fallback) and `buildStatusColumns` with empty opportunity arrays.
- After deploy, verify with a **non-admin sales role** that has the status filter configured but few/zero opps in some columns.
- Document portlet constraints in README (`> [!IMPORTANT]`): inline handlers, `checked` attributes, sandbox testing.

## Related Issues

- README: portlet extraction and disclaimer (`README.md`)
- Prior portlet pattern: inline `onclick` only survives iframe extraction (CHANGELOG 2.5.0)

## Note: Sales Manager sees zero cards

The board loads opportunities where **`salesrep` = current user**. A manager with “sales rep” checked on the employee record but no opportunities assigned as sales rep will see correct column **headers** and empty columns. Team/manager rollup is a separate product change, not fixed by status label lookup.
