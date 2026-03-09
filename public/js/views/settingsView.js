import { api, setAuthToken } from '../api.js';
import { showToast } from '../components/toast.js';
import { $ } from '../utils/dom.js';
import { navigateTo } from '../utils/router.js';

export async function renderSettingsView() {
  const viewContainer = $('#view');
  let settings;
  let playlists = [];

  try {
    [settings, playlists] = await Promise.all([
      api.getSettings(),
      api.getPlaylists().catch(() => []),
    ]);
  } catch (err) {
    viewContainer.innerHTML = '<div class="page-shell"><section class="empty-panel"><h2>Settings are unavailable</h2><p>Try refreshing the page. If the issue persists, check the server logs.</p></section></div>';
    return { destroy() {} };
  }

  const activePlaylist = playlists.find(playlist => String(playlist.id) === String(settings.active_playlist_id));

  viewContainer.innerHTML = `
    <div class="page-shell">
      <section class="page-hero">
        <div>
          <p class="page-kicker">Control Room</p>
          <div class="page-title-row">
            <h1>Playback & Access</h1>
            <span class="pill">System settings</span>
          </div>
          <p class="page-subtitle">Tune slideshow playback, pick the default collection, watch cache health, and decide whether the admin experience stays password protected.</p>
        </div>
      </section>

      <section class="stats-grid">
        <article class="stat-card">
          <div class="stat-label">Slide interval</div>
          <div class="stat-value">${settings.interval_seconds}s</div>
          <div class="stat-meta">Current playback cadence</div>
        </article>
        <article class="stat-card">
          <div class="stat-label">Transition</div>
          <div class="stat-value">${settings.transition}</div>
          <div class="stat-meta">${settings.transition_duration_ms}ms duration</div>
        </article>
        <article class="stat-card">
          <div class="stat-label">Default playlist</div>
          <div class="stat-value">${activePlaylist ? '1' : '0'}</div>
          <div class="stat-meta">${activePlaylist ? activePlaylist.name : 'All sources are eligible'}</div>
        </article>
      </section>

      <section class="settings-grid">
        <div class="settings-card-stack">
          <article class="section-card">
            <div class="section-heading">
              <div>
                <h2>Slideshow behavior</h2>
                <p>Control playback timing, ordering, transitions, and the default source behavior for newly added folders.</p>
              </div>
            </div>
            <form class="settings-form" id="settings-form">
              <div class="settings-form-section">
                <div class="form-group">
                  <label for="interval_seconds">Slide interval (seconds)</label>
                  <input type="number" id="interval_seconds" name="interval_seconds" value="${settings.interval_seconds}" min="1" max="300">
                </div>
                <div class="form-group">
                  <label for="order">Slide order</label>
                  <select class="settings-select" id="order" name="order">
                    <option value="sequential" ${settings.order === 'sequential' ? 'selected' : ''}>Sequential</option>
                    <option value="random" ${settings.order === 'random' ? 'selected' : ''}>Random</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="transition">Transition effect</label>
                  <select class="settings-select" id="transition" name="transition">
                    <option value="fade" ${settings.transition === 'fade' ? 'selected' : ''}>Fade</option>
                    <option value="slide" ${settings.transition === 'slide' ? 'selected' : ''}>Slide</option>
                    <option value="none" ${settings.transition === 'none' ? 'selected' : ''}>None</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="transition_duration_ms">Transition duration (ms)</label>
                  <input type="number" id="transition_duration_ms" name="transition_duration_ms" value="${settings.transition_duration_ms}" min="0" max="5000" step="100">
                </div>
                <div class="form-group">
                  <label for="active_playlist_id">Default playlist</label>
                  <select class="settings-select" id="active_playlist_id" name="active_playlist_id">
                    <option value="">All sources</option>
                    ${playlists.map(playlist => `<option value="${playlist.id}" ${String(playlist.id) === String(settings.active_playlist_id) ? 'selected' : ''}>${playlist.name}</option>`).join('')}
                  </select>
                </div>
                <div class="settings-section-divider"></div>
                <div class="form-group">
                  <div class="checkbox-group">
                    <input type="checkbox" id="fullscreen_on_start" name="fullscreen_on_start" ${settings.fullscreen_on_start === 'true' ? 'checked' : ''}>
                    <label for="fullscreen_on_start">Start slideshows in fullscreen</label>
                  </div>
                </div>
                <div class="form-group">
                  <div class="checkbox-group">
                    <input type="checkbox" id="include_subfolders" name="include_subfolders" ${settings.include_subfolders === 'true' ? 'checked' : ''}>
                    <label for="include_subfolders">Include subfolders by default when creating sources</label>
                  </div>
                </div>
              </div>
              <div class="settings-actions">
                <button type="submit" class="btn-primary">Save Settings</button>
                <button type="button" class="btn-secondary" id="btn-reset-settings">Reload</button>
              </div>
            </form>
          </article>
        </div>

        <div class="settings-card-stack">
          <article class="section-card">
            <div class="section-heading">
              <div>
                <h2>Playback summary</h2>
                <p>Quick context for the current configuration.</p>
              </div>
            </div>
            <div class="settings-meta">
              <div class="settings-meta-row"><div><strong>Current order</strong><p>${settings.order === 'random' ? 'Randomized playback for variety.' : 'Sequential playback preserves the source order.'}</p></div></div>
              <div class="settings-meta-row"><div><strong>Transition profile</strong><p>${settings.transition} transition at ${settings.transition_duration_ms}ms.</p></div></div>
              <div class="settings-meta-row"><div><strong>Default scope</strong><p>${activePlaylist ? `Starts from the ${activePlaylist.name} playlist.` : 'Uses all selected photos from every source.'}</p></div></div>
            </div>
          </article>

          <article class="section-card">
            <div class="section-heading">
              <div>
                <h2>Image cache</h2>
                <p>Remote images are cached locally to keep navigation and playback quick once a file has been fetched.</p>
              </div>
            </div>
            <div id="cache-stats" class="inline-note">Loading cache stats...</div>
            <div class="settings-actions">
              <button class="btn-danger" id="btn-clear-cache">Clear Cache</button>
            </div>
          </article>

          <article class="section-card">
            <div class="section-heading">
              <div>
                <h2>Authentication</h2>
                <p>Protect the admin UI while keeping slideshow playback available on your local network.</p>
              </div>
            </div>
            <div id="auth-status" class="inline-note">Loading authentication status...</div>
            <div id="auth-form-area" class="settings-card-stack mt-1"></div>
          </article>
        </div>
      </section>
    </div>
  `;

  async function loadCacheStats() {
    try {
      const stats = await api.getCacheStats();
      const el = $('#cache-stats');
      if (el) {
        el.textContent = `${stats.files} cached files using ${stats.sizeMB} MB of ${stats.maxMB} MB.`;
      }
    } catch (err) {
      const el = $('#cache-stats');
      if (el) el.textContent = 'Cache statistics are unavailable right now.';
    }
  }

  async function loadAuthUI() {
    try {
      const status = await api.getAuthStatus();
      const statusEl = $('#auth-status');
      const formArea = $('#auth-form-area');
      statusEl.textContent = status.enabled
        ? 'Authentication is enabled for admin screens.'
        : 'Authentication is currently disabled.';

      if (status.enabled) {
        formArea.innerHTML = `
          <div class="form-group">
            <label for="auth-new-pw">New password</label>
            <input type="password" id="auth-new-pw" placeholder="Leave blank only if you plan to disable auth explicitly">
          </div>
          <div class="settings-actions">
            <button class="btn-primary btn-small" id="btn-change-pw">Change Password</button>
            <button class="btn-danger btn-small" id="btn-remove-pw">Disable Auth</button>
            <button class="btn-secondary btn-small" id="btn-logout">Log Out</button>
          </div>
        `;

        formArea.querySelector('#btn-change-pw').addEventListener('click', async () => {
          const newPassword = formArea.querySelector('#auth-new-pw').value;
          if (!newPassword) {
            showToast('Enter a new password first', 'error');
            return;
          }
          try {
            const result = await api.setPassword(newPassword);
            if (result.token) setAuthToken(result.token);
            showToast('Password changed', 'success');
            loadAuthUI();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });

        formArea.querySelector('#btn-remove-pw').addEventListener('click', async () => {
          if (!confirm('Disable authentication? Admin screens will be open to anyone on the network.')) return;
          try {
            await api.setPassword(null);
            setAuthToken(null);
            showToast('Authentication disabled', 'success');
            loadAuthUI();
          } catch (err) {
            showToast(err.message, 'error');
          }
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
            <label for="auth-set-pw">Choose a password</label>
            <input type="password" id="auth-set-pw" placeholder="Minimum 4 characters">
          </div>
          <div class="settings-actions">
            <button class="btn-primary btn-small" id="btn-set-pw">Enable Authentication</button>
          </div>
        `;

        formArea.querySelector('#btn-set-pw').addEventListener('click', async () => {
          const password = formArea.querySelector('#auth-set-pw').value;
          if (!password) {
            showToast('Enter a password first', 'error');
            return;
          }
          try {
            const result = await api.setPassword(password);
            if (result.token) setAuthToken(result.token);
            showToast('Authentication enabled', 'success');
            loadAuthUI();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      }
    } catch (err) {
      $('#auth-status').textContent = 'Authentication status is unavailable.';
    }
  }

  loadCacheStats();
  loadAuthUI();

  $('#btn-clear-cache').addEventListener('click', async () => {
    if (!confirm('Clear all cached remote images?')) return;
    try {
      const result = await api.clearCache();
      showToast(result.message, 'success');
      loadCacheStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  $('#btn-reset-settings').addEventListener('click', () => renderSettingsView());

  $('#settings-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const interval = parseInt($('#interval_seconds').value, 10);
    const duration = parseInt($('#transition_duration_ms').value, 10);

    if (isNaN(interval) || interval < 1 || interval > 300) {
      showToast('Slide interval must be between 1 and 300 seconds', 'error');
      return;
    }

    if (isNaN(duration) || duration < 0 || duration > 5000) {
      showToast('Transition duration must be between 0 and 5000ms', 'error');
      return;
    }

    try {
      await api.updateSettings({
        interval_seconds: interval,
        order: $('#order').value,
        transition: $('#transition').value,
        transition_duration_ms: duration,
        active_playlist_id: $('#active_playlist_id').value,
        fullscreen_on_start: $('#fullscreen_on_start').checked ? 'true' : 'false',
        include_subfolders: $('#include_subfolders').checked ? 'true' : 'false',
      });
      showToast('Settings saved', 'success');
      renderSettingsView();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  return { destroy() {} };
}
