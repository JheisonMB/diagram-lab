# Diagram Lab

Static tool (no backend, no build, no install) for generating "diagram as
code" from text that any LLM (ChatGPT, Gemini, Copilot) can produce. Built
for teams where not everyone has access to agentic tools: just open
`index.html` with a double click.

## How to use it

1. Open `index.html` in the browser (Edge/Chrome).
2. Paste **Mermaid** code (flowchart, sequence, ER, etc.) or **JSON**
   (technical swimlane diagram) into the editor on the left.
3. The app automatically detects the content type and renders it with the
   right engine (the badge at the top shows the detected mode).
4. Use the header controls as needed:
   - **Example selector**: loads a sample diagram of each type.
   - ✨ **Copy prompt** (header): copies the XML-tagged prompt that asks an
     LLM to generate that same diagram type in this format.
   - **Copy code** (below the editor): copies the source text (Mermaid or
     JSON) to version it in a repo.
   - **Clear** (next to it): empties the editor and the preview.
   - **Floating controls** (top-right of the preview, they stay in place
     while the diagram scrolls):
     - ⬇ **Save PNG** downloads the diagram as a file (white background).
     - 🖼 **Copy image** copies it to the clipboard, to paste with `Ctrl+V`
       directly into Google Docs/Slides.
     - Zoom in / zoom level / zoom out / fit to screen. Zoom doesn't affect
       the exported PNG, which is always generated at real size.

Successful actions briefly swap the button icon for a checkmark.

You can also drag an `.mmd` or `.json` file directly onto the editor panel
(the [`examples/`](examples/) folder has a sample for each diagram type, and the
same example is referenced by each prompt in `prompts/`).

## Which engine to use for each diagram type

| I want to represent... | Use... | Why |
|---|---|---|
| Interaction between systems over time | Mermaid `sequenceDiagram` | Standard, no manual layout |
| Data model (entity-relationship, with attributes and keys) | Mermaid `erDiagram` | Mermaid resolves it well natively |
| Object-oriented design (classes) | Mermaid `classDiagram` | Native support for inheritance/association |
| Business process by owner, with events/decisions (BPMN) | **Custom JSON** (this tool, `kind: "bpmn"`) | Real BPMN shapes (start/end circle, gateway diamond with Yes/No branches, rounded task) and dashed message flows; Mermaid has no native BPMN |
| Source → processing → destination architecture (groups, services with IP/port/protocol) | Mermaid `architecture-beta` | Native syntax for groups, services, and L/R/T/B port connections |
| Technical swimlane with parallel branches and cross connections | **Custom JSON** (this tool, swimlane mode) | Full control over style/icons/colors, designed for Google Docs |

> **Note on `architecture-beta` (Mermaid v12)**: it doesn't support
> `classDef`; the five built-in icons have their own colors, independent of
> the theme. Version 12.2 does support labels (`a:R -[text]-> L:b`), though
> here IP/protocol/port are kept on the service itself to keep the flow
> clean. The example keeps Source, Processing and Destination: it uses
> `align row`, `idealEdgeLengthMultiplier: 4`, `iconSize: 96` and
> `padding: 48` in the frontmatter to separate groups and fit two-line
> titles. Borders and arrows are smoothed with `themeCSS` embedded in the
> SVG (also when exporting it).
>
> There's no direct margin option between groups: the spring between
> group connections uses a fixed length relative to the icon;
> `nodeSeparation` affects siblings, and increasing padding widens the
> borders but doesn't guarantee separation between groups. Explicit
> alignment adds distance constraints. See the
> [official configuration](https://mermaid.js.org/syntax/architecture.html#layout-tuning-v11-15-0)
> and the [v12.2 renderer](https://github.com/mermaid-js/mermaid/blob/mermaid%4012.2.0/packages/mermaid/src/diagrams/architecture/architectureRenderer.ts).


## PNG export: why two different paths

`js/export.js` picks the rasterization strategy based on the detected mode:

- **Mermaid** (`svgToCanvas`): serializes the rendered `<svg>`, loads it
  into an `<img>`, and draws it onto a `<canvas>`. Rasterizing this way (and
  not with `html2canvas`) is necessary because Mermaid (since v10) draws
  text labels with `<foreignObject>` inside the SVG, and **html2canvas does
  not support `<foreignObject>`** — the result came out with broken,
  clipped, or missing text.
- **Swimlane JSON** (`html2canvas`): it's plain HTML/CSS (no SVG), so
  `html2canvas` captures it without issues.

Both paths return a `<canvas>` with a white background, ready for
`canvas.toBlob()` (download or `navigator.clipboard.write`).

## Verification without installing anything

Open `tests/layout.html` with a double click. It uses the same classic
scripts and CDNs as the app: it checks label/caption collisions, group
separation, redraws, legends, and PNG export, plus rendering the other
Mermaid examples. It should show `PASS`; no Node, build, or server needed.
Review screenshots are taken with headless Chrome against `index.html`
(`?example=architecture&bare=1`, `swimlane`, or `bpmn`).

## Interface: "light VSCode" look + transparent canvas

- The code editor has **line numbers** synced with scroll, **JetBrains
  Mono** font (via Google Fonts, falling back to Consolas/system
  monospace), and a light VSCode-style palette (white background, `#1e1e1e`
  text, blue selection `#add6ff`).
- The preview panel has a **"transparent canvas"**-style background
  (checkerboard pattern, like in design tools) so the diagram reads as a
  floating layer — this is only a visual aid for the panel; the exported
  PNG always has a solid white background.
- **Zoom** controls (in/out/reset) to the right of the preview, applied
  with `transform: scale()` on `#preview-surface`, independent of
  Mermaid's own auto-fit (`fitSvgToPane`).
- Minimalist header, no corporate logo (just the tool's name).

## Why two rendering engines

- **Mermaid**: ideal for sequence, ER, class, architecture-beta, and
  architecture/BPMN flowcharts. Natively understood by GitHub/GitLab/VS
  Code/ChatGPT/Gemini (and mermaid.live). But its layout engine (dagre)
  **doesn't handle hand-built column (swimlane) diagrams well with
  `flowchart`+`subgraph`** when arrows cross between subgraphs whose
  internal direction differs from the overall one: the internal direction
  gets ignored and the diagram flattens out. That's why real-lane swimlanes
  are solved with the custom JSON engine below, not `flowchart`+`subgraph`.
- **Swimlane JSON**: for cases where, besides lane layout, a 100%
  controlled look is needed (icons, category colors, legend, parallel
  branches, dashed/bidirectional labeled cross connections), a layout
  driven by CSS Grid/Flexbox from a declarative JSON config is used. With
  no generic auto-layout engine in the way, there are no positioning
  surprises, and the style stays 100% under our control for documents
  (Google Docs, presentations).

### Connector routing in the swimlane JSON

- **Automatic chaining** ("direct"): each item connects only to the next
  item in its own lane (simple vertical arrow), unless the next item is
  marked `"standalone": true`. If an item declares `"children"`, it fans
  out to each child and fans back in from each child to the next item in
  the lane — useful for representing parallel paths (e.g. several
  simultaneous validations).
- **Explicit connections** ("bus", `cfg.connections`, can skip
  non-adjacent lanes, be dashed, bidirectional, and carry a label) are
  **always routed through the gaps between columns** (never through the
  body of a lane): they exit the source box through its side edge toward
  the nearest gap, drop down through that gap to a horizontal rail below
  the whole grid, travel along the rail, rise through the destination
  gap, and enter the destination box through its side edge. This
  guarantees the line never crosses or overlaps the text of any
  intermediate box, regardless of its vertical position within its column.
- Adjacent connections use a local elbow if they carry no label, or if the
  label fits next to the elbow. The rest get their own rails spaced 34px
  apart; when a labeled connection shares a single gap, another free
  port/gap is used so the rail doesn't collapse into a dangling stem.
  Labels are placed last, on a white background, away from the rail and
  avoiding lines/boxes; real space is reserved before the legend.
- In BPMN, extra space is reserved below events and gateways; the
  sequential flow routes around their captions, and short branches are
  labeled next to the vertical segment, away from the arrowheads. The JSON
  schema doesn't change.

## Unified visual palette ("blueprint")

All rendering engines (Mermaid and the swimlane JSON) share the same
semantic palette, so any diagram looks consistent with the rest:

| Category | Border | Use |
|---|---|---|
| New | `#7a9b7f` (sage green) | Component/step built from scratch |
| Modified | `#5c8aa6` (blue) | Existing component/step that gets modified |
| Re-used | `#b89a52` (ochre) | Existing component/step, unchanged |
| Global | `#8077a8` (violet) | Component/step shared across projects/teams |

Always a white/light background, navy text (`#1a1a2e`), medium navy
structural borders (`#2b4a8b`), Segoe UI typography. This is fixed in
`mermaid.initialize({ theme: 'base', themeVariables: {...} })` (file
`js/mermaid-renderer.js`) and in the `fill`/`border` values of the swimlane
JSON — so Mermaid v12 (which, from that version on, changes the default
theme of several diagram types to `redux-color`) still respects our own
palette.

## Prompts for generating diagrams

Each diagram type has a prompt (XML-tag technique: `<role>`,
`<style_guidelines>`, `<task>`, `<output_format>`) that tells an LLM how to
produce code in this tool's same "blueprint" style. Two ways to use them:

1. **From the tool itself**: pick an example in the selector and click
   **"Copy prompt"** — copies to the clipboard the prompt matching the
   loaded diagram type (source: `js/prompts.js`, `DL_PROMPTS` object).
2. **Without access to the tool** (just a web chat, no Copilot/agentic
   tools): open the matching file in the [`prompts/`](prompts/) folder —
   these are self-contained `.md` files, ready to copy-paste directly into
   ChatGPT, Gemini, etc.

| Diagram type | File in `prompts/` |
|---|---|
| Sequence (always with `autonumber`) | `prompts/sequence.md` |
| Entity-Relationship (`direction LR`, with attributes/keys) | `prompts/er.md` |
| Class diagram | `prompts/class-diagram.md` |
| Source → processing → destination architecture (architecture-beta) | `prompts/architecture.md` |
| Swimlane JSON (rows, stacked branches, cross connections) | `prompts/swimlane-json.md` |
| BPMN JSON process (`kind: "bpmn"`) | `prompts/bpmn.md` |

Each prompt includes a `[DESCRIBE ...]` placeholder inside `<task>`. You can
replace it with the content you want to diagram, or leave it as-is: the model
then uses the preceding conversation (or attached files) as context. Prompts
ask for a single code block per response and only ask clarifying questions
when core business logic is missing (no guessing of standard technical
details such as ports or attribute types).

## External libraries (via CDN, nothing to install)

- [mermaid](https://mermaid.js.org/) — renders Mermaid diagrams, pinned to
  `@12` (latest stable major at the time of writing: 12.2.0).
- [html2canvas](https://html2canvas.hertzen.com/) — PNG export for the
  swimlane JSON (plain HTML/CSS). For Mermaid, native SVG rasterization is
  used instead (see [`js/export.js`](js/export.js)), since html2canvas
  doesn't support `<foreignObject>`.
- [lucide](https://lucide.dev/) — clean line icons for the swimlane boxes
  and the UI buttons (`data-lucide="icon-name"`).
- [Google Fonts — JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) —
  monospace font for the code editor.

They require an internet connection the first time (then get cached). If
your corporate network blocks external CDNs, you can download the `.js`
files and reference them locally in `index.html` without changing the rest
of the code.

## Swimlane JSON format

```json
{
  "title": "DIAGRAM TITLE",
  "legend": [
    { "key": "new", "label": "New", "fill": "#ffffff", "border": "#7a9b7f" },
    { "key": "event", "label": "Event / End of process", "fill": "#fff3b0", "border": "#c9960c", "fullFill": true }
  ],
  "lanes": [
    {
      "title": "1. Stage name",
      "items": [
        {
          "key": "unique_id",
          "id": "1.1",
          "icon": "settings",
          "title": "Step name",
          "desc": "Short description",
          "style": "new",
          "standalone": false,
          "children": [
            { "key": "child_1", "id": "1.2a", "icon": "shield-check", "title": "Parallel path 1", "desc": "...", "style": "new" }
          ]
        }
      ]
    }
  ],
  "connections": [
    { "from": "source_key", "to": "target_key", "style": "dashed", "bidirectional": true, "label": "Read permissions" }
  ]
}
```

- `style` references a `legend` `key` (color of the left stripe, or full
  solid background if that `legend` entry has `"fullFill": true` — meant
  for event/end-of-process nodes).
- `icon` is the name of an icon from [lucide.dev/icons](https://lucide.dev/icons) (e.g. `settings`, `database`, `file-text`, `credit-card`, `shield-check`, `bell`, `zap`).
- `key` (optional but recommended): stable item identifier, used by
  `children` and `connections` to reference it. If not set, it is
  auto-generated as `auto_{lane}_{item}`.
- Each item **automatically chains** to the next item in its own lane
  (simple downward arrow); to suppress that automatic arrow (because the
  item receives its flow from elsewhere, e.g. a cross connection), mark it
  with `"standalone": true`.
- `children` (optional, inside an item): array of items with the same
  shape, declared as parallel branches. They stack vertically below the
  parent, on a rail to the left of the lane, and connect in a fan-out from
  the parent and a fan-in toward the next item in the lane — no need to
  declare `connections` for that.
- `layout` (optional, `"compact"` by default or `"aligned"`): compact
  packs each lane from the top, ignoring `row`; aligned uses one grid
  shared across all lanes.
- `row` (optional integer, 0-based; only used with `"layout": "aligned"`):
  row of the shared grid. Items in different lanes with the same `row`
  end up aligned horizontally. If omitted, the next free row in the lane
  is used.
- `connections` (optional, at the JSON root level): list of explicit
  connections that can skip non-adjacent lanes. `style` accepts `"solid"`
  (default) or `"dashed"`; `bidirectional` adds an arrowhead at both ends;
  `label` is optional. They are always routed through the gaps between
  columns (never through other boxes), see the previous section.
- `connector` (`"out"/"in"/"both"`): legacy mechanism kept only for
  backward compatibility; use `connections` instead for new diagrams.

## BPMN JSON format

Distinguished from swimlane by `"kind": "bpmn"` at the JSON root (without
that field, any valid JSON is treated as swimlane). Rendered by
`js/bpmn-renderer.js`.

```json
{
  "kind": "bpmn",
  "title": "PROCESS TITLE",
  "legend": [
    { "key": "task", "label": "Task", "fill": "#ffffff", "border": "#7a9b7f" }
  ],
  "lanes": [
    {
      "title": "Customer",
      "items": [
        { "key": "start", "type": "start", "title": "Start: claim" },
        { "key": "review", "type": "task", "icon": "file-text", "title": "Review claim", "style": "task", "row": 1 },
        {
          "key": "decision", "type": "gateway", "title": "Approved?", "row": 2,
          "branches": [
            { "label": "Yes", "to": "pay" },
            { "label": "No", "to": "close" }
          ]
        }
      ]
    }
  ],
  "connections": [
    { "from": "review", "to": "decision", "style": "dashed", "label": "message" }
  ]
}
```

- `type`: `"start"` (simple circle), `"end"` (double-bordered circle),
  `"task"` (rounded rectangle), `"gateway"` (diamond).
- `branches` (only on `gateway`): explicit branches with `label` and `to`
  (destination key). They allow forking and converging without assuming
  linear order.
- Same as swimlane: automatic chaining within the lane (unless
  `"standalone": true`), `row` to align steps across lanes (or
  `"layout": "compact"` to pack each lane from the top), and
  `connections` for flows between lanes (`"dashed"` = message flow).
- `legend`, `icon`, and `style` work the same as in the swimlane.
