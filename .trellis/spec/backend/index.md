# Backend Development Guidelines

> Working conventions for the Slideshow server and services.

---

## Overview

The backend is a small Express app with SQLite persistence through `better-sqlite3`. Business logic lives in service modules, routes stay thin, and migrations are incremental.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Active |
| [Database Guidelines](./database-guidelines.md) | SQLite access and migrations | Active |
| [Error Handling](./error-handling.md) | Error propagation and route behavior | Active |
| [Quality Guidelines](./quality-guidelines.md) | Code standards and testing expectations | Active |
| [Logging Guidelines](./logging-guidelines.md) | Console logging and operational notes | Active |

---

## Backend Rules of Thumb

- Keep routes responsible for parsing requests, validation, and response codes.
- Put persistence and feature behavior in `services/`.
- Prefer incremental migrations and compatibility over destructive schema resets.
- Treat the app as self-hosted but still guard sensitive operations and credentials carefully.
- When a workflow depends on persisted ids, preserve behavior across rescans or updates whenever file-path-based reconciliation is possible.

---

**Language**: All documentation should be written in **English**.
