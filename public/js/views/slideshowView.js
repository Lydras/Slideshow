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
      <div class="view-container">
        <div class="empty-state">
          <h2>No Images Found</h2>
          <p>Add sources and scan them to populate the slideshow.</p>
          <a href="#/sources" class="btn-primary" style="display:inline-block;margin-top:1rem;padding:0.5rem 1.5rem;">Go to Sources</a>
        </div>
      </div>
    `;
    return { destroy };
  }

  const transitionDuration = (parseInt(settings.transition_duration_ms) || 500) / 1000;

  viewContainer.innerHTML = `
    <div class="slideshow-container" style="--slide-transition-duration: ${transitionDuration}s">
      <img class="slideshow-image active" id="slide-current" src="" alt="">
      <img class="slideshow-image" id="slide-next" src="" alt="">
      <div class="slideshow-controls" id="slideshow-controls">
        <button id="btn-prev" title="Previous (Left Arrow)">&#9664;</button>
        <button id="btn-play" title="Play/Pause (Space)">&#9654;</button>
        <button id="btn-next" title="Next (Right Arrow)">&#9654;</button>
        <span class="slideshow-counter" id="slide-counter"></span>
        <button id="btn-fullscreen" title="Fullscreen (F)">&#9974;</button>
        <button id="btn-exit" title="Exit (Esc)">&#10005;</button>
      </div>
      <div class="slideshow-progress" id="slide-progress"></div>
    </div>
  `;

  container = $('.slideshow-container');
  document.body.classList.add('slideshow-active');

  currentIndex = 0;
  showImage(currentIndex);
  preloadImages();

  // Bind controls
  $('#btn-prev').addEventListener('click', prevImage);
  $('#btn-next').addEventListener('click', nextImage);
  $('#btn-play').addEventListener('click', togglePlay);
  $('#btn-fullscreen').addEventListener('click', () => toggleFullscreen(container));
  $('#btn-exit').addEventListener('click', exitSlideshow);

  // Keyboard
  document.addEventListener('keydown', handleKeydown);

  // Auto-hide controls
  container.addEventListener('mousemove', showControls);
  container.addEventListener('click', showControls);
  scheduleHideControls();

  // Auto-start
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
  const img = images[currentIndex];

  // Wait for the image to actually load before transitioning and starting the timer.
  // This prevents the timer from running while a remote image is still downloading.
  const onReady = () => {
    updateCounter();
    if (playing) restartTimer();
  };

  if (settings.transition === 'none') {
    current.onload = onReady;
    current.src = img.url;
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
        }, (parseInt(settings.transition_duration_ms) || 500) + 50);
      });
      onReady();
    };
    next.src = img.url;
  } else {
    // Fade (default)
    next.onload = () => {
      next.className = 'slideshow-image active';
      current.className = 'slideshow-image';
      setTimeout(() => {
        current.src = next.src;
        current.className = 'slideshow-image active';
        next.className = 'slideshow-image';
      }, (parseInt(settings.transition_duration_ms) || 500) + 50);
      onReady();
    };
    next.src = img.url;
  }

  preloadImages();
}

function preloadImages() {
  // Preload next 5 images (warms both browser and server disk cache)
  for (let i = 1; i <= 5; i++) {
    const idx = (currentIndex + i) % images.length;
    if (images[idx]) {
      const img = new Image();
      img.src = images[idx].url;
    }
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
}

function togglePlay() {
  playing ? stopPlaying() : startPlaying();
}

function restartTimer() {
  clearInterval(timer);
  const interval = (parseInt(settings.interval_seconds) || 8) * 1000;
  timer = setInterval(() => nextImage(), interval);
  resetProgress();
}

function resetProgress() {
  const progress = $('#slide-progress');
  if (!progress) return;
  const interval = (parseInt(settings.interval_seconds) || 8) * 1000;
  progress.style.transition = 'none';
  progress.style.width = '0%';
  if (playing) {
    requestAnimationFrame(() => {
      progress.style.transition = `width ${interval}ms linear`;
      progress.style.width = '100%';
    });
  }
}

function updateCounter() {
  const counter = $('#slide-counter');
  if (counter) {
    counter.textContent = `${currentIndex + 1} / ${images.length}`;
  }
}

function updatePlayButton() {
  const btn = $('#btn-play');
  if (btn) {
    btn.innerHTML = playing ? '&#9646;&#9646;' : '&#9654;';
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
  }, 3000);
}

function handleKeydown(e) {
  if (!container) return;
  switch (e.key) {
    case ' ':
      e.preventDefault();
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
