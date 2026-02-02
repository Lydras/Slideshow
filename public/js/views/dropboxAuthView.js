import { $ } from '../utils/dom.js';
import { showToast } from '../components/toast.js';
import { api } from '../api.js';

export async function renderDropboxAuthView() {
  const viewContainer = $('#view');

  viewContainer.innerHTML = `
    <div class="view-container">
      <h1>Dropbox Authorization</h1>
      <p>Processing Dropbox authorization...</p>
    </div>
  `;

  // Handle OAuth callback - the token exchange is done server-side
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  if (code) {
    showToast('Dropbox connected successfully', 'success');
    window.location.hash = '#/sources';
  } else {
    showToast('No authorization code received', 'error');
    window.location.hash = '#/sources';
  }

  return { destroy() {} };
}
