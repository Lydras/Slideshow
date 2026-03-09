# Frontend Development Guidelines

> Working conventions for the Slideshow browser UI.

---

## Overview

The frontend is a vanilla JavaScript single-page app served from `public/`. It relies on ES modules, hash-based routing, shared UI components, and screen-specific CSS files. Changes should keep the UI lightweight, understandable, and easy to debug in a self-hosted environment.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Active |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Active |
| [Hook Guidelines](./hook-guidelines.md) | Not applicable for this vanilla JS app | N/A |
| [State Management](./state-management.md) | Local state, route state, request state | Active |
| [Quality Guidelines](./quality-guidelines.md) | Code standards and testing expectations | Active |
| [Type Safety](./type-safety.md) | Runtime validation guidance for UI payloads | Active |

---

## Frontend Rules of Thumb

- Keep views thin: page modules should fetch data, render the main shell, and delegate reusable UI to `components/`.
- Prefer one primary path per workflow. Example: adding sources should happen through the guided wizard rather than parallel legacy setup screens.
- Avoid inline styles unless they are truly one-off and temporary. Shared visual language belongs in CSS.
- Keep route handling in `public/js/app.js` and `public/js/utils/router.js`; do not spread navigation logic across many files.
- Use defensive UI states: loading, empty, success, and error handling should be visible to the user.

---

**Language**: All documentation should be written in **English**.
