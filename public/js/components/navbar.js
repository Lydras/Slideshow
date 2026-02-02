import { getCurrentHash } from '../utils/router.js';

export function renderNavbar() {
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const links = [
    { hash: '#/slideshow', label: 'Slideshow', icon: '&#9654;' },
    { hash: '#/sources', label: 'Sources', icon: '&#128193;' },
    { hash: '#/playlists', label: 'Playlists', icon: '&#9776;' },
    { hash: '#/settings', label: 'Settings', icon: '&#9881;' },
  ];

  const currentHash = getCurrentHash();

  nav.innerHTML = `
    <div class="nav-brand">Slideshow</div>
    <div class="nav-links">
      ${links.map(l => `
        <a href="${l.hash}" class="nav-link ${currentHash === l.hash ? 'active' : ''}">
          <span class="nav-icon">${l.icon}</span>
          <span class="nav-label">${l.label}</span>
        </a>
      `).join('')}
    </div>
  `;
}

export function initNavbar() {
  const style = document.createElement('style');
  style.textContent = `
    #navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1.5rem;
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--glass-border);
      box-shadow: 0 1px 20px rgba(0, 0, 0, 0.2);
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .nav-brand {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--accent);
      letter-spacing: -0.02em;
    }
    .nav-links {
      display: flex;
      gap: 0.3rem;
    }
    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.45rem 0.85rem;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 0.85rem;
      font-weight: 500;
      transition: all var(--transition);
      border: 1px solid transparent;
    }
    .nav-link:hover {
      background: var(--glass-bg-hover);
      color: var(--text-primary);
      border-color: var(--glass-border);
    }
    .nav-link.active {
      background: var(--glass-bg-active);
      color: var(--accent);
      border-color: rgba(128, 255, 204, 0.15);
      box-shadow: inset 0 0 10px rgba(128, 255, 204, 0.1);
    }
    .nav-icon { font-size: 1rem; }

    @media (max-width: 600px) {
      .nav-label { display: none; }
      .nav-link { padding: 0.45rem 0.6rem; }
      #navbar { padding: 0.6rem 1rem; }
    }

    .slideshow-active #navbar { display: none; }
  `;
  document.head.appendChild(style);

  window.addEventListener('hashchange', renderNavbar);
  renderNavbar();
}
