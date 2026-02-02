# Slideshow

A self-hosted web application for displaying photo slideshows from multiple sources. Supports local folders, Dropbox, and Plex media servers. Designed to run on your local network so any device with a browser can display your photos.

## Features

- **Multiple source types** -- Add photos from local directories, Dropbox accounts, or Plex photo libraries
- **Plex album browsing** -- Browse Plex photo libraries by album with drill-down navigation; select individual albums or entire libraries
- **Playlists** -- Organize sources into playlists and pick which images to include
- **Slideshow display** -- Full-screen slideshow with configurable interval, transition effects (fade, slide, none), and sequential or random ordering
- **Image caching** -- Downloaded images are cached locally with thumbnail generation for fast browsing
- **Optional authentication** -- Password-protect the admin UI while keeping the slideshow display publicly accessible on your network
- **Responsive UI** -- Dark theme with glassmorphism design, works on desktop and mobile

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later

## Getting Started

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The server starts on `http://0.0.0.0:3000` by default and prints any LAN IP addresses for easy access from other devices.

### Configuration

Copy the example environment file and adjust as needed:

```bash
cp .env.example .env
```

| Variable   | Default       | Description           |
|------------|---------------|-----------------------|
| `PORT`     | `3000`        | Server listen port    |
| `HOST`     | `0.0.0.0`     | Server bind address   |
| `NODE_ENV` | `development` | Node environment mode |

## Usage

1. Open the app in a browser and go to **Sources**
2. Add a source (local folder, Dropbox, or Plex)
3. Go to **Playlists** to create a playlist from your sources
4. Open the **Slideshow** view to start displaying photos

### Source Types

| Type    | Description |
|---------|-------------|
| Local   | A folder on the server's filesystem. Supports subfolder scanning. |
| Dropbox | Connect a Dropbox account via OAuth and select a folder. |
| Plex    | Connect to a Plex server, browse photo libraries and albums. |

### Authentication

Authentication is optional. Set a password in **Settings** to protect the admin views (Sources, Playlists, Settings). The slideshow display and image endpoints remain publicly accessible so any screen on your network can show the slideshow without logging in.

## Project Structure

```
├── server.js              # Entry point
├── src/
│   ├── app.js             # Express app setup
│   ├── config/            # Constants and default settings
│   ├── db/                # SQLite database (better-sqlite3) and migrations
│   ├── middleware/         # Auth, security (Helmet, rate limiting), error handling
│   ├── routes/            # API routes (sources, playlists, images, settings, etc.)
│   └── services/          # Business logic (scanning, caching, Plex, Dropbox, etc.)
├── public/
│   ├── index.html         # SPA shell
│   ├── css/               # Stylesheets
│   └── js/                # Frontend (vanilla JS, ES modules)
│       ├── app.js         # Router and view registration
│       ├── api.js         # API client
│       ├── views/         # Page views
│       ├── components/    # Reusable UI components
│       └── utils/         # Router, helpers
└── data/                  # Runtime data (SQLite DB, cache, thumbnails) -- gitignored
```

## Tech Stack

- **Backend:** Node.js, Express, better-sqlite3
- **Frontend:** Vanilla JavaScript (ES modules), CSS
- **Image processing:** Sharp
- **Security:** Helmet, express-rate-limit, express-validator
- **Integrations:** Dropbox SDK, Plex API

## Development

```bash
# Start with auto-reload
npm run dev

# Run tests
npm test
```

## License

This project does not currently specify a license.
