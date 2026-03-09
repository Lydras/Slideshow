import { api } from '../api.js';
import { showToast } from '../components/toast.js';
import { showModal } from '../components/modal.js';
import { createPhotoPicker } from '../components/photoPicker.js';
import { openSourceWizard } from '../components/sourceWizard.js';
import { $, escapeHtml } from '../utils/dom.js';
import { getHashParams, navigateTo } from '../utils/router.js';

export async function renderSourcesView() {
  const viewContainer = $('#view');
  let sources = [];
  const imageCounts = {};

  try {
    sources = await api.getSources();
    const countPromises = sources.map(source =>
      api.getSourceImageCounts(source.id)
        .then(counts => ({ id: source.id, ...counts }))
        .catch(() => ({ id: source.id, total: 0, selected: 0 }))
    );
    const counts = await Promise.all(countPromises);
    for (const item of counts) {
      imageCounts[item.id] = item;
    }
  } catch (err) {
    showToast('Failed to load sources', 'error');
  }

  const totals = sources.reduce((acc, source) => {
    const counts = imageCounts[source.id] || { total: 0, selected: 0 };
    acc.totalImages += counts.total;
    acc.selectedImages += counts.selected;
    acc.byType[source.type] = (acc.byType[source.type] || 0) + 1;
    return acc;
  }, { totalImages: 0, selectedImages: 0, byType: {} });

  viewContainer.innerHTML = `
    <div class="page-shell">
      <section class="page-hero">
        <div>
          <p class="page-kicker">Library</p>
          <div class="page-title-row">
            <h1>Photo Sources</h1>
            <span class="pill">${sources.length} connected</span>
          </div>
          <p class="page-subtitle">Connect local folders, Dropbox accounts, and Plex libraries, then decide which photos are eligible for the slideshow.</p>
        </div>
        <div class="page-actions">
          <button class="btn-secondary" id="btn-refresh-sources">Refresh</button>
          <button class="btn-primary" id="btn-add-source">Add Source</button>
        </div>
      </section>

      <section class="stats-grid">
        <article class="stat-card">
          <div class="stat-label">Connected sources</div>
          <div class="stat-value">${sources.length}</div>
          <div class="stat-meta">${(totals.byType.local || 0)} local, ${(totals.byType.dropbox || 0)} Dropbox, ${(totals.byType.plex || 0)} Plex</div>
        </article>
        <article class="stat-card">
          <div class="stat-label">Photos discovered</div>
          <div class="stat-value">${totals.totalImages}</div>
          <div class="stat-meta">Across every configured source</div>
        </article>
        <article class="stat-card">
          <div class="stat-label">Selected for use</div>
          <div class="stat-value">${totals.selectedImages}</div>
          <div class="stat-meta">Photos currently eligible for playlists and slideshow playback</div>
        </article>
      </section>

      ${sources.length === 0 ? `
        <section class="empty-panel">
          <h2>Start by connecting a photo source</h2>
          <p>Use the guided flow to browse a local folder, authenticate Dropbox, or pick a Plex library. You can review photos before saving the source.</p>
          <div class="empty-actions">
            <button class="btn-primary" id="btn-empty-add-source">Add your first source</button>
            <a class="btn-secondary" href="#/slideshow">Open slideshow view</a>
          </div>
        </section>
      ` : `
        <section class="source-grid" id="source-list">
          ${sources.map(source => renderSourceCard(source, imageCounts[source.id] || { total: 0, selected: 0 })).join('')}
        </section>
      `}
    </div>
  `;

  $('#btn-add-source')?.addEventListener('click', () => {
    openSourceWizard({ onComplete: () => renderSourcesView() });
  });
  $('#btn-empty-add-source')?.addEventListener('click', () => {
    openSourceWizard({ onComplete: () => renderSourcesView() });
  });
  $('#btn-refresh-sources')?.addEventListener('click', () => renderSourcesView());

  bindCardActions();

  const params = getHashParams();
  if (params.dropbox_credential_id) {
    navigateTo('#/sources');
    openSourceWizard({
      initialState: {
        sourceType: 'dropbox',
        credentialId: parseInt(params.dropbox_credential_id, 10),
        step: 3,
      },
      onComplete: () => renderSourcesView(),
    });
  }

  return { destroy() {} };
}

function renderSourceCard(source, counts) {
  const badges = {
    local: '<span class="badge badge-local">Local</span>',
    dropbox: '<span class="badge badge-dropbox">Dropbox</span>',
    plex: '<span class="badge badge-plex">Plex</span>',
  };

  const emptyTip = counts.total === 0
    ? '<p class="source-empty-tip">This source has not been scanned yet.</p>'
    : '';

  return `
    <article class="card source-card" data-id="${source.id}">
      <div class="source-card-header">
        <div class="source-title-stack">
          <div class="page-title-row">
            <h2>${escapeHtml(source.name)}</h2>
            ${badges[source.type] || ''}
          </div>
          <p class="source-path">${escapeHtml(source.path)}</p>
        </div>
      </div>
      <div class="source-metrics">
        <div class="source-metric">
          <div class="source-metric-label">Selected</div>
          <div class="source-metric-value">${counts.selected}</div>
        </div>
        <div class="source-metric">
          <div class="source-metric-label">Discovered</div>
          <div class="source-metric-value">${counts.total}</div>
        </div>
        <div class="source-metric">
          <div class="source-metric-label">Subfolders</div>
          <div class="source-metric-value">${source.include_subfolders ? 'On' : 'Off'}</div>
        </div>
      </div>
      ${emptyTip}
      <div class="source-actions">
        <button class="btn-secondary btn-small btn-photos" data-id="${source.id}">Review Photos</button>
        <button class="btn-secondary btn-small btn-scan" data-id="${source.id}">Scan</button>
        <button class="btn-secondary btn-small btn-edit" data-id="${source.id}">Edit</button>
        <button class="btn-danger btn-small btn-delete" data-id="${source.id}">Delete</button>
      </div>
    </article>
  `;
}

function bindCardActions() {
  document.querySelectorAll('.btn-photos').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id, 10);
      try {
        const images = await api.getSourceImages(id);
        if (images.length === 0) {
          showToast('No photos are cached yet. Scan the source first.', 'info');
          return;
        }
        showPhotoManagementModal(id, images);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  document.querySelectorAll('.btn-scan').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      btn.textContent = 'Scanning...';
      try {
        const result = await api.scanSource(id);
        showToast(result.message, 'success');
        renderSourcesView();
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Scan';
      }
    });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this source?')) return;
      try {
        await api.deleteSource(btn.dataset.id);
        showToast('Source deleted', 'success');
        renderSourcesView();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const source = await api.getSource(btn.dataset.id);
        showEditSourceModal(source);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function showPhotoManagementModal(sourceId, images) {
  const content = document.createElement('div');
  const picker = createPhotoPicker({
    images,
    onSelectionChange: () => {},
  });

  content.appendChild(picker.element);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.style.marginTop = '0.85rem';
  saveBtn.textContent = 'Save Selection';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      const selectedIds = picker.getSelectedIds();
      await api.updateBulkImageSelection(sourceId, 0);
      if (selectedIds.length > 0) {
        await api.updateBulkImageSelection(sourceId, 1, selectedIds);
      }
      showToast('Photo selection saved', 'success');
      modal.close();
      renderSourcesView();
    } catch (err) {
      showToast(err.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Selection';
    }
  });

  content.appendChild(saveBtn);

  const modal = showModal({
    title: 'Review Source Photos',
    content,
  });
}

function showEditSourceModal(source) {
  const content = document.createElement('form');
  content.innerHTML = `
    <div class="form-group">
      <label for="source-name">Name</label>
      <input type="text" id="source-name" value="${escapeHtml(source.name || '')}" required>
    </div>
    <div class="form-group">
      <label for="source-path">Path</label>
      <input type="text" id="source-path" value="${escapeHtml(source.path || '')}" required>
    </div>
    <div class="form-group">
      <div class="checkbox-group">
        <input type="checkbox" id="source-subfolders" ${source.include_subfolders !== 0 ? 'checked' : ''}>
        <label for="source-subfolders">Include subfolders</label>
      </div>
    </div>
    <div class="settings-actions">
      <button type="submit" class="btn-primary">Save Changes</button>
      <button type="button" class="btn-secondary" id="source-cancel">Cancel</button>
    </div>
  `;

  const modal = showModal({
    title: `Edit ${source.name}`,
    content,
  });

  content.querySelector('#source-cancel').addEventListener('click', () => modal.close());
  content.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api.updateSource(source.id, {
        name: content.querySelector('#source-name').value,
        path: content.querySelector('#source-path').value,
        include_subfolders: content.querySelector('#source-subfolders').checked ? 1 : 0,
      });
      modal.close();
      showToast('Source updated', 'success');
      renderSourcesView();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
