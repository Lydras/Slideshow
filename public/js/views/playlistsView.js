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

  const totalAssignments = playlists.reduce((sum, playlist) => sum + (playlist.sources || []).length, 0);
  const activePlaylist = playlists.find(playlist => String(playlist.id) === String(activePlaylistId));

  viewContainer.innerHTML = `
    <div class="page-shell">
      <section class="page-hero">
        <div>
          <p class="page-kicker">Curate</p>
          <div class="page-title-row">
            <h1>Playlists</h1>
            <span class="pill">${playlists.length} saved</span>
          </div>
          <p class="page-subtitle">Group sources into curated collections, choose a default playlist, and fine-tune which photos appear for each story.</p>
        </div>
        <div class="page-actions">
          ${activePlaylist ? `<span class="pill playlist-active-badge">Active: ${escapeHtml(activePlaylist.name)}</span>` : ''}
          <button class="btn-primary" id="btn-add-playlist">New Playlist</button>
        </div>
      </section>

      <section class="stats-grid">
        <article class="stat-card">
          <div class="stat-label">Playlists</div>
          <div class="stat-value">${playlists.length}</div>
          <div class="stat-meta">Collections ready for slideshow playback</div>
        </article>
        <article class="stat-card">
          <div class="stat-label">Source assignments</div>
          <div class="stat-value">${totalAssignments}</div>
          <div class="stat-meta">Total source links across all playlists</div>
        </article>
        <article class="stat-card">
          <div class="stat-label">Current default</div>
          <div class="stat-value">${activePlaylist ? '1' : '0'}</div>
          <div class="stat-meta">${activePlaylist ? escapeHtml(activePlaylist.name) : 'No playlist is active right now'}</div>
        </article>
      </section>

      ${playlists.length === 0 ? `
        <section class="empty-panel">
          <h2>Create a playlist once your sources are ready</h2>
          <p>Playlists let you switch between curated groups of sources and optional photo-level overrides for specific slideshow moments.</p>
          <div class="empty-actions">
            <button class="btn-primary" id="btn-empty-add-playlist">Create Playlist</button>
            <a class="btn-secondary" href="#/sources">Review sources</a>
          </div>
        </section>
      ` : `
        <section class="playlist-grid">
          ${playlists.map(playlist => renderPlaylistCard(playlist, sources)).join('')}
        </section>
      `}
    </div>
  `;

  $('#btn-add-playlist')?.addEventListener('click', () => showPlaylistModal('New Playlist', {}, async (data) => {
    await api.createPlaylist(data);
    showToast('Playlist created', 'success');
    renderPlaylistsView();
  }));

  $('#btn-empty-add-playlist')?.addEventListener('click', () => showPlaylistModal('New Playlist', {}, async (data) => {
    await api.createPlaylist(data);
    showToast('Playlist created', 'success');
    renderPlaylistsView();
  }));

  bindPlaylistActions(sources);

  return { destroy() {} };
}

function renderPlaylistCard(playlist, sources) {
  const isActive = String(playlist.id) === String(activePlaylistId);
  const playlistSources = (playlist.sources || []).map(item => {
    const source = sources.find(entry => entry.id === item.source_id);
    return source ? source.name : `Source #${item.source_id}`;
  });

  return `
    <article class="card playlist-card" data-id="${playlist.id}">
      <div class="playlist-info">
        <div class="page-title-row">
          <h2>${escapeHtml(playlist.name)}</h2>
          ${isActive ? '<span class="pill playlist-active-badge">Active</span>' : ''}
        </div>
        ${playlist.description ? `<p class="playlist-description">${escapeHtml(playlist.description)}</p>` : '<p class="playlist-description">No description yet.</p>'}
        <div class="playlist-sources-count">${playlistSources.length} source${playlistSources.length === 1 ? '' : 's'} connected</div>
        ${playlistSources.length > 0 ? `
          <div class="playlist-source-chip-list">
            ${playlistSources.map(name => `<span class="playlist-source-item">${escapeHtml(name)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="playlist-actions">
        ${!isActive ? `<button class="btn-secondary btn-small btn-activate" data-id="${playlist.id}">Set Active</button>` : `<button class="btn-secondary btn-small btn-deactivate" data-id="${playlist.id}">Deactivate</button>`}
        <button class="btn-secondary btn-small btn-photos-playlist" data-id="${playlist.id}">Review Photos</button>
        <button class="btn-secondary btn-small btn-edit-playlist" data-id="${playlist.id}">Edit</button>
        <button class="btn-secondary btn-small btn-manage-sources" data-id="${playlist.id}">Manage Sources</button>
        <button class="btn-danger btn-small btn-delete-playlist" data-id="${playlist.id}">Delete</button>
      </div>
    </article>
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
        showPlaylistModal(`Edit ${playlist.name}`, playlist, async (data) => {
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

  const sourceIds = (playlist.sources || []).map(source => source.source_id);
  if (sourceIds.length === 0) {
    showToast('Add sources to this playlist first', 'info');
    return;
  }

  const allImages = [];
  for (const sourceId of sourceIds) {
    try {
      const images = await api.getSourceImages(sourceId);
      const selectedImages = images.filter(img => img.selected === 1);
      allImages.push(...selectedImages);
    } catch {
      // Skip sources that fail to load.
    }
  }

  if (allImages.length === 0) {
    showToast('No photos are available yet. Scan your sources first.', 'info');
    return;
  }

  const existingSelections = await api.getPlaylistImages(playlistId);
  const existingImageIds = new Set(existingSelections.map(selection => selection.image_id));
  const imagesWithSelection = allImages.map(img => ({
    ...img,
    selected: existingImageIds.size > 0 ? (existingImageIds.has(img.id) ? 1 : 0) : 1,
  }));

  const content = document.createElement('div');

  if (existingImageIds.size > 0) {
    const notice = document.createElement('p');
    notice.className = 'inline-note mb-1';
    notice.textContent = 'Custom picks are enabled for this playlist. Saving here overrides the default source selections for this playlist only.';
    content.appendChild(notice);
  }

  const picker = createPhotoPicker({
    images: imagesWithSelection,
    onSelectionChange: () => {},
  });
  content.appendChild(picker.element);

  const actionRow = document.createElement('div');
  actionRow.className = 'settings-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Save Selection';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      const selectedIds = picker.getSelectedIds();
      if (selectedIds.length === allImages.length) {
        await api.clearPlaylistImages(playlistId);
        showToast('Playlist now uses source defaults', 'success');
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

  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn-secondary';
  resetBtn.textContent = 'Reset to Source Defaults';
  resetBtn.addEventListener('click', async () => {
    try {
      await api.clearPlaylistImages(playlistId);
      showToast('Playlist reset to source defaults', 'success');
      modal.close();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  actionRow.appendChild(saveBtn);
  actionRow.appendChild(resetBtn);
  content.appendChild(actionRow);

  const modal = showModal({
    title: `Playlist Photos: ${playlist.name}`,
    content,
  });
}

function showPlaylistModal(title, playlist, onSave) {
  const content = document.createElement('form');
  content.innerHTML = `
    <div class="form-group">
      <label for="playlist-name">Name</label>
      <input type="text" id="playlist-name" value="${escapeHtml(playlist.name || '')}" required>
    </div>
    <div class="form-group">
      <label for="playlist-description">Description</label>
      <textarea id="playlist-description" rows="4">${escapeHtml(playlist.description || '')}</textarea>
    </div>
    <div class="settings-actions">
      <button type="submit" class="btn-primary">Save Playlist</button>
      <button type="button" class="btn-secondary" id="playlist-cancel">Cancel</button>
    </div>
  `;

  const modal = showModal({ title, content });
  content.querySelector('#playlist-cancel').addEventListener('click', () => modal.close());
  content.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await onSave({
        name: content.querySelector('#playlist-name').value,
        description: content.querySelector('#playlist-description').value,
      });
      modal.close();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function showManageSourcesModal(playlist, allSources) {
  const content = document.createElement('div');
  const playlistSourceIds = (playlist.sources || []).map(source => source.source_id);

  content.innerHTML = `
    <p class="inline-note mb-1">Choose which sources feed this playlist. Photo-level overrides remain optional and can be adjusted separately.</p>
    <div id="playlist-source-checklist" class="section-stack"></div>
    <div class="settings-actions">
      <button class="btn-primary" id="save-sources">Save Sources</button>
      <button class="btn-secondary" id="cancel-sources">Cancel</button>
    </div>
  `;

  const checklist = content.querySelector('#playlist-source-checklist');
  if (allSources.length === 0) {
    checklist.innerHTML = '<div class="empty-panel"><h2>No sources available yet</h2><p>Add a source first, then come back to build this playlist.</p></div>';
  } else {
    checklist.innerHTML = allSources.map(source => `
      <label class="card playlist-source-option">
        <span>
          <strong>${escapeHtml(source.name)}</strong><br>
          <small>${escapeHtml(source.type)} source</small>
        </span>
        <input type="checkbox" data-source-id="${source.id}" ${playlistSourceIds.includes(source.id) ? 'checked' : ''}>
      </label>
    `).join('');
  }

  const modal = showModal({
    title: `Manage Sources: ${playlist.name}`,
    content,
  });

  content.querySelector('#cancel-sources').addEventListener('click', () => modal.close());
  content.querySelector('#save-sources').addEventListener('click', async () => {
    try {
      const checkboxes = content.querySelectorAll('input[type="checkbox"][data-source-id]');
      const selectedIds = [];
      checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
          selectedIds.push(parseInt(checkbox.dataset.sourceId, 10));
        }
      });

      for (const sourceId of playlistSourceIds) {
        if (!selectedIds.includes(sourceId)) {
          await api.removePlaylistSource(playlist.id, sourceId);
        }
      }

      for (let index = 0; index < selectedIds.length; index++) {
        const sourceId = selectedIds[index];
        if (!playlistSourceIds.includes(sourceId)) {
          await api.addPlaylistSource(playlist.id, sourceId, index);
        }
      }

      modal.close();
      showToast('Sources updated', 'success');
      renderPlaylistsView();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

