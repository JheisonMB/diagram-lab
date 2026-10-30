/**
 * app.js
 * Orchestrator: detects the mode (Mermaid vs JSON swimlane/bpmn),
 * coordinates rendering, PNG export, and UI wiring.
 */
(function () {
  const codeEl = document.getElementById('code');
  const surfaceEl = document.getElementById('preview-surface');
  const previewPaneEl = document.querySelector('.preview-pane');
  const modeBadgeEl = document.getElementById('mode-badge');
  const editorPaneEl = document.getElementById('editor-pane');
  const splitterEl = document.getElementById('splitter');
  const lineNumbersEl = document.getElementById('line-numbers');

  codeEl.value = DL_EXAMPLES.swimlane;
  let currentPromptKey = 'swimlane';
  let currentMode = 'swimlane';
  let zoom = 1;
  let autoFit = true;

  // Static header/footer icons (the swimlane preview's own icons are
  // generated separately, inside DL.renderSwimlane, on every redraw).
  if (window.lucide) lucide.createIcons();

  // "Bare" mode: ?example=NAME&bare=1 loads an example and hides the UI
  // (header/editor/splitter), leaving only the preview — used for clean
  // automated (headless) screenshots, without touching the normal manual
  // flow.
  const params = new URLSearchParams(location.search);
  const exampleParam = params.get('example');
  if (exampleParam && DL_EXAMPLES[exampleParam]) {
    codeEl.value = DL_EXAMPLES[exampleParam];
    currentPromptKey = exampleParam;
  }
  if (params.get('bare') === '1') {
    document.body.classList.add('bare-mode');
  }

  /** @returns {'empty'|'json-error'|'swimlane'|'bpmn'|'mermaid'} */
  function detectMode(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return 'empty';
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parsed && parsed.kind === 'bpmn' ? 'bpmn' : 'swimlane';
      } catch (e) {
        return 'json-error';
      }
    }
    return 'mermaid';
  }

  /** Redraws the line-number gutter based on the current content. */
  function updateLineNumbers() {
    const lines = codeEl.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= lines; i++) html += '<div>' + i + '</div>';
    lineNumbersEl.innerHTML = html;
  }

  function render() {
    const raw = codeEl.value;
    const mode = detectMode(raw);
    currentMode = mode;

    if (mode === 'empty') {
      surfaceEl.innerHTML = '';
      modeBadgeEl.textContent = 'empty';
      return;
    }
    if (mode === 'json-error') {
      surfaceEl.innerHTML = '<div class="error-box">⚠️ Looks like JSON, but it is not valid yet…</div>';
      modeBadgeEl.textContent = 'JSON (error)';
      return;
    }
    if (mode === 'swimlane') {
      modeBadgeEl.textContent = 'JSON → swimlane';
      DL.renderSwimlane(raw, surfaceEl);
      fitToScreen();
      return;
    }
    if (mode === 'bpmn') {
      modeBadgeEl.textContent = 'JSON → BPMN';
      DL.renderBpmn(raw, surfaceEl);
      fitToScreen();
      return;
    }
    modeBadgeEl.textContent = 'Mermaid';
    DL.renderMermaid(raw, surfaceEl, previewPaneEl).then(fitToScreen);
  }

  let debounceTimer = null;
  codeEl.addEventListener('input', () => {
    updateLineNumbers();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(render, 350);
  });
  codeEl.addEventListener('scroll', () => {
    lineNumbersEl.scrollTop = codeEl.scrollTop;
  });

  window.addEventListener('resize', () => {
    if (surfaceEl.redrawConnectors) surfaceEl.redrawConnectors();
  });

  document.getElementById('examples').addEventListener('change', (e) => {
    if (e.target.value && DL_EXAMPLES[e.target.value]) {
      codeEl.value = DL_EXAMPLES[e.target.value];
      currentPromptKey = e.target.value;
      updateLineNumbers();
      render();
    }
    e.target.value = '';
  });

  /**
   * Brief visual feedback on a button after an action (copy/save),
   * never touching the button's child nodes (the Lucide SVG icon lives
   * there): it only toggles a class and, if present, the text of a
   * dedicated <span class="btn-label">.
   */
  function flashButton(btn, message, isError) {
    const label = btn.querySelector('.btn-label');
    const originalLabel = label ? label.textContent : null;
    const originalTitle = btn.getAttribute('title');
    // If the button has a registered icon morph (see morph-icons.js)
    // and the action succeeded, the icon morphs into a checkmark instead
    // of just changing the background color.
    const morph = !isError && window.DL && DL.copyMorphs && DL.copyMorphs[btn.id];
    if (morph) morph.toCheck();
    btn.classList.add(isError ? 'flash-error' : 'flash-ok');
    btn.disabled = true;
    // A successful morph already signals the result with the icon, so the
    // label stays as is; the text is only used for errors or without a morph.
    const showMessage = isError || !morph;
    if (showMessage) {
      if (label) label.textContent = message;
      else btn.setAttribute('title', message);
    }
    setTimeout(() => {
      btn.classList.remove('flash-ok', 'flash-error');
      btn.disabled = false;
      if (showMessage) {
        if (label) label.textContent = originalLabel;
        else if (originalTitle !== null) btn.setAttribute('title', originalTitle);
      }
      if (morph) morph.toOriginal();
    }, 1200);
  }

  document.getElementById('btn-copy').addEventListener('click', (e) => {
    navigator.clipboard.writeText(codeEl.value);
    flashButton(e.currentTarget, '✔ Copied');
  });

  document.getElementById('btn-copy-prompt').addEventListener('click', (e) => {
    const prompt = (window.DL_PROMPTS && DL_PROMPTS[currentPromptKey]) || null;
    if (!prompt) {
      flashButton(e.currentTarget, 'No prompt for this', true);
      return;
    }
    navigator.clipboard.writeText(prompt);
    flashButton(e.currentTarget, 'Prompt copied');
  });

  /**
   * Runs fn() with the preview zoom reset to 1 (the exported PNG must
   * always be the diagram at its real size, regardless of how much the
   * user has zoomed on screen), restoring the zoom afterwards.
   */
  function withZoomReset(fn) {
    const prev = {
      transform: surfaceEl.style.transform,
      width: zoomFrameEl.style.width,
      height: zoomFrameEl.style.height
    };
    surfaceEl.style.transform = '';
    zoomFrameEl.style.width = '';
    zoomFrameEl.style.height = '';
    return Promise.resolve()
      .then(fn)
      .finally(() => {
        surfaceEl.style.transform = prev.transform;
        zoomFrameEl.style.width = prev.width;
        zoomFrameEl.style.height = prev.height;
      });
  }

  /** Renders the diagram at real size (zoom reset) and resolves to a PNG Blob. */
  function exportPngBlob() {
    return withZoomReset(() => DL.exportCanvas(surfaceEl, currentMode, 2))
      .then((canvas) => DL.canvasToPngBlob(canvas));
  }

  function failExport(btn, message, err) {
    console.error('[Diagram Lab] ' + message, err);
    flashButton(btn, message, true);
  }

  document.getElementById('btn-save-png').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    exportPngBlob().then((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'diagram.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      flashButton(btn, 'Saved');
    }).catch((err) => failExport(btn, 'Export failed', err));
  });

  document.getElementById('btn-copy-png').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    // ClipboardItem accepts a Promise<Blob>: the write starts inside this
    // click (keeping the user gesture), and the slow rasterization happens
    // while it is pending. Awaiting the render before writing lost the gesture.
    const item = new ClipboardItem({ 'image/png': exportPngBlob() });
    navigator.clipboard.write([item])
      .then(() => flashButton(btn, 'Image copied'))
      .catch((err) => failExport(btn, 'Copy failed', err));
  });

  // ---- Preview zoom (independent of Mermaid's own auto-fit) ----
  const zoomLevelEl = document.getElementById('zoom-level');
  const zoomFrameEl = document.getElementById('zoom-frame');
  function applyZoom() {
    const scaled = zoom !== 1;
    surfaceEl.style.transform = scaled ? 'scale(' + zoom + ')' : '';
    zoomFrameEl.style.width = scaled ? surfaceEl.offsetWidth * zoom + 'px' : '';
    zoomFrameEl.style.height = scaled ? surfaceEl.offsetHeight * zoom + 'px' : '';
    zoomLevelEl.textContent = Math.round(zoom * 100) + '%';
  }
  document.getElementById('zoom-in').addEventListener('click', () => {
    autoFit = false;
    zoom = Math.min(zoom + 0.1, 3);
    applyZoom();
  });
  document.getElementById('zoom-out').addEventListener('click', () => {
    autoFit = false;
    zoom = Math.max(zoom - 0.1, 0.2);
    applyZoom();
  });
  /**
   * "Fit to screen": shrinks (or grows, up to 100%) so the whole diagram --
   * width AND height -- is visible in the pane. Runs after every render, so
   * diagrams open fitted. offsetWidth/offsetHeight are the untransformed size,
   * so the current zoom does not affect the calculation.
   */
  function fitToScreen() {
    autoFit = true;
    const naturalWidth = surfaceEl.offsetWidth;
    const naturalHeight = surfaceEl.offsetHeight;
    if (!naturalWidth || !naturalHeight) {
      zoom = 1;
      applyZoom();
      return;
    }
    const availableWidth = previewPaneEl.clientWidth - 48;
    const availableHeight = previewPaneEl.clientHeight - 48;
    const fit = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight, 1);
    zoom = Math.max(Math.min(fit, 3), 0.2);
    applyZoom();
  }
  document.getElementById('zoom-reset').addEventListener('click', fitToScreen);
  // Connector redraws change the diagram's size after render (rails, legend
  // spacing, late font metrics), so re-fit or re-apply zoom on every size change.
  new ResizeObserver(() => {
    if (autoFit) fitToScreen();
    else applyZoom();
  }).observe(surfaceEl);

  DL.initSplitter({
    editorPaneEl,
    splitterEl,
    onResize: () => {
      if (surfaceEl.redrawConnectors) surfaceEl.redrawConnectors();
    }
  });

  DL.initDragDrop({
    editorPaneEl,
    onFileText: (text) => {
      codeEl.value = text;
      updateLineNumbers();
      render();
    }
  });

  updateLineNumbers();
  render();
})();
