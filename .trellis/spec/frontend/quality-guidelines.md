# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Frontend quality in this project means readable modules, resilient async flows, and a consistent user experience in a no-build, vanilla JS environment.

---

## Forbidden Patterns

- Parallel feature flows that do the same job in different ways.
- Silent failures that only log to the console without giving the user any feedback.
- Large HTML strings mixed with complicated business logic in the same block when a helper or component would simplify it.
- Ad hoc DOM mutation spread across unrelated files.

---

## Required Patterns

- Use `showToast` or an equivalent visible state for user-facing success/error events.
- Keep fetch logic behind `api.js` so auth headers and error handling stay centralized.
- Escape user-controlled text before interpolating it into HTML.
- Always render an explicit empty state for collection screens.

---

## Testing Requirements

- Critical route/view behavior should be covered by app-focused tests when practical.
- UI-only changes should still be verified manually on desktop and mobile widths.
- Any workflow that creates or deletes persisted data must be tested against its edge cases.

---

## Code Review Checklist

- Does the view keep a single primary user path?
- Are loading, empty, and error states clear?
- Are button labels and section headings user-friendly?
- Does the change preserve auth handling and route consistency?
- Does the UI still work on narrow screens?
