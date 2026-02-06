import { registerRoute, initRouter } from './utils/router.js';
import { initNavbar } from './components/navbar.js';
import { renderSlideshowView } from './views/slideshowView.js';
import { renderSettingsView } from './views/settingsView.js';
import { renderSourcesView } from './views/sourcesView.js';
import { renderPlaylistsView } from './views/playlistsView.js';
import { renderDropboxAuthView } from './views/dropboxAuthView.js';
import { renderPlexSetupView } from './views/plexSetupView.js';
import { renderLoginView } from './views/loginView.js';
import { api, setAuthToken } from './api.js';

// Auth-protected route wrapper
function withAuth(viewFn) {
  return async () => {
    try {
      const status = await api.getAuthStatus();
      if (status.enabled && !status.authenticated) {
        return renderLoginView();
      }
    } catch (err) {
      console.warn('Auth check failed, rendering anyway:', err.message);
    }
    return viewFn();
  };
}

// Register routes
registerRoute('#/slideshow', renderSlideshowView); // Public - no auth
registerRoute('#/login', renderLoginView);           // Public - login page
registerRoute('#/settings', withAuth(renderSettingsView));
registerRoute('#/sources', withAuth(renderSourcesView));
registerRoute('#/playlists', withAuth(renderPlaylistsView));
registerRoute('#/dropbox/callback', renderDropboxAuthView);
registerRoute('#/plex/setup', renderPlexSetupView);

// Initialize
initNavbar();
initRouter();
