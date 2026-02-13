# Changelog

All notable changes to the Opportunity Kanban Portlet are documented here.

## [2.5.0] - 2026-02-13

### Fixed — Quick Filter and Card Click-Through Now Working
- **Quick Filter buttons** — clicking filters cards by close date group, updates column counts, hides empty columns
- **Card body clicks** — navigates to opportunity record in same tab
- **Tranid link clicks** — opens opportunity record in new tab (via `<a href>`)

### Root Cause (discovered via diagnostic deploy v2.4.0)
NetSuite renders portlets inside an **iframe**, executes all scripts there, then extracts the rendered HTML into the main dashboard page. The iframe is destroyed, which means:
- `addEventListener` callbacks → **lost** (attached to destroyed iframe elements)
- `window`/`document` function assignments → **lost** (set on destroyed iframe objects)
- `onclick` attribute strings → **survive** (serialized as HTML attributes)
- But onclick strings referencing custom functions (e.g. `window._kanbanFilter`) → **fail** (functions lived on destroyed iframe)

### Solution: Fully Self-Contained onclick Attributes
All event handling uses onclick attribute strings containing **only built-in DOM APIs** — no custom function references:
- **Filter buttons**: onclick contains complete filter logic (~500 chars) — `querySelectorAll`, `style.display`, `getAttribute('data-cg')`, column count updates
- **Card clicks**: onclick reads `data-opp-id` from `this`, validates with `/^\d+$/`, navigates via `(window.top||window).location.href`
- **Tranid links**: onclick calls `event.stopPropagation()` to prevent card click
- External JS generates these strings via `makeFilterOnclick()` helper; matching `applyFilter()` function provides jsdom test path

### Changed
- Cards have `data-cg` attribute (close date group) for client-side filtering
- `buildBoard()` renders full dataset; filtering is show/hide (not DOM rebuild)
- Filter buttons are `<div role="button" tabindex="0">` with `aria-pressed` (avoids NS form interception)
- CSS: `display: inline-flex`, `user-select: none`, `:focus` outline on filter buttons
- Inline `<script>` is data-only (`window.KANBAN_DATA = ...`)

### Iteration History (v2.1–v2.4)
- **v2.1**: `addEventListener` approach — never worked (callbacks lost on iframe extraction)
- **v2.2**: `onclick` attrs + `window._kanbanFilter` — attrs fired but function not found (iframe `window` destroyed)
- **v2.3**: `document._kanbanFilter` + inline event delegation — also failed (iframe `document` also destroyed)
- **v2.4**: Diagnostic deploy with `console.log` — revealed `window===top: false` (iframe!), confirmed root cause

---

## [2.1.0] - 2026-02-12

### Fixed
- **Card click-through not working** — replaced `window.open()` (blocked by portlet sandboxing) with native `<a>` anchor on tranid + `window.top.location.href` fallback on card body
- **Status columns in wrong order** — changed sort from alphabetical by name to numeric entitystatus ID, which follows NetSuite's pipeline sequence
- **Long column titles overflow** — added CSS truncation (`text-overflow: ellipsis`) with flex constraints
- **Column title/count spacing** — added `gap: 8px` between truncated title and count badge

---

## [2.0.0] - 2026-02-12

### Changed
- **Clean slate reset** — wiped all application code and started fresh with CLI-generated SuiteApp shell
- Upgraded `@oracle/suitecloud-cli` from v1.x to v3.1.2
- npm scripts no longer `cd src` (v3 CLI uses `suitecloud.config.js` at project root)
- Archived previous CLAUDE.md to `archive/CLAUDE.md.v1` for reference

### Removed
- All SuiteScript files (portlet, suitelet, lib, installer, client JS)
- All script definition XMLs from `src/Objects/`
- `verify-environment.js`
- Vendored libraries and custom CSS

### Why
- Three iterations (v1.0 jKanban, v1.1 broken inline, v1.2 hybrid) failed to produce a reliably working portlet
- Starting from a clean, CLI-generated project shell to build correctly from the ground up

---

## [1.2.0] - 2026-02-12

### Fixed
- **All JS interactivity broken** — drag-and-drop, card click-through, and date filter all non-functional after v1.1.0 deploy
- Root cause: NetSuite portlet renderer does not execute large inline `<script>` blocks

### Changed
- Switched to hybrid delivery: external `kanban-client.js` loaded via `<script src>` (proven to work) + small inline `<script>` for data injection only
- Restored `N/file` dependency in portlet for resolving client JS URL
- Added JSON sanitization (`.replace(/<\//g, '<\\/')`) to prevent `</script>` injection in embedded data

### Architecture
- CSS remains inlined in `<style>` block (works reliably in portlets)
- Client JS is an external file with HTML5 DnD logic
- Data passed via small inline script setting `window.KANBAN_DATA` and `window.SUITELET_URL`

---

## [1.1.0] - 2026-02-12

### Changed
- **BROKEN** — Replaced jKanban + Dragula with vanilla JS using HTML5 Drag and Drop API
- Inlined ALL CSS and JS directly in portlet HTML string (no external files)
- Removed `N/file` dependency
- Removed vendored libraries: `jkanban.min.js`, `jkanban.min.css`, `dragula.min.js`
- Removed `css/kanban-custom.css` and `portlet/kanban-client.js`

### Known Issues
- Large inline `<script>` block does not execute in NetSuite portlet context
- All interactivity non-functional (drag, click, filter)

---

## [1.0.0] - 2026-02-12

### Initial Release
- Kanban board portlet for NetSuite dashboards
- jKanban library for board rendering
- Dragula library for drag-and-drop
- External CSS and JS files loaded via `N/file`
- Date filter dropdown with AJAX refresh
- Click-through to opportunity records

### Known Issues
- Dragula's global event listeners (`document.documentElement`) incompatible with NetSuite portlet sandboxing
- Drag-and-drop does not work — events from cards never reach Dragula's global listeners
- NetSuite re-renders portlet HTML multiple times, creating competing Dragula instances
