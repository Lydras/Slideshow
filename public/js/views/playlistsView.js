import { api } from '../api.js';
import { showToast } from '../components/toast.js';
import { showModal } from '../components/modal.js';
import { createPhotoPicker } from '../components/photoPicker.js';
import { $, escapeHtml } from '../utils/dom.js';

let activePlaylistId = '';

export async function renderPlaylistsView() {
  const viewContainer = $('#view');
  let playlists = [];
  let sources = [];
  let settings = {};

  try {
    [playlists, sources, settings] = await Promise.all([
      api.getPlaylists(),
      api.getSources(),
      api.getSettings(),
    ]);
    activePlaylistId = settings.active_playlist_id || '';
  } catch (err) {
    showToast('Failed to load playlists', 'error');
  }

  viewContainer.innerHTML = `
    <div class="view-container">
      <div class="flex-between mb-2">
        <h1>Playlists</h1>
        <button class="btn-primary" id="btn-add-playlist">+ New Playlist</button>
      </div>
      <div class="playlist-list" id="playlist-list">
        ${playlists.length === 0 ? `
          <div class="empty-state">
            <p>No playlists yet. Create one to organize your sources.</p>
          </div>
        ` : playlists.map(p => renderPlaylistCard(p, sources)).join('')}
      </div>
    </div>
    <div id="playlist-modal"></div>
  `;

  $('#btn-add-playlist').addEventListener('click', () => showPlaylistModal('New Playlist', {}, async (data) => {
    await api.createPlaylist(data);
    showToast('Playlist created', 'success');
    renderPlaylistsView();
  }));

  bindPlaylistActions(sources);

  return { destroy() {} };
}

function renderPlaylistCard(playlist, sources) {
  const isActive = String(playlist.id) === String(activePlaylistId);
  const playlistSources = (playlist.sources || []).map(ps => {
    const src = sources.find(s => s.id === ps.source_id);
    return src ? src.name : `Source #${ps.source_id}`;
  });

  return `
    <div class="card playlist-card" data-id="${playlist.id}">
      <div class="playlist-info">
        <h3>
          ${escapeHtml(playlist.name)}
          ${isActive ? '<span class="playlist-active-badge">Active</span>' : ''}
        </h3>
        ${playlist.description ? `<div class="playlist-description">${escapeHtml(playlist.description)}</div>` : ''}
        <div class="playlist-sources-count">${playlistSources.length} source(s)</div>
        ${playlistSources.length > 0 ? `
          <div class="playlist-sources-list">
            ${playlistSources.map(name => `<div class="playlist-source-item">${escapeHtml(name)}</div>`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="playlist-actions">
        ${!isActive ? `<button class="btn-secondary btn-small btn-activate" data-id="${playlist.id}">Activate</button>` : `<button class="btn-secondary btn-small btn-deactivate" data-id="${playlist.id}">Deactivate</button>`}
        <button class="btn-secondary btn-small btn-photos-playlist" data-id="${playlist.id}">Photos</button>
        <button class="btn-secondary btn-small btn-edit-playlist" data-id="${playlist.id}">Edit</button>
        <button class="btn-secondary btn-small btn-manage-sources" data-id="${playlist.id}">Sources</button>
        <button class="btn-danger btn-small btn-delete-playlist" data-id="${playlist.id}">Delete</button>
      </div>
    </div>
  `;
}

function bindPlaylistActions(sources) {
  document.querySelectorAll('.btn-activate').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api.updateSettings({ active_playlist_id: btn.dataset.id });
        showToast('Playlist activated', 'success');
        renderPlaylistsView();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  document.querySelectorAll('.btn-deactivate').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api.updateSettings({ active_playlist_id: '' });
        showToast('Playlist deactivated', 'success');
        renderPlaylistsView();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  document.querySelectorAll('.btn-edit-playlist').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const playlist = await api.getPlaylist(btn.dataset.id);
        showPlaylistModal('Edit Playlist', playlist, async (data) => {
          await api.updatePlaylist(playlist.id, data);
          showToast('Playlist updated', 'success');
          renderPlaylistsView();
        });
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  document.querySelectorAll('.btn-manage-sources').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const playlist = await api.getPlaylist(btn.dataset.id);
        showManageSourcesModal(playlist, sources);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  document.querySelectorAll('.btn-photos-playlist').forEach(btn => {
    btn.addEventListener('click', async () => {
      const playlistId = parseInt(btn.dataset.id, 10);
      try {
        await showPlaylistPhotosModal(playlistId);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  document.querySelectorAll('.btn-delete-playlist').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this playlist?')) return;
      try {
        await api.deletePlaylist(btn.dataset.id);
        showToast('Playlist deleted', 'success');
        renderPlaylistsView();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

async function showPlaylistPhotosModal(playlistId) {
  const playlist = await api.getPlaylist(playlistId);
  if (!playlist) return;

  // Get all selected images from all sources in this playlist
  const sourceIds = (playlist.sources || []).map(s => s.source_id);
  if (sourceIds.length === 0) {
    showToast('Add sources to this playlist first', 'info');
    return;
  }

  // Load images from all sources in the playlist
  const allImages = [];
  for (const sourceId of sourceIds) {
    try {
      const images = await api.getSourceImages(sourceId);
      const selectedImages = images.filter(img => img.selected === 1);
      allImages.push(...selectedImages);
    } catch {
      // Skip failed sources
    }
  }

  if (allImages.length === 0) {
    showToast('No photos available. Scan your sources first.', 'info');
    return;
  }

  // Check for existing playlist-specific selections
  const existingSelections = await api.getPlaylistImages(playlistId);
  const existingImageIds = new Set(existingSelections.map(s => s.image_id));

  // If there are playlist-specific selections, mark images accordingly
  const imagesWithSelection = allImages.map(img => ({
    ...img,
    selected: existingImageIds.size > 0 ? (existingImageIds.has(img.id) ? 1 : 0) : 1,
  }));

  const content = document.createElement('div');

  if (existingImageIds.size > 0) {
    const notice = document.createElement('div');
    notice.style.cssText = 'font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.5rem;';
    notice.textContent = 'This playlist has custom photo selections. Changes here override source-level selections for this playlist.';
    content.appendChild(notice);
  }

  const picker = createPhotoPicker({
    images: imagesWithSelection,
    onSelectionChange: () => {},
  });
  content.appendChild(picker.element);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:0.5rem;margin-top:0.75rem;';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Save Selection';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      const selectedIds = picker.getSelectedIds();
      // If all images selected, clear custom selections (use source defaults)
      if (selectedIds.length === allImages.length) {
        await api.clearPlaylistImages(playlistId);
        showToast('Using source default selections', 'success');
      } else {
        await api.setPlaylistImages(playlistId, selectedIds);
        showToast('Playlist photo selection saved', 'success');
      }
      modal.close();
    } catch (err) {
      showToast(err.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Selection';
    }
  });

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn-secondary';
  clearBtn.textContent = 'Reset to Source Defaults';
  clearBtn.addEventListener('click', async () => {
    try {
      await api.clearPlaylistImages(playlistId);
      showToast('Playlist reset to source defaults', 'success');
      modal.close();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  btnRow.appendChild(saveBtn);
  btnRow.appendChild(clearBtn);
  content.appendChild(btnRow);

  const modal = showModal({
    title: `Photos - ${playlist.name}`,
    content,
  });

  const modalContent = modal.body.closest('.modal-content');
  if (modalContent) {
    modalContent.style.maxWidth = '850px';
  }
}

function showPlaylistModal(title, playlist, onSave) {
  const modal = $('#playlist-modal');
  modal.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close" id="modal-close">&times;</button>
        </div>
        <form id="playlist-form">
          <div class="form-group">
            <label for="playlist-name">Name</label>
            <input type="text" id="playlist-name" value="${escapeHtml(playlist.name || '')}" required>
          </div>
          <div class="form-group">
            <label for="playlist-description">Description</label>
            <textarea id="playlist-description" rows="3">${escapeHtml(playlist.description || '')}</textarea>
          </div>
          <div class="settings-actions">
            <button type="submit" class="btn-primary">Save</button>
            <button type="button" class="btn-secondary" id="modal-cancel">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const close = () => { modal.innerHTML = ''; };
  $('#modal-close').addEventListener('click', close);
  $('#modal-cancel').addEventListener('click', close);
  $('#modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) close();
  });

  $('#playlist-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await onSave({
        name: $('#playlist-name').value,
        description: $('#playlist-description').value,
      });
      close();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function showManageSourcesModal(playlist, allSources) {
  const modal = $('#playlist-modal');
  const playlistSourceIds = (playlist.sources || []).map(s => s.source_id);

  modal.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Manage Sources - ${escapeHtml(playlist.name)}</h2>
          <button class="modal-close" id="modal-close">&times;</button>
        </div>
        <div id="sources-checklist">
          ${allSources.length === 0 ? '<p>No sources available. Add sources first.</p>' :
            allSources.map(s => `
              <div class="form-group">
                <div class="checkbox-group">
                  <input type="checkbox" id="src-${s.id}" data-source-id="${s.id}"
                    ${playlistSourceIds.includes(s.id) ? 'checked' : ''}>
                  <label for="src-${s.id}" style="margin:0">${escapeHtml(s.name)} (${s.type})</label>
                </div>
              </div>
            `).join('')}
        </div>
        <div class="settings-actions mt-2">
          <button class="btn-primary" id="save-sources">Save</button>
          <button class="btn-secondary" id="modal-cancel">Cancel</button>
        </div>
      </div>
    </div>
  `;

  const close = () => { modal.innerHTML = ''; };
  $('#modal-close').addEventListener('click', close);
  $('#modal-cancel').addEventListener('click', close);
  $('#modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) close();
  });

  $('#save-sources').addEventListener('click', async () => {
    try {
      const checkboxes = document.querySelectorAll('#sources-checklist input[type="checkbox"]');
      const selectedIds = new Set();
      checkboxes.forEach(cb => {
        if (cb.checked) selectedIds.add(parseInt(cb.dataset.sourceId));
      });

      // Remove unchecked
      for (const srcId of playlistSourceIds) {
        if (!selectedIds.has(srcId)) {
          await api.removePlaylistSource(playlist.id, srcId);
        }
      }
      // Add newly checked
      let order = 0;
      for (const srcId of selectedIds) {
        if (!playlistSourceIds.includes(srcId)) {
          await api.addPlaylistSource(playlist.id, srcId, order);
        }
        order++;
      }

      showToast('Sources updated', 'success');
      close();
      renderPlaylistsView();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
