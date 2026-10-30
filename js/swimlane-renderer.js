/**
 * swimlane-renderer.js
 * Renders "technical swimlane" diagrams from a declarative JSON
 * (kind: "swimlane"). The layout and connections live in lane-grid.js;
 * the connectors are drawn by diagram-connectors.js.
 *
 * JSON capabilities:
 *  - lanes[].items: steps in the lane. They auto-chain in order, unless
 *    the next one has "standalone": true.
 *  - item.row (optional): fixed row within the shared grid, to align
 *    steps across lanes. If omitted, it goes to the next free row.
 *  - item.children: parallel branches (next row), with fan-out/fan-in.
 *  - connections: [{ from, to, style, bidirectional, label }] between
 *    items by key; cross lanes through the gaps between columns.
 *  - legend with "fullFill": true fills the whole box (events).
 */
window.DL = window.DL || {};

(function () {
  function buildBoxHtml(item, key, style, laneIdx, posStyle) {
    const iconHtml = item.icon ? `<i data-lucide="${DL.escapeHtml(item.icon)}"></i>` : '';
    const highlight = style.fullFill ? ' box-highlight' : '';
    const styleAttr = style.fullFill
      ? `background:${style.fill};border-color:${style.border};`
      : `background:${style.fill};border-left-color:${style.border};`;
    return `<div class="box${highlight}" data-key="${DL.escapeHtml(key)}" data-lane="${laneIdx}" data-connector="${item.connector || ''}" style="${styleAttr}${posStyle || ''}">
               <div class="box-title">${iconHtml}${item.id ? `<span class="box-id">${DL.escapeHtml(item.id)}</span>` : ''}${DL.escapeHtml(item.title)}</div>
               <div class="box-desc">${DL.escapeHtml(item.desc || '')}</div>
             </div>`;
  }

  /**
   * @param {string} code JSON crudo
   * @param {HTMLElement} surfaceEl
   */
  DL.renderSwimlane = function (code, surfaceEl) {
    surfaceEl.className = 'swimlane-surface';
    let cfg;
    try {
      cfg = JSON.parse(code);
    } catch (err) {
      surfaceEl.innerHTML = `<div class="error-box">⚠️ Invalid JSON: ${DL.escapeHtml(err.message)}</div>`;
      return;
    }

    const legend = cfg.legend || [];
    const legendByKey = {};
    legend.forEach((l) => { legendByKey[l.key] = l; });
    const styleOf = (k) => legendByKey[k] || { fill: '#ffffff', border: '#999' };

    const grid = DL.buildLaneGrid(cfg, {
      renderItem: (item, key, li, pos) => buildBoxHtml(item, key, styleOf(item.style), li, pos),
      renderChild: (child, key, li) => buildBoxHtml(child, key, styleOf(child.style), li, '')
    });

    let legendHtml = `<div class="legend-row"><div class="legend-group">`;
    legend.forEach((l) => {
      const swatchStyle = l.fullFill
        ? `background:${l.fill};border-color:${l.border};`
        : `border-left-color:${l.border};`;
      legendHtml += `<div class="legend-chip"><span class="legend-swatch" style="${swatchStyle}"></span><span>${DL.escapeHtml(l.label)}</span></div>`;
    });
    legendHtml += `</div></div>`;

    surfaceEl.innerHTML = `<div class="diagram-title">${DL.escapeHtml(cfg.title || '')}</div>${grid}${legendHtml}`;

    if (window.lucide) lucide.createIcons();
    surfaceEl.redrawConnectors = () => {
      DL.drawDiagramConnectors(surfaceEl, DL.resolveLaneEdges(surfaceEl, cfg));
    };
    requestAnimationFrame(() => surfaceEl.redrawConnectors());
  };
})();
