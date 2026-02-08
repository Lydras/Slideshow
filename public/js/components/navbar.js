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
  window.addEventListener('hashchange', renderNavbar);
  renderNavbar();
}
