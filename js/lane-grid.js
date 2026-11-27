/**
 * lane-grid.js
 * Layout shared by the lane-based diagrams (swimlane and BPMN).
 *
 * Two modes (the caller picks via opts.compact):
 *  - Aligned: all lanes live in a SINGLE CSS grid — every row is shared
 *    across all lanes, so steps "at the same level" stay aligned even
 *    when they are in different lanes. Each item occupies `item.row`
 *    (0-based) if given, otherwise the next free row within its lane.
 *  - Compact: each lane packs its own items from the top, ignoring
 *    `item.row` (document order wins). No leading or internal gaps from
 *    global row numbering.
 * An item with "children" uses the next row for its children (in
 * parallel) and leaves the one after that free, in both modes.
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

  /**
   * Assigns a row to each item. Content grid rows: 0..rowCount-1.
   * When compact, `item.row` is ignored and every lane packs from row 0.
   */
  DL.layoutRows = function (lanes, compact) {
    let maxRow = 0;
    const positions = lanes.map((lane) => {
      let cursor = 0;
      return (lane.items || []).map((item) => {
        const row = (!compact && Number.isInteger(item.row)) ? item.row : cursor;
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
   * opts.compact (bool): pack each lane from the top, ignoring `item.row`.
   */
  DL.buildLaneGrid = function (cfg, opts) {
    const lanes = cfg.lanes || [];
    const { positions, rowCount } = DL.layoutRows(lanes, !!(opts && opts.compact));
    const columns = lanes
      .map((lane) => ((lane.items || []).some(hasChildren) ? 'minmax(320px, 1.45fr)' : 'minmax(205px, 1fr)'))
      .join(' ');

    // Explicit connections between a parent and one of its own children are
    // rendered inline inside the child container instead of as broken external
    // arrows.
    const childConnMeta = new Map();
    const conns = cfg.connections || [];
    lanes.forEach((lane, li) => {
      (lane.items || []).forEach((item, ii) => {
        if (!hasChildren(item)) return;
        const pKey = DL.itemKey(item, li, ii);
        const childKeys = new Set(item.children.map((c, ci) => DL.childKey(pKey, c, ci)));
        const labels = [];
        conns.forEach((c) => {
          const isPair = (c.from === pKey && childKeys.has(c.to)) || (c.to === pKey && childKeys.has(c.from));
          if (isPair && c.label) {
            const prefix = c.bidirectional ? '↕ ' : '↓ ';
            const text = prefix + c.label;
            if (!labels.includes(text)) labels.push(text);
          }
        });
        if (labels.length) childConnMeta.set(pKey, labels.join(' · '));
      });
    });

    function buildChildGroup(item, key, li, posStyle) {
      const badge = childConnMeta.has(key)
        ? `<div class="box-row-link">${DL.escapeHtml(childConnMeta.get(key))}</div>`
        : '';
      const cols = Math.min(item.children.length, 3);
      const gridCols = item.children.length === 1 ? '1fr' : `repeat(auto-fit, minmax(120px, 1fr))`;
      let html = `<div class="box-row" data-parent="${DL.escapeHtml(key)}" data-lane="${li}" data-cols="${cols}" style="${posStyle || ''}">`;
      html += badge;
      html += `<div class="box-row-grid" style="grid-template-columns:${gridCols}">`;
      item.children.forEach((child, ci) => {
        html += opts.renderChild(child, DL.childKey(key, child, ci), li);
      });
      html += `</div></div>`;
      return html;
    }

    let cells = '';
    if (opts && opts.compact) {
      // Compact: every lane is an independent flex stack, so a tall block
      // in one lane (e.g. many children) never stretches the others.
      lanes.forEach((lane, li) => {
        const col = li + 1;
        cells += `<div class="lane-title" style="grid-column:${col};grid-row:1">${DL.escapeHtml(lane.title)}</div>`;
        cells += `<div class="lane" data-lane="${li}" style="grid-column:${col};grid-row:2"></div>`;
        cells += `<div class="lane-stack" style="grid-column:${col};grid-row:2">`;
        (lane.items || []).forEach((item, ii) => {
          const key = DL.itemKey(item, li, ii);
          cells += opts.renderItem(item, key, li, '');
          if (hasChildren(item)) cells += buildChildGroup(item, key, li, '');
        });
        cells += `</div>`;
      });
      return `<div class="grid-wrap"><div class="lanes" style="grid-template-columns:${columns}">${cells}</div></div>`;
    }
    lanes.forEach((lane, li) => {
      const col = li + 1;
      cells += `<div class="lane-title" style="grid-column:${col};grid-row:1">${DL.escapeHtml(lane.title)}</div>`;
      cells += `<div class="lane" data-lane="${li}" style="grid-column:${col};grid-row:2 / ${rowCount + 2}"></div>`;
      (lane.items || []).forEach((item, ii) => {
        const key = DL.itemKey(item, li, ii);
        const row = positions[li][ii] + 2;
        cells += opts.renderItem(item, key, li, `grid-column:${col};grid-row:${row};`);
        if (hasChildren(item)) cells += buildChildGroup(item, key, li, `grid-column:${col};grid-row:${row + 1};`);
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

    const parentChildPairs = new Set();
    lanes.forEach((lane, li) => {
      const items = lane.items || [];
      items.forEach((item, ii) => {
        const key = DL.itemKey(item, li, ii);
        const el = byKey(key);
        if (!el) return;
        const next = items[ii + 1];
        if (hasChildren(item)) {
          item.children.forEach((child, ci) => {
            const cKey = DL.childKey(key, child, ci);
            parentChildPairs.add(`${key}|${cKey}`);
            parentChildPairs.add(`${cKey}|${key}`);
          });
          // Visual nesting links parent -> children; if the next item is
          // chained (not standalone), draw one clean vertical arrow from
          // the children group to it.
          if (next && !next.standalone && !item.branches) {
            const rowEl = surfaceEl.querySelector(`.box-row[data-parent="${CSS.escape(key)}"]`);
            const nextEl = byKey(DL.itemKey(next, li, ii + 1));
            if (rowEl && nextEl) edges.push(direct(rowEl, nextEl));
          }
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

    // Explicit: different lanes -> 'bus' (gutters between columns). Same
    // lane -> 'direct' when nothing sits between both boxes, else 'bus'
    // (down the lane's side gutter, so it never crosses a box).
    const blockedBetween = (a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const top = Math.min(ra.bottom, rb.bottom), bottom = Math.max(ra.top, rb.top);
      return Array.from(surfaceEl.querySelectorAll(`[data-lane="${a.dataset.lane}"][data-key]`)).some((el) => {
        if (el === a || el === b) return false;
        const r = el.getBoundingClientRect();
        return r.top < bottom && r.bottom > top;
      });
    };
    (cfg.connections || []).concat(extraConnections || []).forEach((conn) => {
      if (parentChildPairs.has(`${conn.from}|${conn.to}`)) return;
      const fromEl = byKey(conn.from);
      const toEl = byKey(conn.to);
      if (!fromEl || !toEl) return;
      const sameLane = fromEl.dataset.lane === toEl.dataset.lane;
      edges.push({
        kind: sameLane && !blockedBetween(fromEl, toEl) ? 'direct' : 'bus',
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
