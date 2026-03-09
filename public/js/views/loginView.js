import { api, setAuthToken } from '../api.js';
import { showToast } from '../components/toast.js';
import { $ } from '../utils/dom.js';
import { navigateTo } from '../utils/router.js';

export async function renderLoginView() {
  const viewContainer = $('#view');

  viewContainer.innerHTML = `
    <div class="page-shell">
      <section class="page-hero">
        <div>
          <p class="page-kicker">Access</p>
          <div class="page-title-row">
            <h1>Admin Login</h1>
            <span class="pill">Protected</span>
          </div>
          <p class="page-subtitle">Sign in to manage sources, playlists, and playback settings. The slideshow view stays available for shared screens.</p>
        </div>
      </section>
      <section class="settings-grid">
        <article class="section-card">
          <form id="login-form" class="settings-form">
            <div class="form-group">
              <label for="login-password">Password</label>
              <input type="password" id="login-password" placeholder="Enter your admin password" required autofocus>
            </div>
            <div class="settings-actions">
              <button type="submit" class="btn-primary">Login</button>
              <a class="btn-secondary" href="#/slideshow">View slideshow</a>
            </div>
          </form>
        </article>
        <article class="section-card">
          <div class="settings-meta">
            <div class="settings-meta-row">
              <div>
                <strong>Why login exists</strong>
                <p>Authentication protects the curation tools while leaving the slideshow accessible for TV or wall-display screens on your network.</p>
              </div>
            </div>
            <div class="settings-meta-row">
              <div>
                <strong>After signing in</strong>
                <p>You will land on the Sources page so you can continue setup or manage the library immediately.</p>
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  `;

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $('#login-password').value;
    if (!password) return;

    try {
      const result = await api.login(password);
      setAuthToken(result.token);
      showToast('Logged in', 'success');
      navigateTo('#/sources');
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
    }
  });

  return { destroy() {} };
}
