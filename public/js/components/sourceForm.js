import { $ } from '../utils/dom.js';
import { showToast } from './toast.js';
import { api } from '../api.js';

export function createSourceForm({ source = {}, onSave, onCancel }) {
  const form = document.createElement('form');
  form.innerHTML = `
    <div class="form-group">
      <label for="sf-name">Name</label>
      <input type="text" id="sf-name" value="${escapeHtml(source.name || '')}" required>
    </div>
    <div class="form-group">
      <label for="sf-type">Type</label>
      <select id="sf-type">
        <option value="local" ${source.type === 'local' ? 'selected' : ''}>Local</option>
        <option value="dropbox" ${source.type === 'dropbox' ? 'selected' : ''}>Dropbox</option>
        <option value="plex" ${source.type === 'plex' ? 'selected' : ''}>Plex</option>
      </select>
    </div>
    <div class="form-group">
      <label for="sf-path">Path</label>
      <input type="text" id="sf-path" value="${escapeHtml(source.path || '')}" required>
    </div>
    <div class="form-group">
      <div class="checkbox-group">
        <input type="checkbox" id="sf-subfolders" ${source.include_subfolders !== 0 ? 'checked' : ''}>
        <label for="sf-subfolders" style="margin:0">Include subfolders</label>
      </div>
    </div>
    <div class="settings-actions">
      <button type="submit" class="btn-primary">Save</button>
      <button type="button" class="btn-secondary" id="sf-cancel">Cancel</button>
    </div>
  `;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: form.querySelector('#sf-name').value,
      type: form.querySelector('#sf-type').value,
      path: form.querySelector('#sf-path').value,
      include_subfolders: form.querySelector('#sf-subfolders').checked ? 1 : 0,
    };
    if (onSave) onSave(data);
  });

  const cancelBtn = form.querySelector('#sf-cancel');
  if (cancelBtn && onCancel) {
    cancelBtn.addEventListener('click', onCancel);
  }

  return form;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
