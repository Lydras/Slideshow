import { $ } from '../utils/dom.js';

export function showModal({ title, content, onClose }) {
  const existing = $('#global-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'global-modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="modal-close" id="global-modal-close">&times;</button>
      </div>
      <div id="global-modal-body"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  const body = $('#global-modal-body');
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    body.appendChild(content);
  }

  const close = () => {
    overlay.remove();
    if (onClose) onClose();
  };

  $('#global-modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  return { close, body };
}
