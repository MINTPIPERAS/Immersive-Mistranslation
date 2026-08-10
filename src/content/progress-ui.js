/**
 * 页面内翻译进度浮层
 */
import { CONTAINER_ID } from '../shared/constants.js';

export function createProgressContainer() {
  let el = document.getElementById(CONTAINER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = CONTAINER_ID;
    el.className = 'immersive-mt-progress';
    el.innerHTML = `
      <div class="immersive-mt-bar"></div>
      <span class="immersive-mt-text">准备就绪</span>
    `;
    document.body.appendChild(el);
  }
  return el;
}

export function showProgress(message, progress = null) {
  const el = createProgressContainer();
  const textEl = el.querySelector('.immersive-mt-text');
  const barEl = el.querySelector('.immersive-mt-bar');
  textEl.textContent = message;
  if (progress !== null && progress >= 0) {
    barEl.style.width = `${progress}%`;
  }
  el.style.display = 'block';
}

export function hideProgress() {
  const el = document.getElementById(CONTAINER_ID);
  if (el) {
    el.style.display = 'none';
  }
}
