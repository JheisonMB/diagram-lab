(async function () {
  const surface = document.getElementById('preview-surface');
  const pane = document.querySelector('.preview-pane');
  const results = document.getElementById('results');
  const passed = [];
  function assert(condition, message) {
    if (!condition) throw new Error(message);
    passed.push(message);
  }
  const overlap = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 &&
    a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;

  function checkLanes(name) {
    const labels = Array.from(surface.querySelectorAll('.conn-label, .bpmn-caption'));
    const obstacles = Array.from(surface.querySelectorAll('.conn-seg, .conn-arrow, .box'));
    labels.forEach((label, index) => {
      const rect = label.getBoundingClientRect();
      assert(!obstacles.some((el) => overlap(rect, el.getBoundingClientRect())),
        `${name}: "${label.textContent}" does not collide with lines, arrows, or boxes`);
      assert(!labels.slice(index + 1).some((el) => overlap(rect, el.getBoundingClientRect())),
        `${name}: "${label.textContent}" does not collide with other labels`);
    });
    const legend = surface.querySelector('.legend-row').getBoundingClientRect();
    assert(obstacles.concat(labels).every((el) => el.getBoundingClientRect().bottom + 8 < legend.top),
      `${name}: legend separated from content`);
    const wrap = surface.querySelector('.grid-wrap');
    const height = wrap.getBoundingClientRect().height;
    for (let i = 0; i < 3; i++) surface.redrawConnectors();
    assert(Math.abs(wrap.getBoundingClientRect().height - height) < 0.5,
      `${name}: three redraws keep height and padding stable`);
  }

  try {
    await document.fonts.ready;
    for (const name of ['swimlane', 'bpmn']) {
      for (const width of [1440, 800]) {
        pane.style.width = width + 'px';
        const render = name === 'bpmn' ? DL.renderBpmn : DL.renderSwimlane;
        render(DL_EXAMPLES[name], surface);
        surface.redrawConnectors();
        checkLanes(`${name} / ${width}px`);
        if (width === 1440) {
          const canvas = await DL.exportCanvas(surface, name, 1);
          assert(canvas.height >= Math.floor(surface.getBoundingClientRect().height),
            `${name}: PNG export includes rails and legend`);
        }
      }
    }

    DL.renderSwimlane(JSON.stringify({
      lanes: [
        { title: 'Source', items: [{ key: 'a', title: 'Send' }] },
        { title: 'Destination', items: [{ key: 'b', title: 'Receive' }] }
      ],
      connections: [{ from: 'a', to: 'b', label: 'Request', bidirectional: true }]
    }), surface);
    surface.redrawConnectors();
    checkLanes('two lanes / labeled connection at the same level');
    DL.renderSwimlane(JSON.stringify({
      layout: 'aligned',
      lanes: [
        { title: 'Left', items: [{ key: 'a1', title: 'A1', row: 0 }, { key: 'a2', title: 'A2', row: 1 }] },
        { title: 'Right', items: [{ key: 'b1', title: 'B1', row: 0 }, { key: 'b2', title: 'B2', row: 1 }, { key: 'b3', title: 'B3', row: 2 }, { key: 'b4', title: 'B4', row: 3 }] }
      ],
      connections: [
        { from: 'b2', to: 'a1', label: 'Query topic repos' },
        { from: 'b3', to: 'a2', label: 'Fetch documents' }
      ]
    }), surface);
    surface.redrawConnectors();
    checkLanes('shared gutter / two labeled connections keep labels apart');
    DL.renderSwimlane(JSON.stringify({
      lanes: [{ title: 'Local', items: [{ key: 'a', title: 'Start' }, { key: 'b', title: 'End' }] }]
    }), surface);
    surface.redrawConnectors();
    assert(surface.querySelector('.grid-wrap').style.paddingBottom === '',
      'No buses: no leftover padding from a previous diagram');

    const compactCfg = {
      lanes: [
        { title: 'Early', items: [{ key: 'a', title: 'First', row: 0 }, { key: 'b', title: 'Second', row: 1 }] },
        { title: 'Late', items: [{ key: 'c', title: 'Only', row: 6, standalone: true }] }
      ],
      connections: [{ from: 'b', to: 'c', label: 'Handoff' }]
    };
    DL.renderSwimlane(JSON.stringify(compactCfg), surface);
    surface.redrawConnectors();
    assert(surface.querySelector('[data-key="c"]').style.gridRow === '2',
      'Compact: lane starting at row 6 packs its first box on the first grid row');
    const lateLaneTop = surface.querySelector('.lane[data-lane="1"]').getBoundingClientRect().top;
    const lateBoxTop = surface.querySelector('[data-key="c"]').getBoundingClientRect().top;
    assert(lateBoxTop - lateLaneTop < 100,
      'Compact: no leading whitespace above the packed lane');
    DL.renderSwimlane(JSON.stringify({ layout: 'aligned', ...compactCfg }), surface);
    surface.redrawConnectors();
    assert(surface.querySelector('[data-key="c"]').style.gridRow === '8',
      'Aligned: explicit rows keep the shared grid when opted in');

    pane.style.width = '1440px';
    await DL.renderMermaid(DL_EXAMPLES.architecture, surface, pane);
    assert(!surface.querySelector('.error-box'), 'Architecture: valid syntax');
    const svg = surface.querySelector('svg');
    const groups = Array.from(svg.querySelectorAll('.architecture-groups > rect'));
    assert(groups.length === 3, 'Architecture: keeps the three groups');
    const bounds = groups.map((el) => el.getBoundingClientRect());
    assert(bounds.slice(1).every((r, i) => r.left - bounds[i].right > 24),
      'Architecture: groups separated by more than 24px');
    ['web', 'lb', 'api', 'db'].forEach((key, index) => {
      const label = svg.querySelector(`[id$="-service-${key}"] > g:first-child`).getBoundingClientRect();
      const group = bounds[Math.min(index, 2)];
      assert(label.left >= group.left && label.right <= group.right && label.bottom < group.bottom,
        `Architecture: ${key} title contained within its group`);
    });
    const canvas = await DL.exportCanvas(surface, 'mermaid', 1);
    assert(canvas.width > 200 && canvas.height > 100, 'Architecture: valid SVG-to-PNG export');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    assert(pixels.some((value, i) => i % 4 !== 3 && value < 150), 'Architecture: PNG is not empty');

    await DL.renderMermaid('architecture-beta\nservice a(server)[A]\nservice b(server)[B]\na:R -[SFTP]-> L:b', surface, pane);
    assert(!surface.querySelector('.error-box') && surface.querySelector('.architecture-edges').textContent.includes('SFTP'),
      'Mermaid v12: confirms real support for -[text]-> labels');
    for (const name of ['sequence', 'er', 'classDiagram']) {
      await DL.renderMermaid(DL_EXAMPLES[name], surface, pane);
      assert(!surface.querySelector('.error-box'), `${name}: renders with no regressions`);
    }
    assert(['architecture', 'swimlane', 'bpmn'].every((name) => DL_PROMPTS[name]),
      'Prompts for all three engines available');
    results.dataset.status = 'pass';
    results.textContent = `PASS (${passed.length})\n` + passed.join('\n');
  } catch (error) {
    results.dataset.status = 'fail';
    results.textContent = `FAIL: ${error.message}\n` + passed.join('\n');
  }
})();
