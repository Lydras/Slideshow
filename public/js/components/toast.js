let container = null;

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed; top: 1rem; right: 1rem; z-index: 9999;
      display: flex; flex-direction: column; gap: 0.5rem;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  const borderColors = {
    info: 'rgba(74, 158, 255, 0.5)',
    success: 'rgba(46, 213, 115, 0.5)',
    error: 'rgba(255, 71, 87, 0.5)',
    warning: 'rgba(255, 165, 2, 0.5)',
  };
  const textColors = {
    info: '#f0f0f5',
    success: '#f0f0f5',
    error: '#f0f0f5',
    warning: '#f0f0f5',
  };

  toast.style.cssText = `
    background: rgba(30, 45, 55, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    color: ${textColors[type] || textColors.info};
    padding: 0.85rem 1.25rem;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 500;
    pointer-events: auto;
    opacity: 0;
    transform: translateX(100%);
    transition: opacity 0.3s, transform 0.3s;
    max-width: 350px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-left: 3px solid ${borderColors[type] || borderColors.info};
  `;
  toast.textContent = message;

  getContainer().appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
