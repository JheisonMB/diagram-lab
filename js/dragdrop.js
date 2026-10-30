/**
 * dragdrop.js
 * Lets the user drop an .mmd/.json/.txt file onto the editor panel
 * to load its content directly.
 */
window.DL = window.DL || {};

DL.initDragDrop = function ({ editorPaneEl, onFileText }) {
  ['dragenter', 'dragover'].forEach((evt) => {
    editorPaneEl.addEventListener(evt, (e) => {
      e.preventDefault();
      editorPaneEl.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    editorPaneEl.addEventListener(evt, (e) => {
      e.preventDefault();
      editorPaneEl.classList.remove('dragover');
    });
  });

  editorPaneEl.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onFileText(reader.result);
    reader.readAsText(file);
  });
};
