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
  addModalStyles();

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

function addModalStyles() {
  if (document.getElementById('modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'modal-styles';
  style.textContent = `
    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      align-items: center; justify-content: center; z-index: 200;
    }
    .modal-content {
      background: rgba(30, 45, 55, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 1.75rem;
      width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto;
      box-shadow: var(--shadow-lg);
    }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.25rem;
    }
    .modal-header h2 {
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .modal-close {
      background: var(--glass-bg); color: var(--text-secondary); font-size: 1.25rem;
      padding: 0.25rem; width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 8px; border: 1px solid var(--glass-border);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .modal-close:hover {
      color: var(--text-primary);
      background: var(--glass-bg-hover);
      border-color: var(--glass-border-light);
    }
  `;
  document.head.appendChild(style);
}
