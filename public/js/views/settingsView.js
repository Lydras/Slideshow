import { api, setAuthToken } from '../api.js';
import { showToast } from '../components/toast.js';
import { $ } from '../utils/dom.js';
import { navigateTo } from '../utils/router.js';

export async function renderSettingsView() {
  const viewContainer = $('#view');
  let settings;

  try {
    settings = await api.getSettings();
  } catch (err) {
    viewContainer.innerHTML = `<div class="view-container"><p>Failed to load settings.</p></div>`;
    return { destroy() {} };
  }

  viewContainer.innerHTML = `
    <div class="view-container">
      <h1>Settings</h1>
      <form class="settings-form" id="settings-form">
        <div class="form-group">
          <label for="interval_seconds">Slide Interval (seconds)</label>
          <input type="number" id="interval_seconds" name="interval_seconds"
            value="${settings.interval_seconds}" min="1" max="300">
        </div>

        <div class="form-group">
          <label for="order">Slide Order</label>
          <select id="order" name="order">
            <option value="sequential" ${settings.order === 'sequential' ? 'selected' : ''}>Sequential</option>
            <option value="random" ${settings.order === 'random' ? 'selected' : ''}>Random</option>
          </select>
        </div>

        <div class="form-group">
          <label for="transition">Transition Effect</label>
          <select id="transition" name="transition">
            <option value="fade" ${settings.transition === 'fade' ? 'selected' : ''}>Fade</option>
            <option value="slide" ${settings.transition === 'slide' ? 'selected' : ''}>Slide</option>
            <option value="none" ${settings.transition === 'none' ? 'selected' : ''}>None</option>
          </select>
        </div>

        <div class="form-group">
          <label for="transition_duration_ms">Transition Duration (ms)</label>
          <input type="number" id="transition_duration_ms" name="transition_duration_ms"
            value="${settings.transition_duration_ms}" min="0" max="5000" step="100">
        </div>

        <div class="form-group">
          <div class="checkbox-group">
            <input type="checkbox" id="fullscreen_on_start" name="fullscreen_on_start"
              ${settings.fullscreen_on_start === 'true' ? 'checked' : ''}>
            <label for="fullscreen_on_start" style="margin:0">Start in fullscreen</label>
          </div>
        </div>

        <div class="form-group">
          <div class="checkbox-group">
            <input type="checkbox" id="include_subfolders" name="include_subfolders"
              ${settings.include_subfolders === 'true' ? 'checked' : ''}>
            <label for="include_subfolders" style="margin:0">Include subfolders (default for new sources)</label>
          </div>
        </div>

        <div class="settings-actions">
          <button type="submit" class="btn-primary">Save Settings</button>
        </div>
      </form>

      <div class="settings-section" style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--border)">
        <h2>Image Cache</h2>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.75rem">
          Remote images (Dropbox, Plex) are cached locally for faster loading.
        </p>
        <div id="cache-stats" style="font-size:0.9rem;margin-bottom:0.75rem">Loading cache stats...</div>
        <button class="btn-danger btn-small" id="btn-clear-cache">Clear Cache</button>
      </div>

      <div class="settings-section" style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--border)">
        <h2>Authentication</h2>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.75rem">
          Set a password to protect settings and source management. The slideshow display remains accessible without login.
        </p>
        <div id="auth-status" style="font-size:0.9rem;margin-bottom:0.75rem">Loading...</div>
        <div id="auth-form-area"></div>
      </div>
    </div>
  `;

  // Load cache stats
  async function loadCacheStats() {
    try {
      const stats = await api.getCacheStats();
      const el = $('#cache-stats');
      if (el) el.textContent = `${stats.files} files, ${stats.sizeMB} MB used (max ${stats.maxMB} MB)`;
    } catch (err) { console.warn('Failed to load cache stats:', err.message); }
  }
  loadCacheStats();

  $('#btn-clear-cache').addEventListener('click', async () => {
    if (!confirm('Clear all cached images? Remote images will need to be re-downloaded.')) return;
    try {
      const result = await api.clearCache();
      showToast(result.message, 'success');
      loadCacheStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Load auth status and render auth management
  async function loadAuthUI() {
    try {
      const status = await api.getAuthStatus();
      const statusEl = $('#auth-status');
      const formArea = $('#auth-form-area');
      statusEl.textContent = status.enabled ? 'Password is set. Authentication is enabled.' : 'No password set. Authentication is disabled.';

      if (status.enabled) {
        formArea.innerHTML = `
          <div class="form-group">
            <label for="auth-new-pw">New Password (leave empty to remove)</label>
            <input type="password" id="auth-new-pw" placeholder="New password (or empty to disable)">
          </div>
          <div style="display:flex;gap:0.5rem">
            <button class="btn-primary btn-small" id="btn-change-pw">Change Password</button>
            <button class="btn-danger btn-small" id="btn-remove-pw">Disable Auth</button>
            <button class="btn-secondary btn-small" id="btn-logout">Logout</button>
          </div>
        `;
        formArea.querySelector('#btn-change-pw').addEventListener('click', async () => {
          const newPw = formArea.querySelector('#auth-new-pw').value;
          if (!newPw) { showToast('Enter a new password', 'error'); return; }
          try {
            const result = await api.setPassword(newPw);
            if (result.token) setAuthToken(result.token);
            showToast('Password changed', 'success');
            loadAuthUI();
          } catch (err) { showToast(err.message, 'error'); }
        });
        formArea.querySelector('#btn-remove-pw').addEventListener('click', async () => {
          if (!confirm('Disable authentication? Anyone on the network will be able to change settings.')) return;
          try {
            await api.setPassword(null);
            setAuthToken(null);
            showToast('Authentication disabled', 'success');
            loadAuthUI();
          } catch (err) { showToast(err.message, 'error'); }
        });
        formArea.querySelector('#btn-logout').addEventListener('click', async () => {
          await api.logout();
          setAuthToken(null);
          showToast('Logged out', 'success');
          navigateTo('#/login');
        });
      } else {
        formArea.innerHTML = `
          <div class="form-group">
            <label for="auth-set-pw">Set Password</label>
            <input type="password" id="auth-set-pw" placeholder="Choose a password (min 4 characters)">
          </div>
          <button class="btn-primary btn-small" id="btn-set-pw">Enable Authentication</button>
        `;
        formArea.querySelector('#btn-set-pw').addEventListener('click', async () => {
          const pw = formArea.querySelector('#auth-set-pw').value;
          if (!pw) { showToast('Enter a password', 'error'); return; }
          try {
            const result = await api.setPassword(pw);
            if (result.token) setAuthToken(result.token);
            showToast('Authentication enabled', 'success');
            loadAuthUI();
          } catch (err) { showToast(err.message, 'error'); }
        });
      }
    } catch (err) {
      $('#auth-status').textContent = 'Failed to load auth status';
    }
  }
  loadAuthUI();

  const form = $('#settings-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const interval = parseInt(form.interval_seconds.value, 10);
    if (isNaN(interval) || interval < 1 || interval > 300) {
      showToast('Slide interval must be between 1 and 300 seconds', 'error');
      return;
    }

    const duration = parseInt(form.transition_duration_ms.value, 10);
    if (isNaN(duration) || duration < 0 || duration > 5000) {
      showToast('Transition duration must be between 0 and 5000ms', 'error');
      return;
    }

    try {
      await api.updateSettings({
        interval_seconds: interval,
        order: form.order.value,
        transition: form.transition.value,
        transition_duration_ms: duration,
        fullscreen_on_start: form.fullscreen_on_start.checked ? 'true' : 'false',
        include_subfolders: form.include_subfolders.checked ? 'true' : 'false',
      });
      showToast('Settings saved', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  return { destroy() {} };
}
