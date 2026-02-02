import { api } from '../api.js';
import { showToast } from '../components/toast.js';
import { showModal } from '../components/modal.js';
import { createPhotoPicker } from '../components/photoPicker.js';
import { openSourceWizard } from '../components/sourceWizard.js';
import { $ } from '../utils/dom.js';
import { getHashParams, navigateTo } from '../utils/router.js';

export async function renderSourcesView() {
  const viewContainer = $('#view');
  let sources = [];
  let imageCounts = {};

  try {
    sources = await api.getSources();
    // Load image counts for all sources
    const countPromises = sources.map(s =>
      api.getSourceImageCounts(s.id).then(c => ({ id: s.id, ...c })).catch(() => ({ id: s.id, total: 0, selected: 0 }))
    );
    const counts = await Promise.all(countPromises);
    for (const c of counts) {
      imageCounts[c.id] = c;
    }
  } catch (err) {
    showToast('Failed to load sources', 'error');
  }

  viewContainer.innerHTML = `
    <div class="view-container">
      <div class="flex-between mb-2">
        <h1>Sources</h1>
        <button class="btn-primary" id="btn-add-source">+ Add Source</button>
      </div>
      <div class="source-list" id="source-list">
        ${sources.length === 0 ? `
          <div class="empty-state">
            <p>No sources configured. Add a source to get started.</p>
          </div>
        ` : sources.map(s => renderSourceCard(s, imageCounts[s.id])).join('')}
      </div>
    </div>
    <div id="source-modal"></div>
  `;

  // Bind add button - opens wizard
  $('#btn-add-source').addEventListener('click', () => {
    openSourceWizard({ onComplete: () => renderSourcesView() });
  });

  // Bind card actions
  bindCardActions();

  // Check if returning from Dropbox OAuth callback
  const params = getHashParams();
  if (params.dropbox_credential_id) {
    // Clean the URL so a page refresh won't re-trigger the wizard
    navigateTo('#/sources');
    // Auto-open wizard pre-filled with the Dropbox credential
    openSourceWizard({
      initialState: {
        sourceType: 'dropbox',
        credentialId: parseInt(params.dropbox_credential_id, 10),
        step: 3, // Skip to folder browse
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
  const countText = counts ? `${counts.selected}/${counts.total} photos` : '';
  return `
    <div class="card source-card" data-id="${source.id}">
      <div class="source-info">
        <h3>${escapeHtml(source.name)} ${badges[source.type] || ''}</h3>
        <div class="source-path">${escapeHtml(source.path)}</div>
        <div class="source-meta">
          Subfolders: ${source.include_subfolders ? 'Yes' : 'No'}
          ${countText ? ` &middot; ${countText}` : ''}
        </div>
      </div>
      <div class="source-actions">
        <button class="btn-secondary btn-small btn-photos" data-id="${source.id}">Photos</button>
        <button class="btn-secondary btn-small btn-scan" data-id="${source.id}">Scan</button>
        <button class="btn-secondary btn-small btn-edit" data-id="${source.id}">Edit</button>
        <button class="btn-danger btn-small btn-delete" data-id="${source.id}">Delete</button>
      </div>
    </div>
  `;
}

function bindCardActions() {
  document.querySelectorAll('.btn-photos').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id, 10);
      try {
        const images = await api.getSourceImages(id);
        if (images.length === 0) {
          showToast('No images cached. Scan the source first.', 'info');
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
      }
      btn.disabled = false;
      btn.textContent = 'Scan';
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
  saveBtn.style.marginTop = '0.75rem';
  saveBtn.textContent = 'Save Selection';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      const selectedIds = picker.getSelectedIds();
      const allIds = images.map(img => img.id);

      // Deselect all first, then select the chosen ones
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
    title: 'Manage Photos',
    content,
  });

  // Widen modal for photo grid
  const modalContent = modal.body.closest('.modal-content');
  if (modalContent) {
    modalContent.style.maxWidth = '850px';
  }
}

function showEditSourceModal(source) {
  showSourceModal('Edit Source', source, async (data) => {
    await api.updateSource(source.id, data);
    showToast('Source updated', 'success');
    renderSourcesView();
  });
}

function showSourceModal(title, source, onSave) {
  const modal = $('#source-modal');
  modal.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close" id="modal-close">&times;</button>
        </div>
        <form id="source-form">
          <div class="form-group">
            <label for="source-name">Name</label>
            <input type="text" id="source-name" value="${escapeHtml(source.name || '')}" required>
          </div>
          <div class="form-group">
            <label for="source-type">Type</label>
            <select id="source-type" disabled>
              <option value="local" ${source.type === 'local' ? 'selected' : ''}>Local</option>
              <option value="dropbox" ${source.type === 'dropbox' ? 'selected' : ''}>Dropbox</option>
              <option value="plex" ${source.type === 'plex' ? 'selected' : ''}>Plex</option>
            </select>
          </div>
          <div class="form-group">
            <label for="source-path">Path</label>
            <input type="text" id="source-path" value="${escapeHtml(source.path || '')}" required
              placeholder="e.g., C:\\Photos or /dropbox/folder">
          </div>
          <div class="form-group">
            <div class="checkbox-group">
              <input type="checkbox" id="source-subfolders" ${source.include_subfolders !== 0 ? 'checked' : ''}>
              <label for="source-subfolders" style="margin:0">Include subfolders</label>
            </div>
          </div>
          <div class="settings-actions">
            <button type="submit" class="btn-primary">Save</button>
            <button type="button" class="btn-secondary" id="modal-cancel">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;

  addModalStyles();

  const close = () => { modal.innerHTML = ''; };
  $('#modal-close').addEventListener('click', close);
  $('#modal-cancel').addEventListener('click', close);
  $('#modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) close();
  });

  $('#source-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await onSave({
        name: $('#source-name').value,
        path: $('#source-path').value,
        include_subfolders: $('#source-subfolders').checked ? 1 : 0,
      });
      close();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function addModalStyles() {
  if (document.getElementById('modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'modal-styles';
  style.textContent = `
    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      align-items: center; justify-content: center; z-index: 200;
    }
    .modal-content {
      background: rgba(30, 45, 55, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 1.75rem;
      width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto;
      box-shadow: var(--shadow-lg);
    }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.25rem;
    }
    .modal-header h2 {
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .modal-close {
      background: var(--glass-bg); color: var(--text-secondary); font-size: 1.25rem;
      padding: 0.25rem; width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 8px; border: 1px solid var(--glass-border);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .modal-close:hover {
      color: var(--text-primary);
      background: var(--glass-bg-hover);
      border-color: var(--glass-border-light);
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
