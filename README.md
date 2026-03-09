# Slideshow Gallery

Slideshow is a self-hosted photo slideshow app for a local network. It lets you connect photo sources, curate playlists, and run a fullscreen display view that stays accessible even when the admin UI is password protected.

## What It Supports

- Local folders on the machine running the server
- Dropbox folders via OAuth
- Plex photo libraries and album browsing
- Source-level and playlist-level photo selection
- Fullscreen slideshow playback with interval, order, and transition controls
- Local thumbnail generation and remote image caching
- Optional admin authentication for Sources, Playlists, and Settings

## Tech Stack

- Backend: Node.js, Express, better-sqlite3
- Frontend: Vanilla JavaScript modules and CSS
- Image processing: Sharp
- Integrations: Dropbox SDK and Plex HTTP APIs

## Requirements

- Node.js 18+

## Getting Started

```bash
npm install
cp .env.example .env
npm start
```

By default the server listens on `http://0.0.0.0:3000` and prints LAN-accessible URLs on startup.

## Main Workflow

1. Open the app in a browser.
2. Go to **Sources** and use the guided source wizard.
3. Scan the source and review which photos are selected.
4. Optionally create playlists from your connected sources.
5. Open **Slideshow** to start playback.

## Authentication Behavior

Authentication is optional.

- When disabled, the entire admin UI is open.
- When enabled, the admin screens require login.
- The slideshow display, slideshow image endpoints, and the read-only settings needed for playback remain accessible so a TV or kiosk screen can keep running without signing in.

## Scripts

```bash
npm run lint      # Lightweight syntax checks for app JS files
npm test          # App-focused Jest suite
npm run test:app  # Same as npm test
npm run dev       # Start with nodemon
```

## Project Layout

```text
server.js
src/
|-- app.js
|-- config/
|-- db/
|-- middleware/
|-- routes/
|-- services/
\-- utils/
public/
|-- index.html
|-- css/
\-- js/
data/             # Runtime database, cache, thumbnails, and keys
```

## Notes

- App data is stored under `data/` by default.
- Tests use an isolated temporary data directory and do not touch the real app database.
- The admin UI is intentionally hash-routed and does not require a frontend build step.

## Future Enhancements

- Add Immich as a first-class source integration, with support for locally hosted Immich instances alongside local folders, Dropbox, and Plex.
