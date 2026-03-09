# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

Backend quality here means predictable routes, careful DB updates, safe file access, and tests around the workflows most likely to regress.

---

## Forbidden Patterns

- Putting business logic directly inside route handlers.
- Deleting and recreating persisted relationships without preserving user intent when a stable key exists.
- Accepting unchecked ids or arrays from the client.
- Expanding the API surface for convenience when an internal cleanup would solve the problem.

---

## Required Patterns

- Validate request payloads at the route boundary.
- Use transactions for multi-step DB changes that must stay consistent.
- Return useful 4xx errors for invalid user input.
- Keep auth/public route behavior explicit in middleware rather than implied by route order alone.

---

## Testing Requirements

- Cover route behavior for auth gates, settings updates, and core CRUD.
- Cover service behavior for workflows that rewrite DB rows, especially scans and selection preservation.
- Run tests against isolated temporary data directories rather than the real app data folder.

---

## Code Review Checklist

- Are DB writes grouped transactionally where needed?
- Does the change preserve existing data compatibility?
- Are route validations aligned with the payload the frontend sends?
- Could a rescan, delete, or failed integration call leave inconsistent state?
- Is the behavior easy to exercise with a focused automated test?
