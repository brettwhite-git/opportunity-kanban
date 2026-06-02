---
title: Kanban probability blank on initial portlet load
date: 2026-06-01
category: docs/solutions/ui-bugs/
module: queries
problem_type: ui_bug
component: development_workflow
symptoms:
  - "Probability badge empty on first board render for most cards"
  - "Probability appears only after drag-and-drop status change"
  - "N/format fallback showed 0.5% instead of 50.0% on initial load"
root_cause: wrong_api
resolution_type: code_fix
severity: medium
tags:
  - netsuite
  - suitescript
  - portlet
  - kanban
  - probability
  - search-api
  - lookupfields
related_components:
  - opportunity-kanban portlet
  - update-opportunity-status suitelet
---

# Kanban probability blank on initial portlet load

## Problem

Kanban card probability badges were empty when the portlet first loaded, even though opportunities had probability values in NetSuite. After dragging a card to a new status, the badge updated correctly (e.g. `75.0%`). Initial data is built from `N/search` in `lib/queries.js`; post-drag updates use `record.getText` in the update suitelet.

## Symptoms

- `.kanban-card-probability` spans blank on first paint for most cards.
- One or few cards might show probability when search `getText` happens to populate.
- After a successful drop, the suitelet JSON includes `probability` and the client sets `textContent` correctly.
- `KANBAN_DATA` opportunities had `probability: ""` from the search path.

## What Didn't Work

1. **Client-side `getValue` + `'%'`** — Search/record storage uses decimals (`0.5` = 50%); manual suffix produced wrong labels.
2. **`result.getText({ name: 'probability' })` only** — Often empty for percent columns in opportunity saved searches even when the field has a value.
3. **`N/format` on `getValue`** — Mis-scaled percent values (`0.5` → `0.5%` instead of `50.0%`). (session history)
4. **`search.lookupFields` assuming array-only shape** — Code only read `probability[0].text`; NetSuite also returns `{ text, value }` objects or scalar strings, so the fallback still returned `''`.

## Solution

### Three-tier resolver on initial load (`queries.js`)

`resolveSearchProbabilityDisplay(result)`:

1. Trimmed `result.getText({ name: 'probability' })` when non-empty.
2. `search.lookupFields` on the opportunity id → `extractLookupProbabilityText` handles:
   - Array: `[{ text, value }]`
   - Object: `{ text, value }`
   - Scalar: use as-is only if it already contains `%` (do not treat raw decimals as display text).
3. `record.load` + `record.getText({ fieldId: 'probability' })` when lookup has no display text (same API as post-drag).

```javascript
const resolveSearchProbabilityDisplay = (result) => {
    const text = result.getText({ name: 'probability' });
    if (text != null && String(text).trim() !== '') {
        return String(text).trim();
    }
    const lookup = search.lookupFields({
        type: search.Type.OPPORTUNITY,
        id: result.id,
        columns: ['probability']
    });
    const fromLookup = extractLookupProbabilityText(lookup.probability);
    if (fromLookup) {
        return fromLookup;
    }
    return readRecordProbabilityDisplay(result.id);
};
```

### Post-drag path (unchanged)

`update-opportunity-status.js` uses `readProbabilityDisplay(rec)` → `rec.getText({ fieldId: 'probability' })` after `submitFields` with `enableSourcing: true`.

### Client (unchanged)

`kanban-client.js` assigns `opp.probability` / `d.probability` to `.kanban-card-probability` as-is — no client-side percent formatting.

## Why This Works

- **Display text, not storage value:** NetSuite percent fields expose UI strings via `getText` / lookup `.text`, not via raw `getValue` or generic `N/format`.
- **Search gap filled:** `lookupFields` returns formatted text in varied shapes; parsing all shapes avoids silent empty fallbacks.
- **Record fallback aligns paths:** `readRecordProbabilityDisplay` mirrors the suitelet so initial load and post-drag show the same strings.
- **Server resolves once:** Client remains a dumb string renderer.

## Prevention

- For percent fields shown in UI, use **`getText` or `lookupFields` `.text`** as the display contract — not `getValue` or `N/format`.
- When using `search.lookupFields`, handle **array, object, and scalar** return shapes; only trust scalars that already include `%`.
- Add Jest cases for each lookup shape and for record fallback when lookup returns a raw decimal.
- On “empty until interaction” portlet bugs, compare **search/lib initial path** vs **record/suitelet mutation path** before changing client DnD or CSS.
- See also: `docs/solutions/integration-issues/opportunity-kanban-entity-status-column-labels-2026-05-31.md` for other `N/search` vs `record.load` pitfalls on this portlet.

## Related Issues

- PR: fix/kanban-probability-on-drag
- Plan (superseded): `docs/plans/2026-06-01-001-fix-kanban-probability-display-plan.md`
