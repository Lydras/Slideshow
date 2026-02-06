import { escapeHtml } from '../utils/dom.js';
import { showToast } from './toast.js';
import { api } from '../api.js';

export function createFolderBrowser({ credentialId, service, onSelect }) {
  const container = document.createElement('div');
  container.className = 'folder-browser';
  container.innerHTML = `
    <div class="folder-browser-path" id="fb-path">/</div>
    <div class="folder-browser-list" id="fb-list">Loading...</div>
  `;

  addBrowserStyles();

  let currentPath = '';

  async function loadFolder(path) {
    currentPath = path;
    const pathDisplay = container.querySelector('#fb-path');
    const list = container.querySelector('#fb-list');

    pathDisplay.textContent = path || '/';
    list.innerHTML = 'Loading...';

    try {
      let folders;
      if (service === 'dropbox') {
        folders = await api.getDropboxFolders(credentialId, path);
      } else if (service === 'plex') {
        folders = await api.getPlexLibraryItems(credentialId, path);
      }

      list.innerHTML = '';

      if (path) {
        const parentPath = path.substring(0, path.lastIndexOf('/'));
        const upItem = document.createElement('div');
        upItem.className = 'folder-item';
        upItem.innerHTML = '&#128193; ..';
        upItem.addEventListener('click', () => loadFolder(parentPath));
        list.appendChild(upItem);
      }

      if (folders && folders.length > 0) {
        folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        for (const folder of folders) {
          const item = document.createElement('div');
          item.className = 'folder-item';
          item.innerHTML = `&#128193; ${escapeHtml(folder.name)}`;
          item.addEventListener('click', () => loadFolder(folder.path));
          list.appendChild(item);
        }
      } else if (!path) {
        list.innerHTML = '<p style="padding:0.5rem;color:var(--text-secondary)">No folders found.</p>';
      }

      // Select button
      const selectBtn = document.createElement('button');
      selectBtn.className = 'btn-primary mt-1';
      selectBtn.textContent = `Select: ${path || '/'}`;
      selectBtn.addEventListener('click', () => onSelect(currentPath));
      list.appendChild(selectBtn);

    } catch (err) {
      list.innerHTML = `<p style="color:var(--error)">Error: ${escapeHtml(err.message)}</p>`;
    }
  }

  loadFolder('');
  return container;
}

function addBrowserStyles() {
  if (document.getElementById('folder-browser-styles')) return;
  const style = document.createElement('style');
  style.id = 'folder-browser-styles';
  style.textContent = `
    .folder-browser { max-height: 400px; overflow-y: auto; }
    .folder-browser-path {
      padding: 0.6rem 0.85rem;
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm); margin-bottom: 0.5rem;
      font-size: 0.85rem; color: var(--text-secondary);
    }
    .folder-item {
      padding: 0.5rem 0.6rem; cursor: pointer; border-radius: var(--radius-sm);
      font-size: 0.9rem;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid transparent;
    }
    .folder-item:hover {
      background: var(--glass-bg-hover);
      border-color: var(--glass-border);
    }
  `;
  document.head.appendChild(style);
}
