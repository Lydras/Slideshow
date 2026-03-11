import { api } from '../api.js';
import { showToast } from '../components/toast.js';
import { $, escapeHtml } from '../utils/dom.js';

let currentMode = 'newly-scanned';
let queueItems = [];
let currentIndex = 0;
let latestRequestId = 0;

export async function renderReviewQueueView() {
  const viewContainer = $('#view');
  let destroyed = false;

  function getCurrentItem() {
    return queueItems[currentIndex] || null;
  }

  function encodePathSegments(filePath) {
    return filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
  }

  function buildReviewImageUrl(item) {
    if (!item) return '';
    if (item.source_type === 'local') {
      return `/api/images/serve/local/${item.source_id}/${encodeURIComponent(item.file_path)}`;
    }
    if (item.source_type === 'dropbox') {
      return `/api/images/serve/dropbox/${item.source_id}${encodePathSegments(item.file_path)}`;
    }
    if (item.source_type === 'plex') {
      return `/api/images/serve/plex/${item.source_id}/${item.id}`;
    }
    return '';
  }

  function bindEvents() {
    document.querySelectorAll('[data-review-mode]').forEach(button => {
      button.addEventListener('click', () => {
        const nextMode = button.dataset.reviewMode;
        if (nextMode && nextMode !== currentMode) {
          loadQueue(nextMode);
        }
      });
    });

    document.querySelectorAll('[data-review-action]').forEach(button => {
      button.addEventListener('click', async () => {
        const action = button.dataset.reviewAction;
        if (action === 'skip') {
          handleSkip();
          return;
        }
        await handleReviewAction(action);
      });
    });
  }

  function renderLoading() {
    viewContainer.innerHTML = `
      <div class="page-shell review-queue-page">
        <section class="page-hero">
          <div>
            <p class="page-kicker">Library</p>
            <div class="page-title-row">
              <h1>Review Queue</h1>
              <span class="pill">Loading</span>
            </div>
            <p class="page-subtitle">Gathering photos that still need your attention.</p>
          </div>
        </section>
        <section class="empty-panel">
          <h2>Loading queue…</h2>
          <p>Please wait while the latest review items are collected.</p>
        </section>
      </div>
    `;
  }

  function renderError(message) {
    viewContainer.innerHTML = `
      <div class="page-shell review-queue-page">
        <section class="page-hero">
          <div>
            <p class="page-kicker">Library</p>
            <div class="page-title-row">
              <h1>Review Queue</h1>
              <span class="pill">Unavailable</span>
            </div>
            <p class="page-subtitle">The queue could not be loaded right now.</p>
          </div>
        </section>
        <section class="empty-panel">
          <h2>Queue unavailable</h2>
          <p>${escapeHtml(message)}</p>
          <div class="empty-actions">
            <button class="btn-primary" id="btn-review-retry">Retry</button>
            <a class="btn-secondary" href="#/sources">Open sources</a>
          </div>
        </section>
      </div>
    `;

    $('#btn-review-retry')?.addEventListener('click', () => loadQueue(currentMode));
  }

  function renderEmpty() {
    const modeLabel = currentMode === 'unreviewed' ? 'Unreviewed' : 'Newly scanned';
    viewContainer.innerHTML = `
      <div class="page-shell review-queue-page">
        <section class="page-hero">
          <div>
            <p class="page-kicker">Library</p>
            <div class="page-title-row">
              <h1>Review Queue</h1>
              <span class="pill">0 items</span>
            </div>
            <p class="page-subtitle">Process fresh scans quickly, then come back later for anything still unresolved.</p>
          </div>
          <div class="page-actions review-mode-toggle">
            <button class="btn-secondary ${currentMode === 'newly-scanned' ? 'review-mode-active' : ''}" data-review-mode="newly-scanned">Newly scanned</button>
            <button class="btn-secondary ${currentMode === 'unreviewed' ? 'review-mode-active' : ''}" data-review-mode="unreviewed">Unreviewed</button>
          </div>
        </section>
        <section class="empty-panel review-empty-panel">
          <h2>${modeLabel} queue is clear</h2>
          <p>There are no matching photos to review right now. Scan another source or switch queue modes.</p>
          <div class="empty-actions">
            <a class="btn-primary" href="#/sources">Scan sources</a>
            <button class="btn-secondary" data-review-mode="${currentMode === 'newly-scanned' ? 'unreviewed' : 'newly-scanned'}">Switch mode</button>
          </div>
        </section>
      </div>
    `;

    bindEvents();
  }

  function renderQueue() {
    const item = getCurrentItem();
    if (!item) {
      renderEmpty();
      return;
    }

    const position = currentIndex + 1;
    const total = queueItems.length;
    const reviewImageUrl = buildReviewImageUrl(item);
    const reviewedLabel = item.reviewed_at ? new Date(item.reviewed_at).toLocaleString() : 'Not reviewed yet';

    viewContainer.innerHTML = `
      <div class="page-shell review-queue-page">
        <section class="page-hero">
          <div>
            <p class="page-kicker">Library</p>
            <div class="page-title-row">
              <h1>Review Queue</h1>
              <span class="pill">${total} waiting</span>
            </div>
            <p class="page-subtitle">Approve, hide, skip, or favorite photos so the best memories show up more often on your home displays.</p>
          </div>
          <div class="page-actions review-mode-toggle">
            <button class="btn-secondary ${currentMode === 'newly-scanned' ? 'review-mode-active' : ''}" data-review-mode="newly-scanned">Newly scanned</button>
            <button class="btn-secondary ${currentMode === 'unreviewed' ? 'review-mode-active' : ''}" data-review-mode="unreviewed">Unreviewed</button>
          </div>
        </section>

        <section class="stats-grid review-queue-stats">
          <article class="stat-card">
            <div class="stat-label">Queue mode</div>
            <div class="stat-value review-stat-text">${currentMode === 'unreviewed' ? 'Unreviewed' : 'New'}</div>
            <div class="stat-meta">Current filter for review items</div>
          </article>
          <article class="stat-card">
            <div class="stat-label">Current position</div>
            <div class="stat-value review-stat-text">${position}/${total}</div>
            <div class="stat-meta">Progress through the loaded queue</div>
          </article>
          <article class="stat-card">
            <div class="stat-label">Favorite boost</div>
            <div class="stat-value review-stat-text">2x</div>
            <div class="stat-meta">Favorited photos appear twice as often in playback</div>
          </article>
        </section>

        <section class="review-queue-layout">
          <article class="section-card review-preview-card">
            <div class="section-heading">
              <div>
                <h2>${escapeHtml(item.file_name || 'Review item')}</h2>
                <p>${escapeHtml(item.source_name || 'Unknown source')} • ${escapeHtml(item.source_type || 'source')}</p>
              </div>
            </div>
            <div class="review-preview-frame">
              <img class="review-preview-image" src="${reviewImageUrl}" alt="${escapeHtml(item.file_name || 'Review image')}">
            </div>
          </article>

          <div class="review-side-column">
            <article class="section-card review-metadata-card">
              <div class="section-heading">
                <div>
                  <h2>Photo details</h2>
                  <p>Context to make quick review decisions with confidence.</p>
                </div>
              </div>
              <dl class="review-metadata-list">
                <div>
                  <dt>Source</dt>
                  <dd>${escapeHtml(item.source_name || 'Unknown source')}</dd>
                </div>
                <div>
                  <dt>Path</dt>
                  <dd>${escapeHtml(item.file_path || '')}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>${escapeHtml(item.review_status || 'pending')}</dd>
                </div>
                <div>
                  <dt>Favorite</dt>
                  <dd>${item.favorite === 1 ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt>Last review</dt>
                  <dd>${escapeHtml(reviewedLabel)}</dd>
                </div>
              </dl>
            </article>

            <article class="section-card review-actions-card">
              <div class="section-heading">
                <div>
                  <h2>Review actions</h2>
                  <p>Favorites stay approved and get a 2x playback boost.</p>
                </div>
              </div>
              <div class="review-action-grid">
                <button class="btn-primary" data-review-action="approve">Approve</button>
                <button class="btn-secondary" data-review-action="favorite">Favorite</button>
                <button class="btn-secondary" data-review-action="skip">Skip</button>
                <button class="btn-danger" data-review-action="hide">Hide</button>
              </div>
            </article>
          </div>
        </section>
      </div>
    `;

    bindEvents();
  }

  function handleSkip() {
    if (queueItems.length <= 1) {
      showToast('No other items are waiting in this queue.', 'info');
      return;
    }
    currentIndex = (currentIndex + 1) % queueItems.length;
    renderQueue();
  }

  async function handleReviewAction(action) {
    const item = getCurrentItem();
    if (!item) return;

    try {
      await api.applyReviewAction(item.id, action);
      queueItems.splice(currentIndex, 1);
      if (currentIndex >= queueItems.length) {
        currentIndex = Math.max(0, queueItems.length - 1);
      }
      showToast(action === 'favorite' ? 'Photo favorited' : `Photo ${action}d`, 'success');
      renderQueue();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function loadQueue(mode = currentMode) {
    currentMode = mode;
    currentIndex = 0;
    const requestId = ++latestRequestId;
    renderLoading();

    try {
      const response = await api.getReviewQueue(currentMode);
      if (destroyed || requestId !== latestRequestId) return;
      queueItems = Array.isArray(response.items) ? response.items : [];
      renderQueue();
    } catch (err) {
      if (destroyed || requestId !== latestRequestId) return;
      renderError(err.message);
    }
  }

  await loadQueue(currentMode);

  return {
    destroy() {
      destroyed = true;
    },
  };
}
