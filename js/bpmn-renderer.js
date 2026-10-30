/**
 * bpmn-renderer.js
 * Renders BPMN processes from a declarative JSON (kind: "bpmn"). Reuses
 * lane-grid.js (lane/pool layout) and diagram-connectors.js (orthogonal
 * connectors). The shapes are real BPMN shapes, not a flowchart.
 *
 * JSON capabilities:
 *  - lanes[].items[].type: "start" | "end" | "task" | "gateway".
 *  - items[].row (optional): fixed row shared across all lanes
 *    (aligned layout, the default). Set "layout": "compact" to pack
 *    each lane from the top instead, ignoring item.row.
 *  - items[].standalone: true breaks automatic chaining with the previous item.
 *  - gateway.branches: [{ label, to }] labeled branches (e.g. "Yes"/"No").
 *    A gateway with branches does NOT auto-chain to the next item.
 *  - connections: [{ from, to, style, label }] flows between items by key;
 *    style "dashed" = message flow (between pools).
 */
window.DL = window.DL || {};

(function () {
  function shapeHtml(item, key, laneIdx, posStyle) {
    const type = item.type || 'task';
    const attrs = `data-key="${DL.escapeHtml(key)}" data-lane="${laneIdx}" style="${posStyle || ''}"`;
    const title = DL.escapeHtml(item.title || '');

    if (type === 'start' || type === 'end') {
      return `<div class="bpmn-shape bpmn-event bpmn-${type}" ${attrs}>
                <span class="bpmn-circle"></span><span class="bpmn-caption">${title}</span>
              </div>`;
    }
    if (type === 'gateway') {
      return `<div class="bpmn-shape bpmn-gateway" ${attrs}>
                <span class="bpmn-diamond"></span><span class="bpmn-caption">${title}</span>
              </div>`;
    }
    const iconHtml = item.icon ? `<i data-lucide="${DL.escapeHtml(item.icon)}"></i>` : '';
    return `<div class="box bpmn-shape bpmn-task" ${attrs} data-connector="">
              <div class="box-title">${iconHtml}${item.id ? `<span class="box-id">${DL.escapeHtml(item.id)}</span>` : ''}${title}</div>
              <div class="box-desc">${DL.escapeHtml(item.desc || '')}</div>
            </div>`;
  }

  function branchConnections(cfg) {
    const extra = [];
    (cfg.lanes || []).forEach((lane, li) => {
      (lane.items || []).forEach((item, ii) => {
        const key = DL.itemKey(item, li, ii);
        (item.branches || []).forEach((b) => {
          extra.push({ from: key, to: b.to, style: 'solid', label: b.label || '' });
        });
      });
    });
    return extra;
  }

  /**
   * @param {string} code JSON crudo
   * @param {HTMLElement} surfaceEl
   */
  DL.renderBpmn = function (code, surfaceEl) {
    surfaceEl.className = 'swimlane-surface bpmn-surface';
    let cfg;
    try {
      cfg = JSON.parse(code);
    } catch (err) {
      surfaceEl.innerHTML = `<div class="error-box">⚠️ Invalid JSON: ${DL.escapeHtml(err.message)}</div>`;
      return;
    }

    const grid = DL.buildLaneGrid(cfg, {
      compact: cfg.layout === 'compact',
      renderItem: (item, key, li, pos) => shapeHtml(item, key, li, pos),
      renderChild: (child, key, li) => shapeHtml(child, key, li, '')
    });

    const legendHtml = `<div class="legend-row"><div class="legend-group">
        <div class="legend-chip"><span class="legend-circle"></span><span>Start</span></div>
        <div class="legend-chip"><span class="legend-circle" style="border-width:4px;border-color:#8b2c2c"></span><span>End</span></div>
        <div class="legend-chip"><span class="legend-diamond"></span><span>Gateway</span></div>
        <div class="legend-chip"><span class="legend-swatch" style="border-left-color:#2b4a8b"></span><span>Task</span></div>
        <div class="legend-chip"><span class="legend-line"></span><span>Sequence flow</span></div>
        <div class="legend-chip"><span class="legend-line dashed"></span><span>Message flow</span></div>
      </div></div>`;

    surfaceEl.innerHTML = `<div class="diagram-title">${DL.escapeHtml(cfg.title || '')}</div>${grid}${legendHtml}`;

    if (window.lucide) lucide.createIcons();
    const extra = branchConnections(cfg);
    surfaceEl.redrawConnectors = () => {
      DL.drawDiagramConnectors(surfaceEl, DL.resolveLaneEdges(surfaceEl, cfg, extra));
    };
    requestAnimationFrame(() => surfaceEl.redrawConnectors());
  };
})();
