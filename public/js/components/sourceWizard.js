import { api } from '../api.js';
import { showToast } from './toast.js';
import { showModal } from './modal.js';
import { createLocalBrowser } from './localBrowser.js';
import { escapeHtml } from '../utils/dom.js';
import { createPhotoPicker } from './photoPicker.js';

export function openSourceWizard({ onComplete, initialState }) {
  const state = {
    step: 1,
    sourceType: null,
    credentialId: null,
    serverUrl: null,
    selectedPath: '',
    sectionId: null,
    includeSubfolders: true,
    scannedImages: [],
    selectedImageIds: [],
    selectedImagePaths: null,
    sourceName: '',
    scanSignature: null,
    wizardCompleted: false,
    plexAlbumKey: null,
    ...initialState,
  };

  const modal = showModal({
    title: 'Add Source',
    content: '<div id="wizard-content"></div>',
    onClose: async () => {
      if (state.createdSourceId && !state.wizardCompleted) {
        try {
          await api.deleteSource(state.createdSourceId);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    },
  });

  // Widen modal for wizard
  const modalContent = modal.body.closest('.modal-content');
  if (modalContent) {
    modalContent.style.maxWidth = '850px';
  }

  renderStep();

  function renderStep() {
    const content = document.getElementById('wizard-content');
    if (!content) return;
    content.innerHTML = '';

    switch (state.step) {
      case 1: renderTypeSelection(content); break;
      case 2: renderStep2(content); break;
      case 3: renderStep3(content); break;
      case 4: renderStep4(content); break;
      case 5: renderStep5(content); break;
      case 6: renderStep6(content); break;
    }
  }

  // Step 1: Choose source type
  function renderTypeSelection(container) {
    container.innerHTML = `
      <div class="wizard-step">
        <h3>Choose Source Type</h3>
        <div class="wizard-type-grid">
          <div class="wizard-type-card" data-type="local">
            <div class="wizard-type-icon">&#128193;</div>
            <div class="wizard-type-title">Local Folder</div>
            <div class="wizard-type-desc">Browse and select a folder on this computer</div>
          </div>
          <div class="wizard-type-card" data-type="dropbox">
            <div class="wizard-type-icon">&#9729;</div>
            <div class="wizard-type-title">Dropbox</div>
            <div class="wizard-type-desc">Connect to your Dropbox account</div>
          </div>
          <div class="wizard-type-card" data-type="plex">
            <div class="wizard-type-icon">&#9654;</div>
            <div class="wizard-type-title">Plex</div>
            <div class="wizard-type-desc">Connect to a Plex Media Server</div>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('.wizard-type-card').forEach(card => {
      card.addEventListener('click', () => {
        state.sourceType = card.dataset.type;
        state.step = 2;
        renderStep();
      });
    });
  }

  // Step 2: Type-specific configuration
  function renderStep2(container) {
    if (state.sourceType === 'local') {
      renderLocalBrowse(container);
    } else if (state.sourceType === 'dropbox') {
      renderDropboxCredential(container);
    } else if (state.sourceType === 'plex') {
      renderPlexCredential(container);
    }
  }

  // Step 3: Type-specific second step
  function renderStep3(container) {
    if (state.sourceType === 'local') {
      renderScanAndPick(container);
    } else if (state.sourceType === 'dropbox') {
      renderDropboxBrowse(container);
    } else if (state.sourceType === 'plex') {
      renderPlexLibrary(container);
    }
  }

  // Step 4
  function renderStep4(container) {
    if (state.sourceType === 'local') {
      renderNameAndSave(container);
    } else if (state.sourceType === 'dropbox') {
      renderScanAndPick(container);
    } else if (state.sourceType === 'plex') {
      renderPlexBrowse(container);
    }
  }

  // Step 5
  function renderStep5(container) {
    if (state.sourceType === 'plex') {
      renderScanAndPick(container);
    } else {
      renderNameAndSave(container);
    }
  }

  // Step 6
  function renderStep6(container) {
    renderNameAndSave(container);
  }

  // ---- Local flow ----
  function renderLocalBrowse(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'wizard-step';
    wrapper.innerHTML = '<h3>Select Folder</h3>';

    const browser = createLocalBrowser({
      onSelect: (selectedPath) => {
        state.selectedPath = selectedPath;
        state.sourceName = selectedPath.split(/[\\/]/).filter(Boolean).pop() || 'Local Source';
        state.step = 3;
        renderStep();
      },
    });

    wrapper.appendChild(browser);
    appendNavButtons(wrapper, { back: 1 });
    container.appendChild(wrapper);
  }

  // ---- Dropbox flow ----
  async function renderDropboxCredential(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'wizard-step';
    wrapper.innerHTML = '<h3>Dropbox Account</h3><div id="dbx-cred-content">Loading credentials...</div>';
    appendNavButtons(wrapper, { back: 1 });
    container.appendChild(wrapper);

    // Compute the redirect URI the server will use
    const redirectUri = `${window.location.protocol}//${window.location.host}/api/dropbox/callback`;

    try {
      const credentials = await api.getCredentials();
      const dropboxCreds = credentials.filter(c => c.service === 'dropbox');
      const credContent = wrapper.querySelector('#dbx-cred-content');

      let html = '';
      if (dropboxCreds.length > 0) {
        html += `
          <div class="form-group">
            <label>Select an existing account</label>
            <select id="dbx-cred-select">
              ${dropboxCreds.map(c => `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join('')}
            </select>
          </div>
          <div class="wizard-btn-row">
            <button class="btn-primary" id="dbx-use-existing">Use Selected</button>
            <button class="btn-danger btn-small" id="dbx-delete-cred">Delete</button>
          </div>
          <hr style="border-color:var(--border);margin:1rem 0">
          <p style="color:var(--text-secondary);font-size:0.85rem">Or connect a new account:</p>
        `;
      }

      html += `
        <div class="wizard-help-box">
          <strong>Setup instructions:</strong>
          <ol>
            <li>Go to the <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener">Dropbox App Console</a></li>
            <li>Click <strong>Create app</strong></li>
            <li>Choose <strong>Scoped access</strong>, then <strong>Full Dropbox</strong></li>
            <li>Name your app and click <strong>Create app</strong></li>
            <li><strong style="color:var(--error)">Important:</strong> Go to the <strong>Permissions</strong> tab and enable both:
              <ul>
                <li><code class="wizard-code">files.metadata.read</code></li>
                <li><code class="wizard-code">files.content.read</code></li>
              </ul>
              Then click <strong>Submit</strong>. Without these permissions, folder browsing will fail.</li>
            <li>Go to the <strong>Settings</strong> tab and add this <strong>Redirect URI</strong>:<br>
              <code class="wizard-code">${escapeHtml(redirectUri)}</code></li>
            <li>Copy the <strong>App key</strong> and <strong>App secret</strong> from the Settings tab into the fields below</li>
          </ol>
          <p style="margin-top:0.5rem;color:var(--text-secondary);font-size:0.8rem"><strong>Note:</strong> If you change permissions after connecting, you must disconnect and re-connect your account for the new permissions to take effect.</p>
        </div>
        <div class="form-group">
          <label for="dbx-app-key">App Key</label>
          <input type="text" id="dbx-app-key" placeholder="Your Dropbox app key">
        </div>
        <div class="form-group">
          <label for="dbx-app-secret">App Secret</label>
          <input type="text" id="dbx-app-secret" placeholder="Your Dropbox app secret">
        </div>
        <button class="btn-primary" id="dbx-connect-new">Connect Dropbox Account</button>
      `;

      credContent.innerHTML = html;

      if (dropboxCreds.length > 0) {
        credContent.querySelector('#dbx-use-existing').addEventListener('click', async () => {
          const credId = parseInt(credContent.querySelector('#dbx-cred-select').value, 10);
          const btn = credContent.querySelector('#dbx-use-existing');
          btn.disabled = true;
          btn.textContent = 'Checking...';
          try {
            // Validate the credential can list folders before proceeding
            await api.getDropboxFolders(credId, '');
            state.credentialId = credId;
            state.step = 3;
            renderStep();
          } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Use Selected';
            if (err.message && err.message.includes('permission')) {
              showToast('This credential has outdated permissions. Delete it and connect a new account.', 'error');
            } else {
              showToast(err.message, 'error');
            }
          }
        });
        credContent.querySelector('#dbx-delete-cred').addEventListener('click', async () => {
          const credId = parseInt(credContent.querySelector('#dbx-cred-select').value, 10);
          if (!confirm('Delete this credential? Sources using it will need to be reconfigured.')) return;
          try {
            await api.deleteCredential(credId);
            showToast('Credential deleted', 'success');
            renderStep(); // Re-render to refresh credential list
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      }

      credContent.querySelector('#dbx-connect-new').addEventListener('click', () => {
        const appKey = credContent.querySelector('#dbx-app-key').value.trim();
        const appSecret = credContent.querySelector('#dbx-app-secret').value.trim();
        if (!appKey || !appSecret) {
          showToast('App Key and App Secret are required', 'error');
          return;
        }
        startDropboxOAuth(appKey, appSecret);
      });
    } catch (err) {
      wrapper.querySelector('#dbx-cred-content').innerHTML =
        `<p style="color:var(--error)">${escapeHtml(err.message)}</p>`;
    }
  }

  function startDropboxOAuth(appKey, appSecret) {
    showToast('Redirecting to Dropbox for authorization...', 'info');
    api.getDropboxAuthUrl(appKey, appSecret).then(data => {
      window.location.href = data.auth_url;
    }).catch(err => {
      showToast('Failed to start Dropbox auth: ' + err.message, 'error');
    });
  }

  async function renderDropboxBrowse(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'wizard-step';
    container.appendChild(wrapper);

    const PHOTO_PREVIEW_LIMIT = 60;
    const currentPath = []; // stack of { name, path }

    function selectFolder() {
      const folderPath = currentPath.length > 0 ? currentPath[currentPath.length - 1].path : '';
      state.selectedPath = folderPath || '/';
      state.includeSubfolders = wrapper.querySelector('#dbx-subfolders')?.checked ?? state.includeSubfolders;
      state.sourceName = currentPath.length > 0
        ? currentPath[currentPath.length - 1].name
        : 'Dropbox Source';
      state.step = 4;
      renderStep();
    }

    async function loadContents() {
      wrapper.innerHTML = '';

      // Header
      const header = document.createElement('h3');
      header.textContent = 'Select Dropbox Folder';
      wrapper.appendChild(header);

      // Breadcrumb bar
      const breadcrumbBar = document.createElement('div');
      breadcrumbBar.className = 'plex-breadcrumbs';

      const rootCrumb = document.createElement('span');
      rootCrumb.className = 'plex-breadcrumb';
      rootCrumb.textContent = 'Dropbox';
      if (currentPath.length > 0) {
        rootCrumb.classList.add('clickable');
        rootCrumb.addEventListener('click', () => {
          currentPath.length = 0;
          loadContents();
        });
      }
      breadcrumbBar.appendChild(rootCrumb);

      for (let i = 0; i < currentPath.length; i++) {
        const sep = document.createElement('span');
        sep.className = 'plex-breadcrumb-sep';
        sep.textContent = ' \u203A ';
        breadcrumbBar.appendChild(sep);

        const crumb = document.createElement('span');
        crumb.className = 'plex-breadcrumb';
        crumb.textContent = currentPath[i].name;
        if (i < currentPath.length - 1) {
          crumb.classList.add('clickable');
          const depth = i + 1;
          crumb.addEventListener('click', () => {
            currentPath.length = depth;
            loadContents();
          });
        }
        breadcrumbBar.appendChild(crumb);
      }

      wrapper.appendChild(breadcrumbBar);

      // Action bar
      const actionBar = document.createElement('div');
      actionBar.className = 'wizard-btn-row';
      actionBar.style.marginBottom = '1rem';

      const selectBtn = document.createElement('button');
      selectBtn.className = 'btn-primary btn-small';
      selectBtn.textContent = currentPath.length > 0
        ? `Select \u201C${currentPath[currentPath.length - 1].name}\u201D`
        : 'Select Root Folder';
      selectBtn.addEventListener('click', () => selectFolder());
      actionBar.appendChild(selectBtn);

      const subfoldersLabel = document.createElement('label');
      subfoldersLabel.style.cssText = 'display:flex;align-items:center;gap:0.4rem;margin:0;font-size:0.85rem;color:var(--text-secondary)';
      subfoldersLabel.innerHTML = `<input type="checkbox" id="dbx-subfolders" ${state.includeSubfolders ? 'checked' : ''}> Include subfolders`;
      actionBar.appendChild(subfoldersLabel);

      wrapper.appendChild(actionBar);

      // Loading indicator
      const loadingDiv = document.createElement('div');
      loadingDiv.textContent = 'Loading...';
      loadingDiv.style.cssText = 'color:var(--text-secondary);padding:1rem 0';
      wrapper.appendChild(loadingDiv);

      // Back button at bottom
      const nav = document.createElement('div');
      nav.className = 'wizard-nav';
      nav.style.marginTop = '1.25rem';

      const backBtn = document.createElement('button');
      backBtn.className = 'btn-secondary btn-small';
      backBtn.textContent = 'Back';
      backBtn.addEventListener('click', () => {
        if (currentPath.length > 0) {
          currentPath.pop();
          loadContents();
        } else {
          state.step = 2;
          renderStep();
        }
      });
      nav.appendChild(backBtn);
      wrapper.appendChild(nav);

      // Load data
      try {
        const folderPath = currentPath.length > 0 ? currentPath[currentPath.length - 1].path : '';
        const data = await api.getDropboxContents(state.credentialId, folderPath);

        loadingDiv.remove();

        // Show folders
        if (data.folders.length > 0) {
          const foldersSection = document.createElement('div');
          foldersSection.innerHTML = `<div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem">${data.folders.length} folder${data.folders.length !== 1 ? 's' : ''}</div>`;

          const folderGrid = document.createElement('div');
          folderGrid.className = 'plex-album-grid';

          for (const folder of data.folders) {
            const card = document.createElement('div');
            card.className = 'plex-album-card';
            card.innerHTML = `
              <div class="plex-album-thumb plex-album-no-thumb" style="display:flex;align-items:center;justify-content:center;font-size:2rem">&#128193;</div>
              <div class="plex-album-info">
                <div class="plex-album-title">${escapeHtml(folder.name)}</div>
              </div>
            `;
            card.addEventListener('click', () => {
              currentPath.push({ name: folder.name, path: folder.path });
              loadContents();
            });
            folderGrid.appendChild(card);
          }

          foldersSection.appendChild(folderGrid);
          wrapper.insertBefore(foldersSection, nav);
        }

        // Show image thumbnails
        if (data.images.length > 0) {
          const photosSection = document.createElement('div');
          const showing = Math.min(data.images.length, PHOTO_PREVIEW_LIMIT);
          const label = data.images.length > PHOTO_PREVIEW_LIMIT
            ? `${data.images.length} images (showing first ${showing})`
            : `${data.images.length} image${data.images.length !== 1 ? 's' : ''}`;
          photosSection.innerHTML = `<div style="color:var(--text-secondary);font-size:0.85rem;margin:0.75rem 0 0.5rem">${label}</div>`;

          const photoGrid = document.createElement('div');
          photoGrid.className = 'plex-photo-grid';

          for (const image of data.images.slice(0, PHOTO_PREVIEW_LIMIT)) {
            const cell = document.createElement('div');
            cell.className = 'plex-photo-cell';
            const thumbUrl = api.getDropboxThumbnailUrl(state.credentialId, image.path);
            cell.innerHTML = `<img src="${escapeHtml(thumbUrl)}" loading="lazy" alt="${escapeHtml(image.name)}">`;
            photoGrid.appendChild(cell);
          }

          photosSection.appendChild(photoGrid);
          wrapper.insertBefore(photosSection, nav);
        }

        if (data.folders.length === 0 && data.images.length === 0) {
          const emptyMsg = document.createElement('div');
          emptyMsg.textContent = 'This folder is empty.';
          emptyMsg.style.cssText = 'color:var(--text-secondary);padding:1rem 0';
          wrapper.insertBefore(emptyMsg, nav);
        }

      } catch (err) {
        loadingDiv.innerHTML = `<span style="color:var(--error)">Error: ${escapeHtml(err.message)}</span>`;
      }
    }

    loadContents();
  }

  // ---- Plex flow ----
  async function renderPlexCredential(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'wizard-step';
    wrapper.innerHTML = '<h3>Plex Server</h3><div id="plex-cred-content">Loading...</div>';
    appendNavButtons(wrapper, { back: 1 });
    container.appendChild(wrapper);

    try {
      const credentials = await api.getCredentials();
      const plexCreds = credentials.filter(c => c.service === 'plex');
      const credContent = wrapper.querySelector('#plex-cred-content');

      let html = '';
      if (plexCreds.length > 0) {
        html += `
          <div class="form-group">
            <label>Select existing server</label>
            <select id="plex-cred-select">
              ${plexCreds.map(c => `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join('')}
            </select>
          </div>
          <div class="wizard-btn-row">
            <button class="btn-primary" id="plex-use-existing">Use Selected</button>
            <button class="btn-danger btn-small" id="plex-delete-cred">Delete</button>
          </div>
          <hr style="border-color:var(--border);margin:1rem 0">
          <p style="color:var(--text-secondary);font-size:0.85rem">Or connect a new server:</p>
        `;
      }

      html += `
        <div class="wizard-help-box">
          <strong>Setup instructions:</strong>
          <ol>
            <li>Open your Plex server in a web browser (e.g. <code>http://192.168.1.x:32400/web</code>)</li>
            <li>The <strong>Server URL</strong> is your server's address with port, e.g. <code>http://192.168.1.x:32400</code></li>
            <li>To find your <strong>Plex Token</strong>:
              <ul>
                <li>Open any media item in Plex Web, click <strong>Get Info</strong>, then <strong>View XML</strong></li>
                <li>In the URL bar, find the <code>X-Plex-Token=</code> parameter and copy its value</li>
                <li>Or see the <a href="https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/" target="_blank" rel="noopener">Plex support article</a> for detailed steps</li>
              </ul>
            </li>
          </ol>
        </div>
        <div class="form-group">
          <label for="plex-url">Server URL</label>
          <input type="text" id="plex-url" placeholder="http://192.168.1.x:32400">
        </div>
        <div class="form-group">
          <label for="plex-token">Plex Token</label>
          <input type="text" id="plex-token" placeholder="Your Plex authentication token">
        </div>
        <button class="btn-primary" id="plex-connect-new">Connect</button>
      `;

      credContent.innerHTML = html;

      if (plexCreds.length > 0) {
        credContent.querySelector('#plex-use-existing').addEventListener('click', async () => {
          const credId = parseInt(credContent.querySelector('#plex-cred-select').value, 10);
          const btn = credContent.querySelector('#plex-use-existing');
          btn.disabled = true;
          btn.textContent = 'Connecting...';
          try {
            // Fetch server URL stored in the credential
            const info = await api.getPlexServerInfo(credId);
            if (!info.server_url) {
              showToast('No server URL stored for this credential. Please connect again.', 'error');
              btn.disabled = false;
              btn.textContent = 'Use Selected';
              return;
            }
            state.credentialId = credId;
            state.serverUrl = info.server_url;
            state.step = 3;
            renderStep();
          } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Use Selected';
          }
        });
        credContent.querySelector('#plex-delete-cred').addEventListener('click', async () => {
          const credId = parseInt(credContent.querySelector('#plex-cred-select').value, 10);
          if (!confirm('Delete this credential? Sources using it will need to be reconfigured.')) return;
          try {
            await api.deleteCredential(credId);
            showToast('Credential deleted', 'success');
            renderStep();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      }

      credContent.querySelector('#plex-connect-new').addEventListener('click', async () => {
        const url = credContent.querySelector('#plex-url').value.trim();
        const token = credContent.querySelector('#plex-token').value.trim();
        if (!url || !token) {
          showToast('Server URL and token are required', 'error');
          return;
        }
        try {
          const result = await api.connectPlex({ server_url: url, token });
          state.credentialId = result.credential_id;
          state.serverUrl = url;
          showToast(`Connected to ${result.server_name}`, 'success');
          state.step = 3;
          renderStep();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    } catch (err) {
      wrapper.querySelector('#plex-cred-content').innerHTML =
        `<p style="color:var(--error)">${escapeHtml(err.message)}</p>`;
    }
  }

  async function renderPlexLibrary(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'wizard-step';
    wrapper.innerHTML = '<h3>Select Photo Library</h3><div id="plex-libs">Loading libraries...</div>';
    appendNavButtons(wrapper, { back: 2 });
    container.appendChild(wrapper);

    try {
      const libraries = await api.getPlexLibraries(state.credentialId, state.serverUrl);
      const libsDiv = wrapper.querySelector('#plex-libs');

      if (libraries.length === 0) {
        libsDiv.innerHTML = '<p>No photo libraries found on this server.</p>';
        return;
      }

      libsDiv.innerHTML = '';
      for (const lib of libraries) {
        const item = document.createElement('div');
        item.className = 'wizard-type-card';
        item.innerHTML = `
          <div class="wizard-type-title">${escapeHtml(lib.title)}</div>
          <div class="wizard-type-desc">${escapeHtml(lib.count_label || 'Browse to inspect')}</div>
        `;
        item.addEventListener('click', () => {
          state.sectionId = lib.key;
          state.selectedPath = lib.key;
          state.plexAlbumKey = null;
          state.sourceName = lib.title;
          state.step = 4;
          renderStep();
        });
        libsDiv.appendChild(item);
      }
    } catch (err) {
      wrapper.querySelector('#plex-libs').innerHTML =
        `<p style="color:var(--error)">${escapeHtml(err.message)}</p>`;
    }
  }

  // ---- Plex album browser ----
  async function renderPlexBrowse(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'wizard-step';
    container.appendChild(wrapper);

    const PHOTO_PREVIEW_LIMIT = 60;
    const currentPath = [];
    let photoPage = 1;

    function resetPhotoPage() {
      photoPage = 1;
    }

    function selectScope(albumKey, albumTitle) {
      state.plexAlbumKey = albumKey;
      if (albumTitle) state.sourceName = albumTitle;
      state.step = 5;
      renderStep();
    }

    async function loadContents() {
      wrapper.innerHTML = '';

      const header = document.createElement('h3');
      header.textContent = 'Browse Plex Library';
      wrapper.appendChild(header);

      const intro = document.createElement('p');
      intro.className = 'inline-note mb-1';
      intro.textContent = 'Browse albums and preview photos here. The next step lets you scan the selected scope and choose the exact photos to include.';
      wrapper.appendChild(intro);

      const breadcrumbBar = document.createElement('div');
      breadcrumbBar.className = 'plex-breadcrumbs';

      const rootCrumb = document.createElement('span');
      rootCrumb.className = 'plex-breadcrumb';
      rootCrumb.textContent = state.sourceName;
      if (currentPath.length > 0) {
        rootCrumb.classList.add('clickable');
        rootCrumb.addEventListener('click', () => {
          currentPath.length = 0;
          resetPhotoPage();
          loadContents();
        });
      }
      breadcrumbBar.appendChild(rootCrumb);

      for (let i = 0; i < currentPath.length; i++) {
        const sep = document.createElement('span');
        sep.className = 'plex-breadcrumb-sep';
        sep.textContent = ' \u203A ';
        breadcrumbBar.appendChild(sep);

        const crumb = document.createElement('span');
        crumb.className = 'plex-breadcrumb';
        crumb.textContent = currentPath[i].title;
        if (i < currentPath.length - 1) {
          crumb.classList.add('clickable');
          const depth = i + 1;
          crumb.addEventListener('click', () => {
            currentPath.length = depth;
            resetPhotoPage();
            loadContents();
          });
        }
        breadcrumbBar.appendChild(crumb);
      }

      wrapper.appendChild(breadcrumbBar);

      const actionBar = document.createElement('div');
      actionBar.className = 'wizard-btn-row';

      if (currentPath.length === 0) {
        const selectAllBtn = document.createElement('button');
        selectAllBtn.className = 'btn-primary btn-small';
        selectAllBtn.textContent = 'Review Entire Library';
        selectAllBtn.addEventListener('click', () => selectScope(null, null));
        actionBar.appendChild(selectAllBtn);
      } else {
        const current = currentPath[currentPath.length - 1];
        const selectAlbumBtn = document.createElement('button');
        selectAlbumBtn.className = 'btn-primary btn-small';
        selectAlbumBtn.textContent = `Review “${current.title}”`;
        selectAlbumBtn.addEventListener('click', () => selectScope(current.ratingKey, current.title));
        actionBar.appendChild(selectAlbumBtn);
      }

      wrapper.appendChild(actionBar);

      const loadingDiv = document.createElement('div');
      loadingDiv.textContent = 'Loading...';
      loadingDiv.style.cssText = 'color:var(--text-secondary);padding:1rem 0';
      wrapper.appendChild(loadingDiv);

      const nav = document.createElement('div');
      nav.className = 'wizard-nav';
      nav.style.marginTop = '1.25rem';

      const backBtn = document.createElement('button');
      backBtn.className = 'btn-secondary btn-small';
      backBtn.textContent = 'Back';
      backBtn.addEventListener('click', () => {
        if (currentPath.length > 0) {
          currentPath.pop();
          resetPhotoPage();
          loadContents();
        } else {
          state.step = 3;
          renderStep();
        }
      });
      nav.appendChild(backBtn);
      wrapper.appendChild(nav);

      try {
        let data;
        if (currentPath.length === 0) {
          data = await api.getPlexSectionContents(state.credentialId, state.sectionId, state.serverUrl);
        } else {
          const current = currentPath[currentPath.length - 1];
          data = await api.getPlexContainerChildren(state.credentialId, current.ratingKey, state.serverUrl);
        }

        loadingDiv.remove();

        if (data.albums.length > 0) {
          const albumsSection = document.createElement('div');
          albumsSection.innerHTML = `<div class="inline-note mb-1">${data.albums.length} album${data.albums.length !== 1 ? 's' : ''}</div>`;

          const albumGrid = document.createElement('div');
          albumGrid.className = 'plex-album-grid';

          for (const album of data.albums) {
            const card = document.createElement('div');
            card.className = 'plex-album-card';

            const thumbUrl = album.thumb
              ? api.getPlexThumbnailUrl(state.credentialId, album.thumb, state.serverUrl)
              : '';
            const countLabel = album.leafCount === null || album.leafCount === undefined
              ? 'Browse to inspect'
              : `${album.leafCount} photo${album.leafCount === 1 ? '' : 's'}`;

            card.innerHTML = `
              ${thumbUrl ? `<img src="${escapeHtml(thumbUrl)}" class="plex-album-thumb" loading="lazy" alt="">` : '<div class="plex-album-thumb plex-album-no-thumb"></div>'}
              <div class="plex-album-info">
                <div class="plex-album-title">${escapeHtml(album.title)}</div>
                <div class="plex-album-count">${escapeHtml(countLabel)}</div>
              </div>
              <button class="plex-album-select-btn btn-primary btn-small">Review</button>
            `;

            card.addEventListener('click', (event) => {
              if (event.target.closest('.plex-album-select-btn')) return;
              currentPath.push({ title: album.title, ratingKey: album.ratingKey });
              resetPhotoPage();
              loadContents();
            });

            card.querySelector('.plex-album-select-btn').addEventListener('click', (event) => {
              event.stopPropagation();
              selectScope(album.ratingKey, album.title);
            });

            albumGrid.appendChild(card);
          }

          albumsSection.appendChild(albumGrid);
          wrapper.insertBefore(albumsSection, nav);
        }

        if (data.photos.length > 0) {
          const totalPages = Math.max(1, Math.ceil(data.photos.length / PHOTO_PREVIEW_LIMIT));
          photoPage = Math.min(photoPage, totalPages);
          const start = (photoPage - 1) * PHOTO_PREVIEW_LIMIT;
          const end = start + PHOTO_PREVIEW_LIMIT;
          const pagePhotos = data.photos.slice(start, end);

          const photosSection = document.createElement('div');
          const label = data.photos.length > PHOTO_PREVIEW_LIMIT
            ? `${data.photos.length} photos at this level · Page ${photoPage} of ${totalPages}`
            : `${data.photos.length} photo${data.photos.length !== 1 ? 's' : ''}`;
          photosSection.innerHTML = `<div class="inline-note" style="margin:0.75rem 0 0.5rem">${label}</div>`;

          const photoGrid = document.createElement('div');
          photoGrid.className = 'plex-photo-grid';

          for (const photo of pagePhotos) {
            const cell = document.createElement('div');
            cell.className = 'plex-photo-cell';

            const thumbUrl = photo.thumb
              ? api.getPlexThumbnailUrl(state.credentialId, photo.thumb, state.serverUrl)
              : '';

            if (thumbUrl) {
              cell.innerHTML = `<img src="${escapeHtml(thumbUrl)}" loading="lazy" alt="${escapeHtml(photo.title)}">`;
            } else {
              cell.textContent = photo.title;
              cell.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:var(--text-secondary)';
            }

            photoGrid.appendChild(cell);
          }

          photosSection.appendChild(photoGrid);

          if (totalPages > 1) {
            const pager = document.createElement('div');
            pager.className = 'wizard-btn-row';
            pager.style.marginTop = '0.75rem';

            const prevBtn = document.createElement('button');
            prevBtn.className = 'btn-secondary btn-small';
            prevBtn.textContent = 'Previous Page';
            prevBtn.disabled = photoPage === 1;
            prevBtn.addEventListener('click', () => {
              if (photoPage === 1) return;
              photoPage -= 1;
              loadContents();
            });

            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn-secondary btn-small';
            nextBtn.textContent = 'Next Page';
            nextBtn.disabled = photoPage === totalPages;
            nextBtn.addEventListener('click', () => {
              if (photoPage === totalPages) return;
              photoPage += 1;
              loadContents();
            });

            pager.appendChild(prevBtn);
            pager.appendChild(nextBtn);
            photosSection.appendChild(pager);
          }

          wrapper.insertBefore(photosSection, nav);
        }

        if (data.albums.length === 0 && data.photos.length === 0) {
          const emptyMsg = document.createElement('div');
          emptyMsg.textContent = 'No albums or photos found at this level.';
          emptyMsg.style.cssText = 'color:var(--text-secondary);padding:1rem 0';
          wrapper.insertBefore(emptyMsg, nav);
        }
      } catch (err) {
        loadingDiv.innerHTML = `<span style="color:var(--error)">Error: ${escapeHtml(err.message)}</span>`;
      }
    }

    loadContents();
  }
  async function upsertTemporarySource(sourceData) {
    if (state.createdSourceId) {
      await api.updateSource(state.createdSourceId, sourceData);
      return { id: state.createdSourceId, ...sourceData };
    }

    const source = await api.createSource(sourceData);
    state.createdSourceId = source.id;
    return source;
  }

  async function applySelectedImages(sourceId) {
    if (state.scannedImages.length === 0) return;

    const selectedPaths = new Set(state.selectedImagePaths || []);
    const deselectedIds = state.scannedImages
      .filter(img => !selectedPaths.has(img.file_path))
      .map(img => img.id);

    if (deselectedIds.length > 0) {
      await api.updateBulkImageSelection(sourceId, 0, deselectedIds);
    }
  }

  // ---- Shared steps ----
  async function renderScanAndPick(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'wizard-step';
    wrapper.innerHTML = `
      <h3>Select Photos</h3>
      <div id="scan-status" class="wizard-status-card wizard-status-card-loading">
        Scanning source and preparing previews...
      </div>
      <div id="picker-container"></div>
    `;

    const backStep = state.sourceType === 'local' ? 2 : (state.sourceType === 'dropbox' ? 3 : 4);
    const nextStep = state.sourceType === 'local' ? 4 : (state.sourceType === 'plex' ? 6 : 5);
    appendNavButtons(wrapper, { back: backStep });
    container.appendChild(wrapper);

    const statusEl = wrapper.querySelector('#scan-status');
    const pickerContainer = wrapper.querySelector('#picker-container');

    try {
      const sourceData = buildSourceData();
      const nextSignature = JSON.stringify(sourceData);
      if (state.scanSignature !== nextSignature) {
        state.selectedImageIds = [];
        state.selectedImagePaths = null;
      }

      const source = await upsertTemporarySource(sourceData);

      statusEl.textContent = 'Scanning source for images...';
      const scanResult = await api.scanSource(source.id);
      state.scanSignature = nextSignature;

      if (scanResult.count === 0) {
        state.scannedImages = [];
        state.selectedImageIds = [];
        state.selectedImagePaths = null;
        statusEl.className = 'wizard-status-card wizard-status-card-empty';
        statusEl.textContent = 'No images were found in this source yet. You can still save it and scan again later.';

        const skipBtn = document.createElement('button');
        skipBtn.className = 'btn-primary mt-1';
        skipBtn.textContent = 'Continue Anyway';
        skipBtn.addEventListener('click', () => {
          state.step = nextStep;
          renderStep();
        });
        pickerContainer.appendChild(skipBtn);
        return;
      }

      const images = await api.getSourceImages(source.id);
      const selectedPaths = new Set(state.selectedImagePaths || []);
      const hasExistingSelection = Array.isArray(state.selectedImagePaths);
      const pickerImages = images.map(img => ({
        ...img,
        selected: hasExistingSelection ? (selectedPaths.has(img.file_path) ? 1 : 0) : 1,
      }));

      state.scannedImages = images;
      state.selectedImageIds = pickerImages.filter(img => img.selected !== 0).map(img => img.id);
      state.selectedImagePaths = pickerImages.filter(img => img.selected !== 0).map(img => img.file_path);

      statusEl.className = 'wizard-status-card wizard-status-card-ready';
      statusEl.textContent = `Found ${scanResult.count} image${scanResult.count === 1 ? '' : 's'}. Choose which ones should appear in this source.`;

      const picker = createPhotoPicker({
        images: pickerImages,
        onSelectionChange: (ids) => {
          state.selectedImageIds = ids;
          state.selectedImagePaths = pickerImages
            .filter(img => ids.includes(img.id))
            .map(img => img.file_path);
        },
      });

      pickerContainer.appendChild(picker.element);

      const continueBtn = document.createElement('button');
      continueBtn.className = 'btn-primary mt-1';
      continueBtn.style.marginTop = '0.75rem';
      continueBtn.textContent = 'Continue';
      continueBtn.addEventListener('click', () => {
        state.step = nextStep;
        renderStep();
      });
      pickerContainer.appendChild(continueBtn);

    } catch (err) {
      statusEl.className = 'wizard-status-card wizard-status-card-error';
      statusEl.textContent = `Error: ${err.message}`;
    }
  }

  function renderNameAndSave(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'wizard-step';

    const prevStep = state.sourceType === 'local' ? 3 : (state.sourceType === 'plex' ? 5 : 4);

    wrapper.innerHTML = `
      <h3>Name Your Source</h3>
      <div class="form-group">
        <label for="wiz-source-name">Source Name</label>
        <input type="text" id="wiz-source-name" value="${escapeHtml(state.sourceName)}" required>
      </div>
      <div class="form-group">
        <div class="checkbox-group">
          <input type="checkbox" id="wiz-subfolder-final" ${state.includeSubfolders ? 'checked' : ''}>
          <label for="wiz-subfolder-final" style="margin:0">Include subfolders</label>
        </div>
      </div>
      <div class="wizard-btn-row">
        <button class="btn-secondary" id="wiz-back">Back</button>
        <button class="btn-primary" id="wiz-save">Save Source</button>
      </div>
    `;

    wrapper.querySelector('#wiz-back').addEventListener('click', () => {
      state.step = prevStep;
      renderStep();
    });

    wrapper.querySelector('#wiz-save').addEventListener('click', async () => {
      const name = wrapper.querySelector('#wiz-source-name').value.trim();
      if (!name) {
        showToast('Name is required', 'error');
        return;
      }

      const saveBtn = wrapper.querySelector('#wiz-save');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        const includeSubfolders = wrapper.querySelector('#wiz-subfolder-final').checked ? 1 : 0;

        if (state.createdSourceId) {
          await api.updateSource(state.createdSourceId, {
            name,
            include_subfolders: includeSubfolders,
          });

          await applySelectedImages(state.createdSourceId);

          if (includeSubfolders !== (state.includeSubfolders ? 1 : 0)) {
            await api.scanSource(state.createdSourceId);
          }
        } else {
          const sourceData = buildSourceData();
          sourceData.name = name;
          sourceData.include_subfolders = includeSubfolders;
          saveBtn.textContent = 'Creating...';
          const newSource = await api.createSource(sourceData);
          state.createdSourceId = newSource.id;
          saveBtn.textContent = 'Scanning...';
          await api.scanSource(newSource.id);
        }

        state.includeSubfolders = includeSubfolders === 1;

        state.wizardCompleted = true;
        showToast('Source added successfully', 'success');
        modal.close();
        if (onComplete) onComplete();
      } catch (err) {
        showToast(err.message, 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Source';
      }
    });

    container.appendChild(wrapper);
  }

  function buildSourceData() {
    let path = state.selectedPath;
    if (state.sourceType === 'plex' && state.plexAlbumKey) {
      path = `${state.sectionId}/album/${state.plexAlbumKey}`;
    }
    const data = {
      name: state.sourceName || 'New Source',
      type: state.sourceType,
      path,
      include_subfolders: state.includeSubfolders ? 1 : 0,
    };
    if (state.credentialId) {
      data.credential_id = state.credentialId;
    }
    if (state.serverUrl) {
      data.plex_server_url = state.serverUrl;
    }
    return data;
  }

  function appendNavButtons(wrapper, { back }) {
    if (!back) return;
    const nav = document.createElement('div');
    nav.className = 'wizard-nav';
    const backBtn = document.createElement('button');
    backBtn.className = 'btn-secondary btn-small';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', () => {
      state.step = back;
      renderStep();
    });
    nav.appendChild(backBtn);
    wrapper.appendChild(nav);
  }
}







