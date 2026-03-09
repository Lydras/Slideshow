# Directory Structure

> How frontend code is organized in this project.

---

## Overview

The browser UI lives under `public/` and is split by responsibility:

- `public/js/app.js`: route registration and app bootstrap
- `public/js/views/`: top-level screens such as Sources, Playlists, Settings, Login, and Slideshow
- `public/js/components/`: reusable UI pieces such as the navbar, modals, source wizard, photo picker, and browser widgets
- `public/js/utils/`: DOM helpers, router helpers, and fullscreen utilities
- `public/css/`: shared design system plus screen-specific stylesheets

---

## Directory Layout

```text
public/
|-- index.html
|-- css/
|   |-- main.css         # Design tokens, layout primitives, typography
|   |-- components.css   # Shared component styling
|   |-- sources.css      # Sources screen styling
|   |-- playlists.css    # Playlists screen styling
|   |-- settings.css     # Settings and login layouts
|   \-- slideshow.css   # Fullscreen slideshow styling
\-- js/
    |-- app.js
    |-- api.js
    |-- views/
    |-- components/
    \-- utils/
```

---

## Module Organization

- Add new full-page features in `views/`.
- Add reusable UI in `components/` when it is shared across views or substantially complex.
- Keep API calls centralized in `public/js/api.js`.
- Prefer screen-specific CSS over deeply nested component-specific inline styles.

---

## Naming Conventions

- Views: `{feature}View.js`
- Components: noun-based filenames such as `navbar.js`, `modal.js`, `sourceWizard.js`
- CSS: one shared file plus one file per major screen or system
- Hash routes should map closely to their view filenames

---

## Examples

- `public/js/views/sourcesView.js` is the reference for a data-heavy management screen.
- `public/js/components/sourceWizard.js` is the reference for a multi-step guided workflow.
- `public/js/views/slideshowView.js` is the reference for a focused, mode-specific display screen.
