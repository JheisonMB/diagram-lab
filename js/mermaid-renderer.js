/**
 * mermaid-renderer.js
 * Renders Mermaid diagrams with a fixed light theme (suitable for Google
 * Docs) and auto-scales the resulting SVG (Mermaid ships it with a small
 * intrinsic size when the diagram is simple; we fit it to the available
 * width of the preview panel).
 */
window.DL = window.DL || {};

(function () {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    // Labels as plain SVG <text>, not <foreignObject>: Chrome/Edge taint
    // the canvas when an SVG containing foreignObject is drawn, which makes
    // canvas.toBlob() throw SecurityError and breaks Save PNG / Copy image.
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    class: { htmlLabels: false },
    state: { htmlLabels: false },
    er: { htmlLabels: false },
    // Keep architecture overrides inside the SVG, including PNG exports.
    themeCSS: `
      .architecture-groups .node-bkg { stroke: #9aa5c7; stroke-width: 1.25px; stroke-dasharray: 6 5; rx: 6px; }
      .architecture-edges .edge { stroke: #5a6b8c; stroke-width: 1.6px; }
      .architecture-edges .arrow { fill: #5a6b8c; }
    `,
    themeVariables: {
      background: '#ffffff',
      primaryColor: '#eef2fb',
      primaryBorderColor: '#2b4a8b',
      primaryTextColor: '#1a1a2e',
      lineColor: '#4a4a6a',
      secondaryColor: '#f5f5f5',
      tertiaryColor: '#ffffff',
      fontFamily: 'Segoe UI, Arial, sans-serif',
      fontSize: '16px',
      clusterBkg: '#fafbfd',
      clusterBorder: '#9aa5c7',
      edgeLabelBackground: '#ffffff'
    }
  });

  let counter = 0;

  /** Scales the Mermaid SVG so it makes good use of the panel space. */
  function fitSvgToPane(svgEl, previewPaneEl) {
    const viewBox = svgEl.getAttribute('viewBox');
    if (!viewBox) return;
    const parts = viewBox.split(/\s+/).map(Number);
    const vbWidth = parts[2];
    const vbHeight = parts[3];
    if (!vbWidth || !vbHeight) return;

    const availableWidth = Math.max(previewPaneEl.clientWidth - 110, 300);
    const availableHeight = Math.max(previewPaneEl.clientHeight - 110, 240);
    // Only enlarges very small diagrams (up to 1.15x their natural size);
    // also shrinks past that if needed so the full diagram (width AND
    // height) stays visible within the panel, instead of only fitting
    // the width and letting the bottom run off-screen.
    const scale = Math.min(availableWidth / vbWidth, availableHeight / vbHeight, 1.15);
    let target = vbWidth * scale;
    target = Math.max(target, Math.min(vbWidth, 360));

    svgEl.style.width = target + 'px';
    svgEl.style.height = 'auto';
    svgEl.style.maxWidth = 'none';
  }

  /**
   * Renders Mermaid code inside surfaceEl.
   * @param {string} code
   * @param {HTMLElement} surfaceEl
   * @param {HTMLElement} previewPaneEl
   */
  DL.renderMermaid = async function (code, surfaceEl, previewPaneEl) {
    surfaceEl.className = '';
    const id = 'mermaid-diagram-' + (counter++);
    try {
      const { svg } = await mermaid.render(id, code);
      surfaceEl.innerHTML = svg;
      const svgEl = surfaceEl.querySelector('svg');
      if (svgEl) fitSvgToPane(svgEl, previewPaneEl);
    } catch (err) {
      surfaceEl.innerHTML =
        '<div class="error-box">⚠️ Mermaid syntax error:\n\n' +
        (err.message || err) + '</div>';
    }
  };
})();
