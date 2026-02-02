import { api } from '../api.js';

export function createPhotoPicker({ images, onSelectionChange }) {
  const selectedIds = new Set(
    images.filter(img => img.selected !== 0).map(img => img.id)
  );

  const container = document.createElement('div');
  container.className = 'photo-picker';

  addPickerStyles();
  render();

  function render() {
    container.innerHTML = '';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'photo-picker-toolbar';

    const counter = document.createElement('span');
    counter.className = 'photo-picker-counter';
    updateCounter(counter);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'photo-picker-btn-group';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.className = 'btn-secondary btn-small';
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.addEventListener('click', () => {
      images.forEach(img => selectedIds.add(img.id));
      updateAllCheckboxes();
      updateCounter(counter);
      notifyChange();
    });

    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.className = 'btn-secondary btn-small';
    deselectAllBtn.textContent = 'Deselect All';
    deselectAllBtn.addEventListener('click', () => {
      selectedIds.clear();
      updateAllCheckboxes();
      updateCounter(counter);
      notifyChange();
    });

    btnGroup.appendChild(selectAllBtn);
    btnGroup.appendChild(deselectAllBtn);
    toolbar.appendChild(counter);
    toolbar.appendChild(btnGroup);
    container.appendChild(toolbar);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'photo-picker-grid';

    for (const img of images) {
      const cell = document.createElement('div');
      cell.className = 'photo-picker-cell';
      cell.dataset.imageId = img.id;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'photo-picker-checkbox';
      checkbox.checked = selectedIds.has(img.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          selectedIds.add(img.id);
        } else {
          selectedIds.delete(img.id);
        }
        cell.classList.toggle('photo-picker-cell-selected', checkbox.checked);
        updateCounter(counter);
        notifyChange();
      });

      const thumb = document.createElement('img');
      thumb.className = 'photo-picker-thumb';
      thumb.alt = img.file_name || '';
      thumb.dataset.src = api.getThumbnailUrl(img.source_id, img.id);
      thumb.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect fill="%23333" width="150" height="150"/%3E%3C/svg%3E';

      const label = document.createElement('div');
      label.className = 'photo-picker-label';
      label.textContent = img.file_name || '';
      label.title = img.file_name || '';

      cell.appendChild(checkbox);
      cell.appendChild(thumb);
      cell.appendChild(label);

      if (selectedIds.has(img.id)) {
        cell.classList.add('photo-picker-cell-selected');
      }

      grid.appendChild(cell);
    }

    container.appendChild(grid);

    // Set up lazy loading
    setupLazyLoading(grid);
  }

  function updateCounter(counterEl) {
    counterEl.textContent = `${selectedIds.size} of ${images.length} selected`;
  }

  function updateAllCheckboxes() {
    const checkboxes = container.querySelectorAll('.photo-picker-checkbox');
    checkboxes.forEach(cb => {
      const imageId = parseInt(cb.closest('.photo-picker-cell').dataset.imageId, 10);
      cb.checked = selectedIds.has(imageId);
      cb.closest('.photo-picker-cell').classList.toggle('photo-picker-cell-selected', cb.checked);
    });
  }

  function notifyChange() {
    if (onSelectionChange) {
      onSelectionChange([...selectedIds]);
    }
  }

  function setupLazyLoading(grid) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            delete img.dataset.src;
            observer.unobserve(img);
          }
        }
      }
    }, { root: grid.closest('.modal-content') || null, rootMargin: '100px' });

    grid.querySelectorAll('.photo-picker-thumb[data-src]').forEach(img => {
      observer.observe(img);
    });
  }

  function getSelectedIds() {
    return [...selectedIds];
  }

  return { element: container, getSelectedIds };
}

function addPickerStyles() {
  if (document.getElementById('photo-picker-styles')) return;
  const style = document.createElement('style');
  style.id = 'photo-picker-styles';
  style.textContent = `
    .photo-picker-toolbar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.6rem 0; margin-bottom: 0.75rem;
      border-bottom: 1px solid var(--glass-border);
    }
    .photo-picker-counter {
      font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;
    }
    .photo-picker-btn-group {
      display: flex; gap: 0.5rem;
    }
    .photo-picker-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 0.6rem;
      max-height: 55vh;
      overflow-y: auto;
      padding: 0.25rem;
    }
    .photo-picker-cell {
      position: relative; border-radius: 10px;
      border: 2px solid transparent;
      overflow: hidden; cursor: pointer;
      background: rgba(255, 255, 255, 0.03);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .photo-picker-cell:hover {
      border-color: var(--glass-border-light);
      transform: scale(1.02);
    }
    .photo-picker-cell-selected {
      border-color: var(--accent);
      box-shadow: 0 0 12px rgba(128, 255, 204, 0.2);
    }
    .photo-picker-checkbox {
      position: absolute; top: 8px; left: 8px; z-index: 2;
      width: 18px; height: 18px; cursor: pointer;
      accent-color: var(--accent);
    }
    .photo-picker-thumb {
      width: 100%; aspect-ratio: 1; object-fit: cover;
      display: block; background: rgba(0, 0, 0, 0.2);
    }
    .photo-picker-label {
      font-size: 0.7rem; padding: 4px 6px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      color: var(--text-secondary);
      background: rgba(0, 0, 0, 0.2);
    }
  `;
  document.head.appendChild(style);
}
