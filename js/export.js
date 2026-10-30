/**
 * export.js
 * Exports the current diagram to <canvas>/PNG.
 *
 * Mermaid SVGs are rasterized natively: serialize the SVG, load it into an
 * <img>, and draw it onto a <canvas>. html2canvas is not used for them
 * because it does not support <foreignObject>. The native path only works
 * if the SVG has no <foreignObject>: Chromium taints the canvas when such
 * an SVG is drawn, and toBlob() then throws SecurityError. The Mermaid
 * renderer therefore sets htmlLabels: false. The swimlane JSON (plain
 * HTML/CSS, no SVG) uses html2canvas.
 */
window.DL = window.DL || {};

(function () {
  function svgToCanvas(svgEl, surfaceEl, scale) {
    return new Promise((resolve, reject) => {
      const rect = svgEl.getBoundingClientRect();
      const width = Math.max(1, Math.ceil(rect.width));
      const height = Math.max(1, Math.ceil(rect.height));

      const style = getComputedStyle(surfaceEl);
      const padL = parseFloat(style.paddingLeft) || 0;
      const padR = parseFloat(style.paddingRight) || 0;
      const padT = parseFloat(style.paddingTop) || 0;
      const padB = parseFloat(style.paddingBottom) || 0;

      const clone = svgEl.cloneNode(true);
      clone.setAttribute('width', width);
      clone.setAttribute('height', height);
      if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      const svgStr = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const totalW = width + padL + padR;
        const totalH = height + padT + padB;
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(totalW * scale);
        canvas.height = Math.ceil(totalH * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, padL, padT, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
      img.src = url;
    });
  }

  /**
   * Returns a <canvas> with the current diagram, white background, ready
   * for `canvas.toBlob(...)`.
   * @param {HTMLElement} surfaceEl #preview-surface
   * @param {'mermaid'|'swimlane'|string} mode current detected mode
   * @param {number} scale resolution factor (2 = @2x, crisp in Docs)
   */
  DL.exportCanvas = function (surfaceEl, mode, scale) {
    scale = scale || 2;
    const svgEl = surfaceEl.querySelector(':scope > svg');
    if (mode === 'mermaid' && svgEl) {
      return svgToCanvas(svgEl, surfaceEl, scale);
    }
    return html2canvas(surfaceEl, { backgroundColor: '#ffffff', scale });
  };

  /**
   * Encodes a canvas as PNG. canvas.toBlob() passes null (instead of
   * throwing) when encoding fails, so that case is turned into a rejection.
   */
  DL.canvasToPngBlob = function (canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas could not be encoded as PNG'));
      }, 'image/png');
    });
  };
})();
