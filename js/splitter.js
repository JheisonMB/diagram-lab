/**
 * splitter.js
 * Draggable divider between the editor panel and the preview panel.
 */
window.DL = window.DL || {};

DL.initSplitter = function ({ editorPaneEl, splitterEl, onResize }) {
  let dragging = false;

  splitterEl.addEventListener('mousedown', (e) => {
    dragging = true;
    splitterEl.classList.add('dragging');
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const mainRect = document.querySelector('main').getBoundingClientRect();
    let newWidth = e.clientX - mainRect.left;
    const min = 220;
    const max = mainRect.width * 0.75;
    newWidth = Math.max(min, Math.min(max, newWidth));
    editorPaneEl.style.width = newWidth + 'px';
    if (onResize) onResize();
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    splitterEl.classList.remove('dragging');
    document.body.style.userSelect = '';
  });
};
