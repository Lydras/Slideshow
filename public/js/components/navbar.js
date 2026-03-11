import { getCurrentHash } from '../utils/router.js';

export function renderNavbar() {
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const links = [
    { hash: '#/slideshow', label: 'Slideshow', icon: '&#9654;' },
    { hash: '#/review-queue', label: 'Review Queue', icon: '&#11088;' },
    { hash: '#/sources', label: 'Sources', icon: '&#128193;' },
    { hash: '#/playlists', label: 'Playlists', icon: '&#9776;' },
    { hash: '#/settings', label: 'Settings', icon: '&#9881;' },
  ];

  const currentHash = getCurrentHash().split('?')[0];

  nav.innerHTML = `
    <div class="nav-brand">
      <div class="nav-mark">S</div>
      <div class="nav-brand-copy">
        <span class="nav-title">Slideshow</span>
        <span class="nav-subtitle">Home gallery control</span>
      </div>
    </div>
    <div class="nav-links">
      ${links.map(link => `
        <a href="${link.hash}" class="nav-link ${currentHash === link.hash ? 'active' : ''}">
          <span class="nav-icon">${link.icon}</span>
          <span class="nav-label">${link.label}</span>
        </a>
      `).join('')}
    </div>
  `;
}

export function initNavbar() {
  window.addEventListener('hashchange', renderNavbar);
  renderNavbar();
}
