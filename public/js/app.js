import { registerRoute, initRouter } from './utils/router.js';
import { initNavbar } from './components/navbar.js';
import { renderSlideshowView } from './views/slideshowView.js';
import { renderSettingsView } from './views/settingsView.js';
import { renderSourcesView } from './views/sourcesView.js';
import { renderPlaylistsView } from './views/playlistsView.js';
import { renderReviewQueueView } from './views/reviewQueueView.js';
import { renderLoginView } from './views/loginView.js';
import { api } from './api.js';

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

registerRoute('#/slideshow', renderSlideshowView);
registerRoute('#/login', renderLoginView);
registerRoute('#/review-queue', withAuth(renderReviewQueueView));
registerRoute('#/settings', withAuth(renderSettingsView));
registerRoute('#/sources', withAuth(renderSourcesView));
registerRoute('#/playlists', withAuth(renderPlaylistsView));

initNavbar();
initRouter();
