/**
 * lane-grid.js
 * Layout shared by the lane-based diagrams (swimlane and BPMN).
 *
 *  - All lanes live in a SINGLE CSS grid: every row is shared across all
 *    lanes, so steps "at the same level" stay aligned even when they are
 *    in different lanes.
 *  - Each item occupies a row: `item.row` (0-based) if given, otherwise
 *    the next free row within its lane. An item with "children" uses the
 *    next row for its children (in parallel) and leaves the one after
 *    that free.
 *  - Connections are resolved here (chaining, fan-out/fan-in, lateral and
 *    explicit) and drawn with diagram-connectors.js.
 */
window.DL = window.DL || {};

(function () {
  DL.escapeHtml = function (str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  };

  DL.itemKey = (item, laneIdx, itemIdx) => item.key || `auto_${laneIdx}_${itemIdx}`;
  DL.childKey = (parentKey, child, ci) => child.key || `${parentKey}__c${ci}`;

  const hasChildren = (item) => !!(item.children && item.children.length);

  /** Assigns a row to each item. Content grid rows: 0..rowCount-1. */
  DL.layoutRows = function (lanes) {
    let maxRow = 0;
    const positions = lanes.map((lane) => {
      let cursor = 0;
      return (lane.items || []).map((item) => {
        const row = Number.isInteger(item.row) ? item.row : cursor;
        const kids = hasChildren(item);
        cursor = row + (kids ? 2 : 1);
        maxRow = Math.max(maxRow, kids ? row + 1 : row);
        return row;
      });
    });
    return { positions, rowCount: maxRow + 1 };
  };

  /**
   * Builds the `.grid-wrap > .lanes` block with titles, lane backgrounds,
   * and items positioned on the shared grid.
   * opts.renderItem(item, key, laneIdx, posStyle) -> html
   * opts.renderChild(child, key, laneIdx) -> html
   */
  DL.buildLaneGrid = function (cfg, opts) {
    const lanes = cfg.lanes || [];
    const { positions, rowCount } = DL.layoutRows(lanes);
    const columns = lanes
      .map((lane) => ((lane.items || []).some(hasChildren) ? 'minmax(300px, 1.4fr)' : 'minmax(205px, 1fr)'))
      .join(' ');

    let cells = '';
    lanes.forEach((lane, li) => {
      const col = li + 1;
      cells += `<div class="lane-title" style="grid-column:${col};grid-row:1">${DL.escapeHtml(lane.title)}</div>`;
      cells += `<div class="lane" data-lane="${li}" style="grid-column:${col};grid-row:2 / ${rowCount + 2}"></div>`;
      (lane.items || []).forEach((item, ii) => {
        const key = DL.itemKey(item, li, ii);
        const row = positions[li][ii] + 2;
        cells += opts.renderItem(item, key, li, `grid-column:${col};grid-row:${row};`);
        if (hasChildren(item)) {
          cells += `<div class="box-row" style="grid-column:${col};grid-row:${row + 1};">`;
          item.children.forEach((child, ci) => {
            cells += opts.renderChild(child, DL.childKey(key, child, ci), li);
          });
          cells += `</div>`;
        }
      });
    });

    return `<div class="grid-wrap"><div class="lanes" style="grid-template-columns:${columns}">${cells}</div></div>`;
  };

  const direct = (fromEl, toEl) => ({ kind: 'direct', fromEl, toEl, style: 'solid', bidirectional: false });
  const rail = (fromEl, toEl) => ({ kind: 'rail', fromEl, toEl, style: 'solid', bidirectional: false });

  /**
   * Resolves the list of connections to draw.
   * extraConnections: additional, already-normalized connections ({from,to,style,label,bidirectional}).
   */
  DL.resolveLaneEdges = function (surfaceEl, cfg, extraConnections) {
    const lanes = cfg.lanes || [];
    const edges = [];
    const byKey = (k) => surfaceEl.querySelector(`[data-key="${CSS.escape(k)}"]`);

    lanes.forEach((lane, li) => {
      const items = lane.items || [];
      items.forEach((item, ii) => {
        const el = byKey(DL.itemKey(item, li, ii));
        if (!el) return;
        const next = items[ii + 1];
        if (hasChildren(item)) {
          // Fan-out parent -> children; fan-in children -> next item in the lane.
          const nextEl = next ? byKey(DL.itemKey(next, li, ii + 1)) : null;
          item.children.forEach((child, ci) => {
            const cEl = byKey(DL.childKey(DL.itemKey(item, li, ii), child, ci));
            if (!cEl) return;
            edges.push(rail(el, cEl));
            if (nextEl) edges.push(rail(cEl, nextEl));
          });
        } else if (next && !next.standalone && !item.branches) {
          const nextEl = byKey(DL.itemKey(next, li, ii + 1));
          if (nextEl) edges.push(direct(el, nextEl));
        }
      });
    });

    // Compat: implicit out/in/both connector between adjacent lanes.
    for (let i = 0; i < lanes.length - 1; i++) {
      const outBox = surfaceEl.querySelector(
        `[data-lane="${i}"][data-connector="out"], [data-lane="${i}"][data-connector="both"]`);
      const inBox = surfaceEl.querySelector(
        `[data-lane="${i + 1}"][data-connector="in"], [data-lane="${i + 1}"][data-connector="both"]`);
      if (outBox && inBox) {
        edges.push({ kind: 'lateral', fromEl: outBox, toEl: inBox, style: 'solid', bidirectional: false });
      }
    }

    // Explicit: same lane -> direct; different lanes -> bus (through the gaps).
    (cfg.connections || []).concat(extraConnections || []).forEach((conn) => {
      const fromEl = byKey(conn.from);
      const toEl = byKey(conn.to);
      if (!fromEl || !toEl) return;
      const sameLane = fromEl.dataset.lane === toEl.dataset.lane;
      edges.push({
        kind: sameLane ? 'direct' : 'bus',
        fromEl,
        toEl,
        style: conn.style === 'dashed' ? 'dashed' : 'solid',
        bidirectional: !!conn.bidirectional,
        label: conn.label || ''
      });
    });

    return edges;
  };
})();
