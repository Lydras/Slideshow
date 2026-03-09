import { api } from '../api.js';
import { enterFullscreen, exitFullscreen, isFullscreen, toggleFullscreen } from '../utils/fullscreen.js';
import { $ } from '../utils/dom.js';

let images = [];
let currentIndex = 0;
let playing = false;
let timer = null;
let hideControlsTimer = null;
let settings = {};
let container = null;
let skippedCount = 0;

export async function renderSlideshowView() {
  const viewContainer = $('#view');
  settings = await api.getSettings();

  try {
    images = await api.getImages(settings.active_playlist_id || null);
  } catch (err) {
    console.warn('Failed to load slideshow images:', err.message);
    images = [];
  }

  if (images.length === 0) {
    viewContainer.innerHTML = `
      <div class="page-shell">
        <section class="page-hero">
          <div>
            <p class="page-kicker">Display</p>
            <div class="page-title-row">
              <h1>Slideshow is ready when your library is</h1>
              <span class="pill">No images yet</span>
            </div>
            <p class="page-subtitle">Add a source, run a scan, and activate a playlist if you want a specific collection to play by default.</p>
          </div>
          <div class="page-actions">
            <a class="btn-primary" href="#/sources">Add sources</a>
            <a class="btn-secondary" href="#/playlists">Review playlists</a>
          </div>
        </section>
      </div>
    `;
    return { destroy };
  }

  const transitionDuration = (parseInt(settings.transition_duration_ms, 10) || 500) / 1000;

  viewContainer.innerHTML = `
    <div class="slideshow-container" style="--slide-transition-duration: ${transitionDuration}s">
      <img class="slideshow-image active" id="slide-current" src="" alt="">
      <img class="slideshow-image" id="slide-next" src="" alt="">
      <div class="slideshow-topbar">
        <div class="slideshow-topcard">
          <div class="slideshow-kicker">Now playing</div>
          <div class="slideshow-counter" id="slide-counter"></div>
          <div class="slideshow-hint" id="slide-title"></div>
        </div>
        <div class="slideshow-topcard">
          <div class="slideshow-kicker">Controls</div>
          <div class="slideshow-hint">Space play/pause, arrows navigate, F fullscreen, Esc exit</div>
        </div>
      </div>
      <div class="slideshow-controls" id="slideshow-controls">
        <button id="btn-prev" title="Previous image">&#9664;</button>
        <button id="btn-play" title="Play or pause slideshow">&#9654;</button>
        <button id="btn-next" title="Next image">&#9654;</button>
        <button id="btn-fullscreen" title="Toggle fullscreen">&#9974;</button>
        <button id="btn-exit" title="Exit slideshow">&#10005;</button>
      </div>
      <div class="slideshow-progress" id="slide-progress"></div>
    </div>
  `;

  container = $('.slideshow-container');
  document.body.classList.add('slideshow-active');

  currentIndex = 0;
  skippedCount = 0;
  showImage(currentIndex);
  preloadImages();

  $('#btn-prev').addEventListener('click', prevImage);
  $('#btn-next').addEventListener('click', nextImage);
  $('#btn-play').addEventListener('click', togglePlay);
  $('#btn-fullscreen').addEventListener('click', () => toggleFullscreen(container));
  $('#btn-exit').addEventListener('click', exitSlideshow);

  document.addEventListener('keydown', handleKeydown);
  container.addEventListener('mousemove', showControls);
  container.addEventListener('click', showControls);
  scheduleHideControls();

  if (settings.fullscreen_on_start === 'true') {
    enterFullscreen(container).catch(() => {});
  }

  startPlaying();

  return { destroy };
}

function showImage(index) {
  if (images.length === 0) return;

  const current = $('#slide-current');
  const next = $('#slide-next');
  currentIndex = ((index % images.length) + images.length) % images.length;
  const image = images[currentIndex];

  const onReady = () => {
    updateCounter();
    if (playing) restartTimer();
  };

  const onError = () => {
    console.warn('Skipping image after load failure:', image.url);
    removeFailedImage(currentIndex);
  };

  if (settings.transition === 'none') {
    current.onload = onReady;
    current.onerror = onError;
    current.src = image.url;
    current.className = 'slideshow-image active';
    next.className = 'slideshow-image';
  } else if (settings.transition === 'slide') {
    next.onload = () => {
      next.className = 'slideshow-image slide-enter';
      requestAnimationFrame(() => {
        current.className = 'slideshow-image slide-exit';
        next.className = 'slideshow-image slide-active';
        setTimeout(() => {
          current.src = next.src;
          current.className = 'slideshow-image active';
          next.className = 'slideshow-image';
        }, (parseInt(settings.transition_duration_ms, 10) || 500) + 50);
      });
      onReady();
    };
    next.onerror = onError;
    next.src = image.url;
  } else {
    next.onload = () => {
      next.className = 'slideshow-image active';
      current.className = 'slideshow-image';
      setTimeout(() => {
        current.src = next.src;
        current.className = 'slideshow-image active';
        next.className = 'slideshow-image';
      }, (parseInt(settings.transition_duration_ms, 10) || 500) + 50);
      onReady();
    };
    next.onerror = onError;
    next.src = image.url;
  }

  preloadImages();
}

function removeFailedImage(index) {
  if (images.length === 0) {
    stopPlaying();
    updateCounter('No playable images remain.');
    return;
  }

  const failedItems = images.splice(index, 1);
  if (failedItems.length > 0) {
    skippedCount += 1;
  }

  if (images.length === 0) {
    stopPlaying();
    updateCounter('No playable images remain.');
    return;
  }

  if (currentIndex >= images.length) {
    currentIndex = 0;
  }

  updateCounter('Skipped ' + skippedCount + ' unavailable image' + (skippedCount === 1 ? '' : 's'));
  setTimeout(() => showImage(currentIndex), 300);
}
function preloadImages() {
  for (let i = 1; i <= Math.min(5, images.length - 1); i++) {
    const idx = (currentIndex + i) % images.length;
    const preload = new Image();
    preload.src = images[idx].url;
  }
}

function nextImage() {
  clearInterval(timer);
  timer = null;
  showImage(currentIndex + 1);
}

function prevImage() {
  clearInterval(timer);
  timer = null;
  showImage(currentIndex - 1);
}

function startPlaying() {
  playing = true;
  updatePlayButton();
  restartTimer();
}

function stopPlaying() {
  playing = false;
  updatePlayButton();
  clearInterval(timer);
  timer = null;
  resetProgress();
}

function togglePlay() {
  playing ? stopPlaying() : startPlaying();
}

function restartTimer() {
  clearInterval(timer);
  const interval = (parseInt(settings.interval_seconds, 10) || 8) * 1000;
  timer = setInterval(() => nextImage(), interval);
  resetProgress();
}

function resetProgress() {
  const progress = $('#slide-progress');
  if (!progress) return;

  const interval = (parseInt(settings.interval_seconds, 10) || 8) * 1000;
  progress.style.transition = 'none';
  progress.style.width = '0%';
  if (playing) {
    requestAnimationFrame(() => {
      progress.style.transition = `width ${interval}ms linear`;
      progress.style.width = '100%';
    });
  }
}

function updateCounter(customMessage = null) {
  const counter = $('#slide-counter');
  const title = $('#slide-title');
  if (counter) {
    counter.textContent = customMessage || `${currentIndex + 1} of ${images.length}`;
  }
  if (title && !customMessage) {
    title.textContent = images[currentIndex]?.file_name || 'Current image';
  }
}

function updatePlayButton() {
  const btn = $('#btn-play');
  if (btn) {
    btn.innerHTML = playing ? '&#10074;&#10074;' : '&#9654;';
  }
}

function showControls() {
  const controls = $('#slideshow-controls');
  if (controls) controls.classList.remove('hidden-controls');
  scheduleHideControls();
}

function scheduleHideControls() {
  clearTimeout(hideControlsTimer);
  hideControlsTimer = setTimeout(() => {
    const controls = $('#slideshow-controls');
    if (controls && playing) controls.classList.add('hidden-controls');
  }, 2400);
}

function handleKeydown(event) {
  if (!container) return;

  switch (event.key) {
    case ' ':
      event.preventDefault();
      togglePlay();
      break;
    case 'ArrowRight':
      nextImage();
      break;
    case 'ArrowLeft':
      prevImage();
      break;
    case 'f':
    case 'F':
      toggleFullscreen(container);
      break;
    case 'Escape':
      exitSlideshow();
      break;
  }

  showControls();
}

function exitSlideshow() {
  if (isFullscreen()) exitFullscreen();
  window.location.hash = '#/sources';
}

function destroy() {
  clearInterval(timer);
  clearTimeout(hideControlsTimer);
  document.removeEventListener('keydown', handleKeydown);
  document.body.classList.remove('slideshow-active');
  container = null;
  playing = false;
  timer = null;
}
