import { api, setAuthToken } from '../api.js';
import { showToast } from '../components/toast.js';
import { $ } from '../utils/dom.js';
import { navigateTo } from '../utils/router.js';

export async function renderLoginView() {
  const viewContainer = $('#view');

  viewContainer.innerHTML = `
    <div class="view-container" style="max-width:400px;margin:3rem auto">
      <h1 style="text-align:center;margin-bottom:1.5rem">Login</h1>
      <form id="login-form">
        <div class="form-group">
          <label for="login-password">Password</label>
          <input type="password" id="login-password" placeholder="Enter password" required autofocus>
        </div>
        <button type="submit" class="btn-primary" style="width:100%">Login</button>
      </form>
      <p style="text-align:center;margin-top:1rem;font-size:0.85rem;color:var(--text-secondary)">
        <a href="#/slideshow" style="color:var(--accent)">View slideshow without login</a>
      </p>
    </div>
  `;

  const form = $('#login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
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
