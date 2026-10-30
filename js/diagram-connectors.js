/**
 * diagram-connectors.js
 * Orthogonal connector drawing engine shared between the hand-rolled
 * box+lane renderers (swimlane-renderer.js and bpmn-renderer.js). It
 * knows nothing about the source JSON: each renderer resolves its own
 * `edges` (normalized list) and asks this module to paint them inside
 * surfaceEl.
 *
 * Expected shape for each edge:
 *   {
 *     kind: 'direct' | 'rail' | 'lateral' | 'bus',
 *     fromEl: HTMLElement, toEl: HTMLElement,
 *     style: 'solid' | 'dashed',
 *     bidirectional?: boolean,
 *     label?: string
 *   }
 *  - 'direct': direct neighbors in the flow within the same lane
 *    (automatic chaining, branch fan-out/fan-in). Straight line or with
 *    a single bend.
 *  - 'lateral': adjacent columns connected at the edge (compat).
 *  - 'bus': explicit connection routed through the gaps between columns,
 *    with a local elbow between neighbors or dedicated rails below the
 *    grid. Never crosses intermediate boxes.
 */
window.DL = window.DL || {};

(function () {
  /**
   * Draws `edges` inside surfaceEl (must contain a `.grid-wrap` and
   * `.lane` columns, each with its layout already applied by the caller).
   * Measurements are taken with the surface's zoom transform cleared, so the
   * connectors are always in layout coordinates, whatever the zoom level.
   */
  DL.drawDiagramConnectors = function (surfaceEl, edges) {
    const prevTransform = surfaceEl.style.transform;
    surfaceEl.style.transform = '';
    try {
      drawConnectors(surfaceEl, edges);
    } finally {
      surfaceEl.style.transform = prevTransform;
    }
  };

  function drawConnectors(surfaceEl, edges) {
    const wrap = surfaceEl.querySelector('.grid-wrap');
    if (!wrap) return;
    wrap.querySelectorAll('.conn-seg, .conn-arrow, .conn-label').forEach((el) => el.remove());
    wrap.style.paddingBottom = '';

    const wrapRect = wrap.getBoundingClientRect();
    const labels = [];
    const laneEls = Array.from(surfaceEl.querySelectorAll('.lane'));
    const laneRects = laneEls.map((el) => el.getBoundingClientRect());

    function addSeg(x, y, w, h, dashed) {
      const seg = document.createElement('div');
      seg.className = 'conn-seg' + (dashed ? ' dashed' : '');
      const horizontal = w >= h;
      seg.style.left = x + 'px';
      seg.style.top = y + 'px';
      seg.style.width = Math.max(w, 1.6) + 'px';
      seg.style.height = Math.max(h, 1.6) + 'px';
      if (dashed) {
        seg.style.backgroundImage = horizontal
          ? 'repeating-linear-gradient(to right, #5a6b8c 0 4px, transparent 4px 8px)'
          : 'repeating-linear-gradient(to bottom, #5a6b8c 0 4px, transparent 4px 8px)';
        seg.style.backgroundColor = 'transparent';
      }
      wrap.appendChild(seg);
    }

    /** @param {'left'|'right'|'up'|'down'} dir Direction the arrow points to. */
    function addArrow(x, y, dir) {
      const arrow = document.createElement('div');
      arrow.className = 'conn-arrow';
      arrow.style.left = (x - 3.5) + 'px';
      arrow.style.top = (y - 5) + 'px';
      const rot = { right: 0, down: 90, left: 180, up: 270 }[dir];
      arrow.style.transform = `rotate(${rot}deg)`;
      wrap.appendChild(arrow);
    }

    function addLabel(x, y, text, rail) {
      labels.push({ x, y, text, rail });
    }

    function placeLabels() {
      labels.forEach(({ x, y, text, rail }) => {
        const label = document.createElement('span');
        label.className = 'conn-label';
        label.textContent = text;
        wrap.appendChild(label);
        if (rail) {
          const w = label.offsetWidth;
          const h = label.offsetHeight;
          y -= h / 2 + 7;
          const obstacles = Array.from(wrap.querySelectorAll('.conn-seg, .conn-arrow, .conn-label, .box, .bpmn-shape, .bpmn-caption'))
            .filter((el) => el !== label)
            .map((el) => el.getBoundingClientRect());
          // Adjacent lanes share a vertical gutter: find free caption space
          // beside it, keeping the caption above its dedicated track.
          const candidates = [x];
          for (let d = 16; d < wrap.clientWidth; d += 16) candidates.push(x + d, x - d);
          const freeX = candidates.find((cx) => cx - w / 2 >= 0 && cx + w / 2 <= wrap.clientWidth &&
            !obstacles.some((r) =>
              cx + w / 2 + 5 > r.left - wrapRect.left &&
              cx - w / 2 - 5 < r.right - wrapRect.left &&
              y + h / 2 + 4 > r.top - wrapRect.top &&
              y - h / 2 - 4 < r.bottom - wrapRect.top));
          if (freeX !== undefined) x = freeX;
        }
        label.style.left = x + 'px';
        label.style.top = y + 'px';
      });
    }

    function laneIndexOf(el) {
      const r = el.getBoundingClientRect();
      let best = 0, bestDist = Infinity;
      laneRects.forEach((lr, i) => {
        const d = Math.abs((lr.left + lr.right) / 2 - (r.left + r.right) / 2);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      return best;
    }

    /** Center of the gap between lane i and lane i+1 (coords relative to wrap). */
    function gapCenterX(i) {
      i = Math.max(0, Math.min(i, laneRects.length - 2));
      return (laneRects[i].right + laneRects[i + 1].left) / 2 - wrapRect.left;
    }

    // --- "direct" connectors: between consecutive items in the same lane
    //     (automatic chaining and parent/children branching). Always a
    //     straight line or a single bend (never crosses another box
    //     because it only connects direct neighbors in the flow). ---
    // --- "rail" connectors: parent->child and child->next within a
    //     stacked-children block. They exit on the left side and drop
    //     down through a lane gutter, so they never cross sibling boxes. ---
    edges.filter((e) => e.kind === 'rail').forEach((edge) => {
      const r1 = edge.fromEl.getBoundingClientRect();
      const r2 = edge.toEl.getBoundingClientRect();
      const laneEl = surfaceEl.querySelector(`.lane[data-lane="${edge.fromEl.dataset.lane}"]`);
      const railX = laneEl.getBoundingClientRect().left - wrapRect.left + 5;
      const x1 = r1.left - wrapRect.left;
      const y1 = r1.top + r1.height / 2 - wrapRect.top;
      const x2 = r2.left - wrapRect.left;
      const y2 = r2.top + r2.height / 2 - wrapRect.top;
      addSeg(railX - 0.8, y1 - 0.8, x1 - railX + 1.6, 1.6, false);
      addSeg(railX - 0.8, Math.min(y1, y2) - 0.8, 1.6, Math.abs(y2 - y1) + 1.6, false);
      addSeg(railX - 0.8, y2 - 0.8, x2 - railX + 1.6, 1.6, false);
      addArrow(x2, y2, 'right');
    });

    edges.filter((e) => e.kind === 'direct').forEach((edge) => {
      const r1 = edge.fromEl.getBoundingClientRect();
      const r2 = edge.toEl.getBoundingClientRect();
      const x1 = r1.left + r1.width / 2 - wrapRect.left;
      const y1 = r1.bottom - wrapRect.top;
      const x2 = r2.left + r2.width / 2 - wrapRect.left;
      const y2 = r2.top - wrapRect.top;
      const midY = y1 + (y2 - y1) / 2;

      const caption = edge.fromEl.querySelector('.bpmn-caption');
      if (caption) {
        const cr = caption.getBoundingClientRect();
        const sideX = Math.max(r1.right, cr.right) - wrapRect.left + 16;
        const startX = r1.right - wrapRect.left;
        const startY = r1.top + r1.height / 2 - wrapRect.top;
        const turnY = y2 - 18;
        addSeg(startX, startY - 0.8, sideX - startX, 1.6, false);
        addSeg(sideX - 0.8, startY, 1.6, turnY - startY, false);
        addSeg(Math.min(sideX, x2), turnY - 0.8, Math.abs(sideX - x2), 1.6, false);
        addSeg(x2 - 0.8, turnY, 1.6, y2 - turnY, false);
        if (edge.label) addLabel(sideX + 20, (cr.bottom - wrapRect.top + turnY) / 2, edge.label);
      } else if (Math.abs(x1 - x2) < 1) {
        addSeg(x1 - 0.8, y1, 1.6, y2 - y1, false);
      } else {
        addSeg(x1 - 0.8, y1, 1.6, Math.max(midY - y1, 1.6), false);
        addSeg(Math.min(x1, x2), midY - 0.8, Math.abs(x2 - x1), 1.6, false);
        addSeg(x2 - 0.8, midY, 1.6, Math.max(y2 - midY, 1.6), false);
      }
      addArrow(x2, y2, 'down');
      if (edge.label && !caption) addLabel(x1 + 20, midY, edge.label);
    });

    // --- Conectores laterales (compat, columnas adyacentes) ---
    edges.filter((e) => e.kind === 'lateral').forEach((edge) => {
      const r1 = edge.fromEl.getBoundingClientRect();
      const r2 = edge.toEl.getBoundingClientRect();
      const fromRight = r2.left >= r1.right;
      const x1 = (fromRight ? r1.right : r1.left) - wrapRect.left;
      const y1 = r1.top + r1.height / 2 - wrapRect.top;
      const x2 = (fromRight ? r2.left : r2.right) - wrapRect.left;
      const y2 = r2.top + r2.height / 2 - wrapRect.top;
      const midX = x1 + (x2 - x1) / 2;
      const dashed = edge.style === 'dashed';

      addSeg(Math.min(x1, midX), y1 - 0.8, Math.abs(midX - x1), 1.6, dashed);
      addSeg(midX - 0.8, Math.min(y1, y2), 1.6, Math.abs(y2 - y1), dashed);
      addSeg(Math.min(midX, x2), y2 - 0.8, Math.abs(x2 - midX), 1.6, dashed);

      addArrow(x2, y2, fromRight ? 'right' : 'left');
      if (edge.bidirectional) addArrow(x1, y1, fromRight ? 'left' : 'right');

      if (edge.label) addLabel(midX, (y1 + y2) / 2, edge.label);
    });

    // --- "bus" connectors (explicit): through the gaps between columns. ---
    const busEdges = edges.filter((e) => e.kind === 'bus');
    let track = 0;
    let contentBottom = wrap.querySelector('.lanes').getBoundingClientRect().bottom - wrapRect.top;
    surfaceEl.querySelectorAll('.bpmn-caption').forEach((caption) => {
      contentBottom = Math.max(contentBottom, caption.getBoundingClientRect().bottom - wrapRect.top);
    });

    // Classify upfront: connections between NEIGHBORING lanes always route
    // through their single local gap (never sharing the bottom rail
    // reserved for long jumps). We group by shared gap to distribute the
    // available space among whichever connections land there, instead of
    // stacking them all on the same central axis.
    const edgeInfo = busEdges.map((edge) => ({
      edge,
      laneFrom: laneIndexOf(edge.fromEl),
      laneTo: laneIndexOf(edge.toEl),
    }));
    const adjacentInfo = edgeInfo.filter((i) => Math.abs(i.laneFrom - i.laneTo) === 1);
    const farInfo = edgeInfo.filter((i) => Math.abs(i.laneFrom - i.laneTo) !== 1);
    const gapGroups = new Map();
    adjacentInfo.forEach((info) => {
      const key = Math.min(info.laneFrom, info.laneTo);
      if (!gapGroups.has(key)) gapGroups.set(key, []);
      gapGroups.get(key).push(info);
    });

    busEdges.forEach((edge, idx) => {
      const r1 = edge.fromEl.getBoundingClientRect();
      const r2 = edge.toEl.getBoundingClientRect();
      const laneFrom = laneIndexOf(edge.fromEl);
      const laneTo = laneIndexOf(edge.toEl);
      const dashed = edge.style === 'dashed';
      const farIdx = farInfo.findIndex((i) => i.edge === edge);
      const spread = farIdx >= 0 ? (farIdx - (farInfo.length - 1) / 2) * 6 : 0;

      if (laneFrom === laneTo) {
        // Same lane: there's no gap to route through; direct fallback (rare
        // case, prefer using "children" or reordering the items instead of
        // relying on this for connections within the same lane).
        const x1 = r1.left + r1.width / 2 - wrapRect.left;
        const y1 = r1.bottom - wrapRect.top;
        const x2 = r2.left + r2.width / 2 - wrapRect.left;
        const y2 = r2.bottom - wrapRect.top;
        const railY = Math.max(y1, y2) + 20 + idx * 16;
        addSeg(x1 - 0.8, y1, 1.6, railY - y1, dashed);
        addSeg(Math.min(x1, x2) - 0.8, railY - 0.8, Math.abs(x2 - x1) + 1.6, 1.6, dashed);
        addSeg(x2 - 0.8, y2, 1.6, railY - y2, dashed);
        addArrow(x2, y2 + 1, 'up');
        if (edge.bidirectional) addArrow(x1, y1 + 1, 'up');
        if (edge.label) addLabel((x1 + x2) / 2, railY, edge.label, true);
        return;
      }

      const dirRight = laneTo > laneFrom;
      const fromGapIdx = dirRight ? laneFrom : laneFrom - 1;
      const toGapIdx = dirRight ? laneTo - 1 : laneTo;
      let fromRight = dirRight;
      let toRight = !dirRight;
      let fromEdgeX = (fromRight ? r1.right : r1.left) - wrapRect.left;
      let toEdgeX = (toRight ? r2.right : r2.left) - wrapRect.left;
      const y1c = r1.top + r1.height / 2 - wrapRect.top;
      const y2c = r2.top + r2.height / 2 - wrapRect.top;

      // --- Neighboring lanes: always route through the local gap, splitting
      //     its space among however many connections share it. ---
      if (Math.abs(laneFrom - laneTo) === 1) {
        const gapKey = Math.min(laneFrom, laneTo);
        const group = gapGroups.get(gapKey);
        const posInGroup = group.findIndex((i) => i.edge === edge);
        const gapWidth = laneRects[gapKey + 1].left - laneRects[gapKey].right;
        const step = Math.min(10, Math.max(4, (gapWidth - 6) / Math.max(group.length, 1)));
        const localSpread = (posInGroup - (group.length - 1) / 2) * step;
        const gapX = gapCenterX(gapKey) + localSpread;

        let labelPos = null;
        if (edge.label) {
          const probe = document.createElement('span');
          probe.className = 'conn-label';
          probe.textContent = edge.label;
          wrap.appendChild(probe);
          const w = probe.offsetWidth;
          const h = probe.offsetHeight;
          probe.remove();
          const obstacles = Array.from(surfaceEl.querySelectorAll('.box, .bpmn-shape, .bpmn-caption'))
            .map((el) => el.getBoundingClientRect());
          const fits = (cx, cy) => cx - w / 2 >= 0 && cx + w / 2 <= wrap.clientWidth &&
            !obstacles.some((r) =>
              cx + w / 2 + 5 > r.left - wrapRect.left &&
              cx - w / 2 - 5 < r.right - wrapRect.left &&
              cy + h / 2 + 4 > r.top - wrapRect.top &&
              cy - h / 2 - 4 < r.bottom - wrapRect.top);
          const yMid = (y1c + y2c) / 2;
          const yCandidates = [yMid];
          const ySpan = Math.abs(y2c - y1c) / 2 + 60;
          for (let d = 16; d < ySpan; d += 16) yCandidates.push(yMid + d, yMid - d);
          searchLabel:
          for (const cy of yCandidates) {
            for (const cx of [gapX, gapX + w / 2 + 10, gapX - w / 2 - 10]) {
              if (fits(cx, cy)) { labelPos = { x: cx, y: cy }; break searchLabel; }
            }
          }
          if (!labelPos) labelPos = { x: gapX, y: yMid };
        }

        addSeg(Math.min(fromEdgeX, gapX), y1c - 0.8, Math.abs(gapX - fromEdgeX), 1.6, dashed);
        addSeg(gapX - 0.8, Math.min(y1c, y2c), 1.6, Math.abs(y2c - y1c), dashed);
        addSeg(Math.min(gapX, toEdgeX), y2c - 0.8, Math.abs(toEdgeX - gapX), 1.6, dashed);
        addArrow(toEdgeX, y2c, toRight ? 'left' : 'right');
        if (edge.bidirectional) addArrow(fromEdgeX, y1c, fromRight ? 'left' : 'right');
        if (labelPos) addLabel(labelPos.x, labelPos.y, edge.label);
        return;
      }

      // fromGapIdx/toGapIdx are always distinct gutters here (the
      // single-shared-gutter case only happens at distance 1, handled by
      // the adjacent-lane branch above with its own early return), so the
      // nearest-side entry/exit computed above is used as-is: the route
      // enters the destination box from whichever side faces the skipped
      // lane(s), not the far side.
      const gapXFrom = gapCenterX(fromGapIdx) + spread;
      const gapXTo = gapCenterX(toGapIdx) + spread;

      // One dedicated track per routed connection, below the shared grid.
      const railY = contentBottom + 34 + track++ * 34;

      // 1) lateral exit from the source box to the center of the gap
      addSeg(Math.min(fromEdgeX, gapXFrom), y1c - 0.8, Math.abs(gapXFrom - fromEdgeX), 1.6, dashed);
      // 2) go down through the gap to the rail
      addSeg(gapXFrom - 0.8, Math.min(y1c, railY), 1.6, Math.abs(railY - y1c), dashed);
      // 3) travel along the rail (if the entry gap differs from the exit gap)
      if (Math.abs(gapXFrom - gapXTo) > 0.5) {
        addSeg(Math.min(gapXFrom, gapXTo) - 0.8, railY - 0.8, Math.abs(gapXTo - gapXFrom) + 1.6, 1.6, dashed);
      }
      // 4) go up through the destination gap to the destination box's height
      addSeg(gapXTo - 0.8, Math.min(railY, y2c), 1.6, Math.abs(railY - y2c), dashed);
      // 5) lateral entry into the destination box
      addSeg(Math.min(gapXTo, toEdgeX), y2c - 0.8, Math.abs(toEdgeX - gapXTo), 1.6, dashed);

      addArrow(toEdgeX, y2c, toRight ? 'left' : 'right');
      if (edge.bidirectional) addArrow(fromEdgeX, y1c, fromRight ? 'left' : 'right');

      if (edge.label) addLabel((gapXFrom + gapXTo) / 2, railY, edge.label, true);
    });

    placeLabels();
    // If there are "bus" connectors, the container needs extra bottom space
    // so the rail doesn't get clipped.
    if (busEdges.length) {
      let railMax = 0;
      wrap.querySelectorAll('.conn-seg, .conn-label').forEach((s) => {
        railMax = Math.max(railMax, s.getBoundingClientRect().bottom - wrapRect.top);
      });
      wrap.style.paddingBottom = Math.max(0, railMax - wrap.clientHeight + 18) + 'px';
    } else {
      wrap.style.paddingBottom = '';
    }
  };
})();
