import { api } from '../api.js';
import { escapeHtml } from '../utils/dom.js';

export function createLocalBrowser({ onSelect }) {
  const container = document.createElement('div');
  container.className = 'local-browser';

  let currentResult = null;

  container.innerHTML = `
    <div class="local-browser-breadcrumb" id="lb-breadcrumb"></div>
    <div class="local-browser-list" id="lb-list">Loading...</div>
    <div class="local-browser-footer" id="lb-footer"></div>
  `;

  async function loadPath(browsePath) {
    const list = container.querySelector('#lb-list');
    const breadcrumb = container.querySelector('#lb-breadcrumb');
    const footer = container.querySelector('#lb-footer');
    list.innerHTML = '<div style="padding:1rem;color:var(--text-secondary)">Loading...</div>';

    try {
      currentResult = await api.browseLocal(browsePath || '');
      renderBreadcrumb(breadcrumb, currentResult.path);
      renderList(list, currentResult);
      renderFooter(footer, currentResult);
    } catch (err) {
      list.innerHTML = `<div style="padding:1rem;color:var(--error)">${escapeHtml(err.message)}</div>`;
      footer.innerHTML = '';
    }
  }

  function renderBreadcrumb(el, fullPath) {
    el.innerHTML = '';
    if (!fullPath) {
      el.textContent = 'Computer';
      return;
    }

    // Root link
    const rootLink = document.createElement('span');
    rootLink.className = 'lb-crumb';
    rootLink.textContent = 'Computer';
    rootLink.addEventListener('click', () => loadPath(''));
    el.appendChild(rootLink);

    // Split path into segments
    const parts = fullPath.replace(/\\/g, '/').split('/').filter(Boolean);
    let accumulated = '';

    for (let i = 0; i < parts.length; i++) {
      const sep = document.createElement('span');
      sep.className = 'lb-sep';
      sep.textContent = ' / ';
      el.appendChild(sep);

      accumulated += (i === 0 && fullPath.match(/^[A-Z]:/i)) ? parts[i] + '\\' : (accumulated ? '\\' : '') + parts[i];
      // For Windows drive letters, first part is like "E:"
      const segmentPath = i === 0 && parts[i].match(/^[A-Z]:$/i) ? parts[i] + '\\' : accumulated;

      const crumb = document.createElement('span');
      crumb.className = 'lb-crumb';
      crumb.textContent = parts[i];
      if (i < parts.length - 1) {
        const pathCapture = segmentPath;
        crumb.addEventListener('click', () => loadPath(pathCapture));
      } else {
        crumb.classList.add('lb-crumb-current');
      }
      el.appendChild(crumb);
    }
  }

  function renderList(el, result) {
    el.innerHTML = '';

    // Parent directory link
    if (result.parent) {
      const parentItem = document.createElement('div');
      parentItem.className = 'lb-item lb-item-dir';
      parentItem.innerHTML = '<span class="lb-icon">&#128193;</span> ..';
      parentItem.addEventListener('click', () => loadPath(result.parent));
      el.appendChild(parentItem);
    }

    if (result.entries.length === 0) {
      el.innerHTML = '<div style="padding:1rem;color:var(--text-secondary)">Empty directory</div>';
      return;
    }

    for (const entry of result.entries) {
      const item = document.createElement('div');
      item.className = `lb-item ${entry.type === 'directory' ? 'lb-item-dir' : 'lb-item-file'}`;

      if (entry.type === 'directory') {
        item.innerHTML = `<span class="lb-icon">&#128193;</span> ${escapeHtml(entry.name)}`;
        item.addEventListener('click', () => loadPath(entry.path));
      } else {
        item.innerHTML = `<span class="lb-icon">&#128444;</span> ${escapeHtml(entry.name)}`;
      }
      el.appendChild(item);
    }

    // Pagination
    if (result.pages > 1) {
      const pager = document.createElement('div');
      pager.className = 'lb-pager';
      pager.textContent = `Page ${result.page} of ${result.pages}`;
      if (result.page < result.pages) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn-secondary btn-small';
        nextBtn.textContent = 'Next';
        nextBtn.addEventListener('click', async () => {
          const next = await api.browseLocal(result.path, result.page + 1);
          currentResult = next;
          renderList(el, next);
        });
        pager.appendChild(nextBtn);
      }
      el.appendChild(pager);
    }
  }

  function renderFooter(el, result) {
    el.innerHTML = '';
    if (!result.path) return;

    const info = document.createElement('div');
    info.className = 'lb-info';
    info.textContent = `${result.dirCount || 0} folders, ${result.imageCount || 0} images`;
    el.appendChild(info);

    const selectBtn = document.createElement('button');
    selectBtn.className = 'btn-primary';
    selectBtn.textContent = `Select this folder`;
    selectBtn.addEventListener('click', () => {
      if (onSelect) onSelect(result.path);
    });
    el.appendChild(selectBtn);
  }

  loadPath('');
  return container;
}

