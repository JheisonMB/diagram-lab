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
    // Detect same-lane fan-out groups: when an item connects to 2+ consecutive
    // standalone items right after it in the same lane (e.g. Eventos BEA ->
    // Notificaciones & Eberillion), group those targets into a horizontal row
    // so both branches share the exact same clean fork geometry.
    const fanoutAfter = new Map(); // laneIdx -> Map(parentItemIdx -> [childItemIdx...])
    const groupedInLane = new Set(); // "li:ii"
    const conns = cfg.connections || [];
    lanes.forEach((lane, li) => {
      const items = lane.items || [];
      const keyToIdx = new Map();
      items.forEach((it, ii) => keyToIdx.set(DL.itemKey(it, li, ii), ii));
      items.forEach((item, ii) => {
        if (hasChildren(item)) return;
        const pKey = DL.itemKey(item, li, ii);
        const targets = [];
        conns.forEach((c) => {
          if (c.from !== pKey) return;
          const ti = keyToIdx.get(c.to);
          if (ti !== undefined && ti > ii && items[ti].standalone && !hasChildren(items[ti]) && !targets.includes(ti)) {
            targets.push(ti);
          }
        });
        targets.sort((a, b) => a - b);
        // Only group if they form a contiguous block right after the parent.
        if (targets.length >= 2 && targets[0] === ii + 1 &&
            targets.every((ti, k) => ti === ii + 1 + k && !groupedInLane.has(`${li}:${ti}`))) {
          if (!fanoutAfter.has(li)) fanoutAfter.set(li, new Map());
          fanoutAfter.get(li).set(ii, targets);
          targets.forEach((ti) => groupedInLane.add(`${li}:${ti}`));
        }
      });
    });

    const columns = lanes
      .map((lane, li) => (((lane.items || []).some(hasChildren) || fanoutAfter.has(li)) ? 'minmax(320px, 1.45fr)' : 'minmax(205px, 1fr)'))
      .join(' ');

    function buildRowHtml(parentKey, children, li, posStyle, renderFn) {
      const gridCols = children.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(130px, 1fr))';
      let html = `<div class="box-row" data-parent="${DL.escapeHtml(parentKey)}" data-lane="${li}" style="grid-template-columns:${gridCols};${posStyle || ''}">`;
      children.forEach((child, ci) => {
        html += renderFn(child, ci);
      });
      html += `</div>`;
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
        const items = lane.items || [];
        const laneFanouts = fanoutAfter.get(li);
        items.forEach((item, ii) => {
          if (groupedInLane.has(`${li}:${ii}`)) return;
          const key = DL.itemKey(item, li, ii);
          cells += opts.renderItem(item, key, li, '');
          if (hasChildren(item)) {
            cells += buildRowHtml(key, item.children, li, '', (c, ci) => opts.renderChild(c, DL.childKey(key, c, ci), li));
          } else if (laneFanouts && laneFanouts.has(ii)) {
            const targetIdxs = laneFanouts.get(ii);
            cells += buildRowHtml(key, targetIdxs, li, '', (ti) => opts.renderItem(items[ti], DL.itemKey(items[ti], li, ti), li, ''));
          }
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
        if (hasChildren(item)) {
          cells += buildRowHtml(key, item.children, li, `grid-column:${col};grid-row:${row + 1};`, (c, ci) => opts.renderChild(c, DL.childKey(key, c, ci), li));
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

    const explicitPairs = new Set();
    (cfg.connections || []).concat(extraConnections || []).forEach((c) => {
      explicitPairs.add(`${c.from}|${c.to}`);
      explicitPairs.add(`${c.to}|${c.from}`);
    });
    lanes.forEach((lane, li) => {
      const items = lane.items || [];
      items.forEach((item, ii) => {
        const key = DL.itemKey(item, li, ii);
        const el = byKey(key);
        if (!el) return;
        const next = items[ii + 1];
        if (hasChildren(item)) {
          // Connect parent cleanly down to its first row of children (skipping
          // pairs already declared in cfg.connections so we don't double-draw).
          const elBottom = el.getBoundingClientRect().bottom;
          item.children.forEach((child, ci) => {
            const cKey = DL.childKey(key, child, ci);
            if (explicitPairs.has(`${key}|${cKey}`)) return;
            const cEl = byKey(cKey);
            if (cEl && cEl.getBoundingClientRect().top - elBottom < 60) {
              edges.push(direct(el, cEl));
            }
          });
          // If the next item is chained (not standalone), draw one clean
          // vertical arrow from the children row to it.
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
