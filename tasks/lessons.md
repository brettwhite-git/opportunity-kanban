# Lessons Learned

## NetSuite Portlet iframe Rendering (CRITICAL)

**Discovery date**: 2026-02-13

NetSuite HTML portlets render inside an **iframe**. Scripts execute in the iframe context, then NetSuite extracts the rendered HTML (preserving attributes) into the main dashboard page. The iframe is destroyed.

**What survives**: HTML attributes (`href`, `onclick` strings, `data-*`, `class`, `style`)
**What is destroyed**: Everything in JavaScript runtime — `window`/`document` custom properties, `addEventListener` callbacks, closures, module state

**Rule**: All interactive behavior must be encoded in **self-contained onclick attribute strings** using only built-in DOM APIs. No custom function references (`window.myFunc`, `document.myFunc`). No event delegation. No addEventListener.

**Proven pattern**:
- External JS builds DOM with self-contained onclick attribute strings
- `.onclick` property set for jsdom test compatibility (jsdom doesn't evaluate onclick attribute strings)
- `makeFilterOnclick()` generates the attribute string; `applyFilter()` is the equivalent JS function for tests

**Diagnostic approach**: Add `console.log` with `window===top` check to confirm iframe boundary. Deploy, check console, iterate.
