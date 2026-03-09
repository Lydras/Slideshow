# Directory Structure

> How backend code is organized in this project.

---

## Overview

The server code lives in `src/` and is organized by concern instead of by framework boilerplate.

---

## Directory Layout

```text
src/
|-- app.js               # Express app factory
|-- config/              # Constants and default setting values
|-- db/                  # SQLite connection and migrations
|-- middleware/          # Auth, security, validation, error handling
|-- routes/              # HTTP route modules
|-- services/            # Business logic and persistence workflows
\-- utils/              # Small shared helpers
```

---

## Module Organization

- `routes/` should stay thin and mostly delegate to services.
- `services/` should own DB writes, integration logic, and cross-route business rules.
- `db/` is the source of truth for schema and migration sequencing.
- `utils/` is for small helpers, not hidden business logic.

---

## Naming Conventions

- Service modules use `{feature}Service.js`
- Route modules use the feature/resource name
- Utility modules should describe the one job they do
- Migration logic stays centralized in `src/db/migrations.js`

---

## Examples

- `src/services/sourceService.js` coordinates source CRUD, scans, and selection persistence.
- `src/services/playlistService.js` handles playlist/source/photo relationships.
- `src/routes/settings.js` shows the preferred route pattern: validate, delegate, respond.
