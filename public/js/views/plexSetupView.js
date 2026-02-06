import { $, escapeHtml } from '../utils/dom.js';
import { showToast } from '../components/toast.js';
import { api } from '../api.js';

export async function renderPlexSetupView() {
  const viewContainer = $('#view');

  viewContainer.innerHTML = `
    <div class="view-container">
      <h1>Plex Setup</h1>
      <div class="card">
        <form id="plex-form">
          <div class="form-group">
            <label for="plex-url">Plex Server URL</label>
            <input type="url" id="plex-url" placeholder="http://localhost:32400" required>
          </div>
          <div class="form-group">
            <label for="plex-token">Plex Token</label>
            <input type="text" id="plex-token" placeholder="Your Plex authentication token" required>
          </div>
          <div class="settings-actions">
            <button type="submit" class="btn-primary">Connect</button>
            <a href="#/sources" class="btn-secondary">Cancel</a>
          </div>
        </form>
      </div>
      <div id="plex-libraries" class="mt-2"></div>
    </div>
  `;

  $('#plex-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = $('#plex-url').value;
    const token = $('#plex-token').value;

    try {
      const result = await api.connectPlex({ server_url: url, token });
      showToast('Connected to Plex', 'success');

      // Show libraries
      const libraries = await api.getPlexLibraries(result.credential_id);
      renderLibraries(result.credential_id, url, libraries);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  return { destroy() {} };
}

function renderLibraries(credentialId, serverUrl, libraries) {
  const container = $('#plex-libraries');
  if (!libraries || libraries.length === 0) {
    container.innerHTML = '<p>No photo libraries found on this Plex server.</p>';
    return;
  }

  container.innerHTML = `
    <h2>Photo Libraries</h2>
    ${libraries.map(lib => `
      <div class="card flex-between">
        <div>
          <strong>${escapeHtml(lib.title)}</strong>
          <div class="source-meta">${lib.type} - ${lib.count || 0} items</div>
        </div>
        <button class="btn-primary btn-small btn-add-plex-source"
          data-section-id="${lib.key}"
          data-title="${escapeHtml(lib.title)}"
          data-credential-id="${credentialId}"
          data-server-url="${escapeHtml(serverUrl)}">
          Add as Source
        </button>
      </div>
    `).join('')}
  `;

  document.querySelectorAll('.btn-add-plex-source').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api.createSource({
          name: `Plex: ${btn.dataset.title}`,
          type: 'plex',
          path: btn.dataset.sectionId,
          include_subfolders: 1,
          credential_id: parseInt(btn.dataset.credentialId),
          plex_server_url: btn.dataset.serverUrl,
        });
        showToast('Plex source added', 'success');
        window.location.hash = '#/sources';
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}
