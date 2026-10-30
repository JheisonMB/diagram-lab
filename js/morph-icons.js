/**
 * morph-icons.js (classic script — do NOT use type="module")
 *
 * IMPORTANT: Chrome blocks <script type="module"> via CORS when the page
 * is opened with file:// (this tool's main use case, "zero-install",
 * no server). That's why no ESM import from any CDN is used (morphicons
 * via esm.sh was tried and fails silently when opening index.html with a
 * double click). This version is a plain script, with no external
 * dependencies, 100% compatible with file://.
 *
 * Progressive, purely cosmetic enhancement: after a successful action
 * (copy prompt, save/copy image) the button's icon is swapped for a
 * check mark ✓ and restored when the flash ends. The swap replaces the
 * <svg> node itself; no overlay or wrapper is added. If anything fails,
 * it doesn't affect the actual action.
 */
(function () {
  window.DL = window.DL || {};
  DL.copyMorphs = DL.copyMorphs || {};

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var TARGETS = ['btn-copy', 'btn-copy-prompt', 'btn-save-png', 'btn-copy-png'];

  function buildCheckSvg(original) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    ['class', 'width', 'height'].forEach(function (name) {
      if (original.hasAttribute(name)) svg.setAttribute(name, original.getAttribute(name));
    });
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var poly = document.createElementNS(SVG_NS, 'polyline');
    poly.setAttribute('points', '20 6 9 17 4 12');
    svg.appendChild(poly);
    return svg;
  }

  function setup(btnId) {
    var btn = document.getElementById(btnId);
    var original = btn && btn.querySelector('svg');
    if (!original) return;

    var check = buildCheckSvg(original);
    var showingCheck = false;

    DL.copyMorphs[btnId] = {
      toCheck: function () {
        if (showingCheck || !original.parentNode) return;
        original.parentNode.replaceChild(check, original);
        showingCheck = true;
      },
      toOriginal: function () {
        if (!showingCheck || !check.parentNode) return;
        check.parentNode.replaceChild(original, check);
        showingCheck = false;
      }
    };
  }

  TARGETS.forEach(setup);
})();
