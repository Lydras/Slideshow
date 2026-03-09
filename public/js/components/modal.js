import { $, escapeHtml } from '../utils/dom.js';

export function showModal({ title, content, onClose }) {
  const existing = $('#global-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'global-modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="global-modal-title">
      <div class="modal-header">
        <h2 id="global-modal-title">${escapeHtml(title)}</h2>
        <button class="modal-close" id="global-modal-close" aria-label="Close modal">&times;</button>
      </div>
      <div id="global-modal-body"></div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');

  const body = $('#global-modal-body');
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    body.appendChild(content);
  }

  const handleEscape = (event) => {
    if (event.key === 'Escape') {
      close();
    }
  };

  const close = () => {
    document.removeEventListener('keydown', handleEscape);
    document.body.classList.remove('modal-open');
    overlay.remove();
    if (onClose) onClose();
  };

  document.addEventListener('keydown', handleEscape);
  $('#global-modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  return { close, body };
}
