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
    const laneTop = laneRects.length ? Math.min(...laneRects.map((r) => r.top)) - wrapRect.top : 0;

    function measure(text) {
      const probe = document.createElement('span');
      probe.className = 'conn-label';
      probe.textContent = text;
      wrap.appendChild(probe);
      const size = { w: probe.offsetWidth, h: probe.offsetHeight };
      probe.remove();
      return size;
    }

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
          const obstacles = Array.from(wrap.querySelectorAll('.conn-seg, .conn-arrow, .conn-label, .box, .lane-title, .bpmn-shape, .bpmn-caption'))
            .filter((el) => el !== label)
            .map((el) => el.getBoundingClientRect());
          // Adjacent lanes share a vertical gutter: find free caption space
          // beside it, keeping the caption above its dedicated track.
          const candidates = [x];
          for (let d = 16; d < wrap.clientWidth; d += 16) candidates.push(x + d, x - d);
          const freeX = candidates.find((cx) => cx - w / 2 >= 0 && cx + w / 2 <= wrap.clientWidth &&
            !obstacles.some((r) =>
              cx + w / 2 + 4 > r.left - wrapRect.left &&
              cx - w / 2 - 4 < r.right - wrapRect.left &&
              y + h / 2 + 2 > r.top - wrapRect.top &&
              y - h / 2 - 2 < r.bottom - wrapRect.top));
          if (freeX !== undefined) x = freeX;
        } else {
          // Safety net: an elbow drawn after this label's spot was chosen
          // (a later sibling sharing the gutter) can still cross it. Nudge
          // to the nearest free cell — a no-op when nothing collides.
          const w = label.offsetWidth;
          const h = label.offsetHeight;
          const obstacles = Array.from(wrap.querySelectorAll('.conn-seg, .conn-arrow, .conn-label, .box, .lane-title, .bpmn-shape, .bpmn-caption'))
            .filter((el) => el !== label)
            .map((el) => el.getBoundingClientRect());
          const fits = (cx, cy) => cx - w / 2 >= 0 && cx + w / 2 <= wrap.clientWidth && cy - h / 2 >= laneTop &&
            !obstacles.some((r) =>
              cx + w / 2 + 4 > r.left - wrapRect.left &&
              cx - w / 2 - 4 < r.right - wrapRect.left &&
              cy + h / 2 + 2 > r.top - wrapRect.top &&
              cy - h / 2 - 2 < r.bottom - wrapRect.top);
          if (!fits(x, y)) {
            let best = null, bestDist = Infinity;
            const ySteps = [0];
            for (let d = 4; d <= 220; d += 4) ySteps.push(d, -d);
            const xSteps = [0];
            for (let d = 10; d <= 220; d += 10) xSteps.push(d, -d);
            for (const dy of ySteps) {
              if (dy * dy * 1.5 >= bestDist) break;
              const cy = y + dy;
              if (cy - h / 2 < laneTop) continue;
              for (const dx of xSteps) {
                const dist = dx * dx + dy * dy * 1.5;
                if (dist >= bestDist) break;
                const cx = x + dx;
                if (fits(cx, cy)) { best = { x: cx, y: cy }; bestDist = dist; break; }
              }
            }
            if (best) { x = best.x; y = best.y; }
          }
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
      if (edge.label && !caption) {
        const { w } = measure(edge.label);
        addLabel(x1 + w / 2 + 8, midY, edge.label);
      }
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
    //  1. Plan every connection (which gutters it needs, which box sides).
    //  2. Give each gutter user its own vertical slot (connections leaving
    //     the same box side with the same style share one trunk).
    //  3. Spread the attachment points along each box side, ordered by the
    //     far end's height, so parallel arrows never merge or cross.
    //  4. Draw: neighbors use their local gutter; long jumps cross the
    //     intermediate lanes on the first free horizontal corridor; same-lane
    //     links run down the lane's side gutter. The bottom rail is only a
    //     last resort.
    const busEdges = edges.filter((e) => e.kind === 'bus');
    let track = 0;
    let contentBottom = wrap.querySelector('.lanes').getBoundingClientRect().bottom - wrapRect.top;
    surfaceEl.querySelectorAll('.bpmn-caption').forEach((caption) => {
      contentBottom = Math.max(contentBottom, caption.getBoundingClientRect().bottom - wrapRect.top);
    });
    const rel = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left - wrapRect.left, right: r.right - wrapRect.left, top: r.top - wrapRect.top, bottom: r.bottom - wrapRect.top };
    };
    const boxRects = Array.from(wrap.querySelectorAll('.box, .bpmn-shape, .bpmn-caption')).map(rel);
    const keyOf = (el) => el.dataset.key || '';

    const plans = busEdges.map((edge) => {
      const laneFrom = laneIndexOf(edge.fromEl);
      const laneTo = laneIndexOf(edge.toEl);
      const dashed = edge.style === 'dashed';
      const plan = { edge, laneFrom, laneTo, dashed, r1: rel(edge.fromEl), r2: rel(edge.toEl) };
      if (laneFrom === laneTo) {
        const gap = laneFrom < laneRects.length - 1 ? laneFrom : laneFrom - 1;
        if (gap < 0) return Object.assign(plan, { kind: 'loop' });
        const side = gap === laneFrom ? 'right' : 'left';
        return Object.assign(plan, { kind: 'same', fromSide: side, toSide: side, fromGap: gap, toGap: gap });
      }
      const dirRight = laneTo > laneFrom;
      return Object.assign(plan, {
        kind: Math.abs(laneTo - laneFrom) === 1 ? 'adjacent' : 'far',
        fromSide: dirRight ? 'right' : 'left',
        toSide: dirRight ? 'left' : 'right',
        fromGap: dirRight ? laneFrom : laneFrom - 1,
        toGap: dirRight ? laneTo - 1 : laneTo,
      });
    });

    // Attachment points along each box side (computed first so gutter
    // allocation knows which adjacent links are purely horizontal).
    const ports = new Map();
    const usePort = (el, side, shareKey, otherY, plan, field) => {
      const k = `${keyOf(el)}|${side}`;
      if (!ports.has(k)) ports.set(k, { el, users: [] });
      const entry = ports.get(k);
      let user = entry.users.find((u) => u.shareKey === shareKey);
      if (!user) { user = { shareKey, otherY, plans: [] }; entry.users.push(user); }
      user.plans.push({ plan, field });
    };
    const trunkKey = (p) => `${keyOf(p.edge.fromEl)}|${p.fromSide}|${p.dashed}`;
    plans.forEach((p, i) => {
      if (p.kind === 'loop') return;
      const c1 = (p.r1.top + p.r1.bottom) / 2;
      const c2 = (p.r2.top + p.r2.bottom) / 2;
      usePort(p.edge.fromEl, p.fromSide, p.kind === 'same' || p.kind === 'far' ? trunkKey(p) : `o${i}`, c2, p, 'y1');
      usePort(p.edge.toEl, p.toSide, `i${i}`, c1, p, 'y2');
    });
    ports.forEach(({ el, users }) => {
      const r = rel(el);
      users.sort((a, b) => a.otherY - b.otherY);
      const n = users.length;
      const span = Math.min(r.bottom - r.top - 12, 14 * (n - 1));
      users.forEach((user, i) => {
        const y = (r.top + r.bottom) / 2 + (n > 1 ? (i / (n - 1) - 0.5) * span : 0);
        user.plans.forEach(({ plan, field }) => { plan[field] = y; });
      });
    });

    // Gutter slots. Purely horizontal adjacent links need no vertical track.
    const gapUsers = new Map();
    const useGap = (gap, shareKey, plan, field) => {
      if (!gapUsers.has(gap)) gapUsers.set(gap, []);
      const users = gapUsers.get(gap);
      let user = users.find((u) => u.shareKey === shareKey);
      if (!user) { user = { shareKey, plans: [], sortY: Infinity, span: 0 }; users.push(user); }
      user.plans.push({ plan, field });
      user.sortY = Math.min(user.sortY, plan.y1, plan.y2);
      user.span = Math.max(user.span, Math.abs(plan.y2 - plan.y1));
    };
    plans.forEach((p, i) => {
      if (p.kind === 'loop') return;
      if (p.kind === 'adjacent' && Math.abs(p.y2 - p.y1) < 2) {
        p.gapX = gapCenterX(p.fromGap);
        return;
      }
      if (p.kind === 'same' || p.kind === 'adjacent') {
        useGap(p.fromGap, p.kind === 'same' ? trunkKey(p) : `e${i}`, p, 'gapX');
      } else {
        useGap(p.fromGap, trunkKey(p), p, 'gapXFrom');
        useGap(p.toGap, `in${i}`, p, 'gapXTo');
      }
    });
    gapUsers.forEach((users, gap) => {
      const gapWidth = laneRects[gap + 1].left - laneRects[gap].right;
      const step = Math.min(12, Math.max(6, (gapWidth - 10) / Math.max(users.length, 1)));
      // Keep longer vertical runs separated cleanly from shorter local elbows.
      users.sort((a, b) => a.sortY - b.sortY || b.span - a.span);
      users.forEach((user, i) => {
        const x = gapCenterX(gap) + (i - (users.length - 1) / 2) * step;
        user.plans.forEach(({ plan, field }) => { plan[field] = x; });
      });
    });

    const edgeX = (r, side) => (side === 'right' ? r.right : r.left);
    const pointer = (side) => (side === 'right' ? 'left' : 'right');
    const corridors = [];

    function drawBottomRail(p, gapXFrom, gapXTo) {
      const { edge, dashed, y1, y2 } = p;
      const fromEdgeX = edgeX(p.r1, p.fromSide);
      const toEdgeX = edgeX(p.r2, p.toSide);
      const railY = contentBottom + 34 + track++ * 34;
      addSeg(Math.min(fromEdgeX, gapXFrom), y1 - 0.8, Math.abs(gapXFrom - fromEdgeX), 1.6, dashed);
      addSeg(gapXFrom - 0.8, Math.min(y1, railY), 1.6, Math.abs(railY - y1), dashed);
      if (Math.abs(gapXFrom - gapXTo) > 0.5) {
        addSeg(Math.min(gapXFrom, gapXTo) - 0.8, railY - 0.8, Math.abs(gapXTo - gapXFrom) + 1.6, 1.6, dashed);
      }
      addSeg(gapXTo - 0.8, Math.min(railY, y2), 1.6, Math.abs(railY - y2), dashed);
      addSeg(Math.min(gapXTo, toEdgeX), y2 - 0.8, Math.abs(toEdgeX - gapXTo), 1.6, dashed);
      addArrow(toEdgeX, y2, pointer(p.toSide));
      if (edge.bidirectional) addArrow(fromEdgeX, y1, pointer(p.fromSide));
      if (edge.label) addLabel((gapXFrom + gapXTo) / 2, railY, edge.label, true);
    }

    /** First y where a horizontal from xa to xb crosses no box nor corridor.
     *  When inside a gap between boxes, nudges the line toward one edge of the
     *  gap so a ~26px band remains clear on the other side for its label. */
    function freeCorridor(xa, xb, preferred, hasLabel) {
      const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
      const clear = (y) => y > laneTop + 6 && y < contentBottom - 6 &&
        !boxRects.some((r) => r.right > lo && r.left < hi && y > r.top - 6 && y < r.bottom + 6) &&
        !corridors.some((c) => c.hi > lo && c.lo < hi && Math.abs(c.y - y) < 24);
      const pick = (y) => {
        if (!clear(y)) return null;
        if (!hasLabel) return y;
        // Find the vertical gap bounds at y across [lo, hi].
        let topBound = laneTop, botBound = contentBottom;
        boxRects.forEach((r) => {
          if (r.right <= lo || r.left >= hi) return;
          if (r.bottom <= y) topBound = Math.max(topBound, r.bottom);
          if (r.top >= y) botBound = Math.min(botBound, r.top);
        });
        if (y - topBound >= 24 || botBound - y >= 24) return y;
        if (clear(botBound - 6)) return botBound - 6;
        if (clear(topBound + 6)) return topBound + 6;
        return y;
      };
      for (const y of preferred) { const hit = pick(y); if (hit !== null) return hit; }
      const start = preferred[0];
      for (let d = 6; d < contentBottom; d += 6) {
        const down = pick(start + d); if (down !== null) return down;
        const up = pick(start - d); if (up !== null) return up;
      }
      return null;
    }

    plans.forEach((p, idx) => {
      const { edge, dashed } = p;

      if (p.kind === 'loop') {
        // Single-lane diagram: no gutter to route through; loop below.
        const x1 = (p.r1.left + p.r1.right) / 2;
        const y1 = p.r1.bottom;
        const x2 = (p.r2.left + p.r2.right) / 2;
        const y2 = p.r2.bottom;
        const railY = Math.max(y1, y2) + 20 + idx * 16;
        addSeg(x1 - 0.8, y1, 1.6, railY - y1, dashed);
        addSeg(Math.min(x1, x2) - 0.8, railY - 0.8, Math.abs(x2 - x1) + 1.6, 1.6, dashed);
        addSeg(x2 - 0.8, y2, 1.6, railY - y2, dashed);
        addArrow(x2, y2 + 1, 'up');
        if (edge.bidirectional) addArrow(x1, y1 + 1, 'up');
        if (edge.label) addLabel((x1 + x2) / 2, railY, edge.label, true);
        return;
      }

      const { y1, y2 } = p;
      const fromEdgeX = edgeX(p.r1, p.fromSide);
      const toEdgeX = edgeX(p.r2, p.toSide);

      if (p.kind === 'same') {
        // Same lane: down the side gutter, entering the target sideways.
        const gapX = p.gapX;
        addSeg(Math.min(fromEdgeX, gapX), y1 - 0.8, Math.abs(gapX - fromEdgeX), 1.6, dashed);
        addSeg(gapX - 0.8, Math.min(y1, y2), 1.6, Math.abs(y2 - y1), dashed);
        addSeg(Math.min(gapX, toEdgeX), y2 - 0.8, Math.abs(toEdgeX - gapX), 1.6, dashed);
        addArrow(toEdgeX, y2, pointer(p.toSide));
        if (edge.bidirectional) addArrow(fromEdgeX, y1, pointer(p.fromSide));
        if (edge.label) {
          // In the spacing just above the target, flush with the trunk side.
          const { w, h } = measure(edge.label);
          const above = y2 < y1;
          const ly = above ? p.r2.bottom + h / 2 + 5 : p.r2.top - h / 2 - 5;
          const lx = p.toSide === 'right' ? p.r2.right - w / 2 - 4 : p.r2.left + w / 2 + 4;
          addLabel(lx, ly, edge.label);
        }
        return;
      }

      if (p.kind === 'far') {
        // Long jump: cross the intermediate lanes on a free corridor.
        const { gapXFrom, gapXTo } = p;
        const yStar = freeCorridor(fromEdgeX, gapXTo, [y1, y2, (y1 + y2) / 2], !!edge.label);
        if (yStar === null) { drawBottomRail(p, gapXFrom, gapXTo); return; }
        const direct = Math.abs(yStar - y1) < 0.5;
        const cStart = direct ? fromEdgeX : gapXFrom;
        corridors.push({ lo: Math.min(cStart, gapXTo), hi: Math.max(cStart, gapXTo), y: yStar });
        if (!direct) {
          addSeg(Math.min(fromEdgeX, gapXFrom), y1 - 0.8, Math.abs(gapXFrom - fromEdgeX), 1.6, dashed);
          addSeg(gapXFrom - 0.8, Math.min(y1, yStar), 1.6, Math.abs(yStar - y1), dashed);
        }
        addSeg(Math.min(cStart, gapXTo) - 0.8, yStar - 0.8, Math.abs(gapXTo - cStart) + 1.6, 1.6, dashed);
        addSeg(gapXTo - 0.8, Math.min(yStar, y2), 1.6, Math.abs(y2 - yStar), dashed);
        addSeg(Math.min(gapXTo, toEdgeX), y2 - 0.8, Math.abs(toEdgeX - gapXTo), 1.6, dashed);
        addArrow(toEdgeX, y2, pointer(p.toSide));
        if (edge.bidirectional) addArrow(fromEdgeX, y1, pointer(p.fromSide));
        if (edge.label) {
          // Place above or below the horizontal corridor across its full
          // straight stretch, picking the first spot with no overlap.
          const loX = Math.min(cStart, gapXTo);
          const hiX = Math.max(cStart, gapXTo);
          const midX = (loX + hiX) / 2;
          const { w, h } = measure(edge.label);
          const obs = Array.from(surfaceEl.querySelectorAll('.box, .lane-title, .bpmn-shape, .bpmn-caption, .conn-seg, .conn-arrow'))
            .map((el) => el.getBoundingClientRect());
          labels.forEach(({ x: lx, y: ly, text: lt, rail: lr }) => {
            const q = measure(lt);
            const qy = lr ? ly - q.h / 2 - 7 : ly;
            obs.push({
              left: wrapRect.left + lx - q.w / 2, top: wrapRect.top + qy - q.h / 2,
              right: wrapRect.left + lx + q.w / 2, bottom: wrapRect.top + qy + q.h / 2,
            });
          });
          const clear = (cx, cy) => cx - w / 2 >= loX && cx + w / 2 <= hiX && cy - h / 2 >= laneTop &&
            !obs.some((r) =>
              cx + w / 2 + 4 > r.left - wrapRect.left &&
              cx - w / 2 - 4 < r.right - wrapRect.left &&
              cy + h / 2 + 2 > r.top - wrapRect.top &&
              cy - h / 2 - 2 < r.bottom - wrapRect.top);
          const xs = [midX];
          for (let d = 16; d < hiX - loX; d += 16) xs.push(midX + d, midX - d);
          let chosen = null;
          for (const cy of [yStar - h / 2 - 3, yStar + h / 2 + 3]) {
            const cx = xs.find((x) => clear(x, cy));
            if (cx !== undefined) { chosen = { x: cx, y: cy }; break; }
          }
          addLabel(chosen ? chosen.x : midX, chosen ? chosen.y : yStar - h / 2 - 4, edge.label);
        }
        return;
      }

      // --- Neighboring lanes: always route cleanly through the local gap
      //     (never stretching a hairpin down to the bottom rail just to
      //     hang a label). Place the label near the entry/exit arrow or in
      //     the nearest free cell beside the shared gutter. ---
      const gapX = p.gapX;
      if (Math.abs(y2 - y1) < 1) {
        addSeg(Math.min(fromEdgeX, toEdgeX), y1 - 0.8, Math.abs(toEdgeX - fromEdgeX), 1.6, dashed);
      } else {
        addSeg(Math.min(fromEdgeX, gapX), y1 - 0.8, Math.abs(gapX - fromEdgeX), 1.6, dashed);
        addSeg(gapX - 0.8, Math.min(y1, y2), 1.6, Math.abs(y2 - y1), dashed);
        addSeg(Math.min(gapX, toEdgeX), y2 - 0.8, Math.abs(toEdgeX - gapX), 1.6, dashed);
      }
      addArrow(toEdgeX, y2, pointer(p.toSide));
      if (edge.bidirectional) addArrow(fromEdgeX, y1, pointer(p.fromSide));

      if (edge.label) {
        const { w, h } = measure(edge.label);
        const obstacles = Array.from(surfaceEl.querySelectorAll('.box, .lane-title, .bpmn-shape, .bpmn-caption, .conn-seg, .conn-arrow'))
          .map((el) => el.getBoundingClientRect());
        // Labels queued for earlier connections aren't in the DOM yet:
        // probe-measure them so siblings sharing one gutter don't
        // converge on the same free cell and pile up.
        labels.forEach(({ x: lx, y: ly, text: lt, rail: lr }) => {
          const q = measure(lt);
          const qy = lr ? ly - q.h / 2 - 7 : ly;
          obstacles.push({
            left: wrapRect.left + lx - q.w / 2, top: wrapRect.top + qy - q.h / 2,
            right: wrapRect.left + lx + q.w / 2, bottom: wrapRect.top + qy + q.h / 2,
          });
        });
        const fits = (cx, cy) => cx - w / 2 >= 0 && cx + w / 2 <= wrap.clientWidth && cy - h / 2 >= laneTop &&
          !obstacles.some((r) =>
            cx + w / 2 + 4 > r.left - wrapRect.left &&
            cx - w / 2 - 4 < r.right - wrapRect.left &&
            cy + h / 2 + 2 > r.top - wrapRect.top &&
            cy - h / 2 - 2 < r.bottom - wrapRect.top);
        const yMid = (y1 + y2) / 2;
        const yCandidates = [yMid];
        const ySpan = Math.abs(y2 - y1) / 2 + 60;
        for (let d = 8; d < ySpan; d += 8) yCandidates.push(yMid + d, yMid - d);
        const nearTargetX = p.toSide === 'left' ? p.r2.left + w / 2 + 4 : p.r2.right - w / 2 - 4;
        const nearSourceX = p.fromSide === 'left' ? p.r1.left + w / 2 + 4 : p.r1.right - w / 2 - 4;
        const nearTarget = [
          { x: nearTargetX, y: p.r2.top - h / 2 - 5 },
          { x: nearTargetX, y: p.r2.bottom + h / 2 + 5 }
        ];
        const nearSource = [
          { x: nearSourceX, y: p.r1.bottom + h / 2 + 5 },
          { x: nearSourceX, y: p.r1.top - h / 2 - 5 }
        ];
        const gapCandidates = [];
        yCandidates.forEach((cy) => {
          [gapX, gapX + w / 2 + 8, gapX - w / 2 - 8, nearTargetX, nearSourceX]
            .forEach((cx) => gapCandidates.push({ x: cx, y: cy }));
        });
        const candidates = Math.abs(y2 - y1) >= 40
          ? nearTarget.concat(nearSource, gapCandidates)
          : nearSource.concat(nearTarget, gapCandidates);
        const labelPos = candidates.find((c) => fits(c.x, c.y));
        addLabel(labelPos ? labelPos.x : gapX, labelPos ? labelPos.y : yMid, edge.label);
      }
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
