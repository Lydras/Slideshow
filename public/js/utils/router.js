const routes = {};
let currentView = null;

export function registerRoute(hash, viewFn) {
  routes[hash] = viewFn;
}

export function navigateTo(hash) {
  if (window.location.hash === hash) {
    // Hash is already set — hashchange won't fire, so trigger routing manually
    handleRoute();
  } else {
    window.location.hash = hash;
  }
}

export function getCurrentHash() {
  return window.location.hash || '#/slideshow';
}

export function getHashParams() {
  const hash = getCurrentHash();
  const qIndex = hash.indexOf('?');
  if (qIndex === -1) return {};
  const params = {};
  new URLSearchParams(hash.slice(qIndex + 1)).forEach((v, k) => { params[k] = v; });
  return params;
}

async function handleRoute() {
  const hash = getCurrentHash();
  // Strip query params for route matching
  const basePath = hash.split('?')[0];
  const viewFn = routes[basePath];

  if (currentView && currentView.destroy) {
    currentView.destroy();
  }

  if (viewFn) {
    currentView = await viewFn();
  } else {
    // Default to slideshow
    const defaultView = routes['#/slideshow'];
    if (defaultView) {
      currentView = await defaultView();
    }
  }
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
