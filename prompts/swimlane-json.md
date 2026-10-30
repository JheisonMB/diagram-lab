<!--
Standalone prompt to generate a SWIMLANE diagram as JSON (Diagram Lab's own engine,
not Mermaid). The example is the same one persisted in examples/swimlane.json
(keep both in sync).
-->

<role>
You generate technical swimlane diagrams in JSON, for a bespoke "diagram as code" tool (not Mermaid), able to represent processes with parallel branches and cross connections between non-adjacent lanes.
</role>

<style_guidelines>
- Technical "blueprint" palette: no saturated colors, gradients, shadows, or decorative stock icons.
- If the diagram needs to distinguish categories (new/modified/reused/global, or similar), use this fixed semantic palette (only the entries actually used):
  - New      -> border #7a9b7f (sage green)
  - Modified -> border #5c8aa6 (blue)
  - Reused   -> border #b89a52 (ochre)
  - Global   -> border #8077a8 (violet)
  Fills always white or very light tints of that border color (never the saturated color as a fill).
- No emojis inside diagram boxes. Short, precise text (real system, step, or entity names, not generic placeholders).
- Keep connection labels to 2-4 words.
</style_guidelines>

<json_schema>
The JSON format (NOT Mermaid) that this tool interprets is:
```json
{
  "title": "TITLE IN UPPERCASE",
  "legend": [
    { "key": "new", "label": "New", "fill": "#ffffff", "border": "#7a9b7f" },
    { "key": "modified", "label": "Modified", "fill": "#ffffff", "border": "#5c8aa6" },
    { "key": "reused", "label": "Reused", "fill": "#ffffff", "border": "#b89a52" },
    { "key": "global", "label": "Global", "fill": "#ffffff", "border": "#8077a8" },
    { "key": "event", "label": "Event / Process end", "fill": "#fff3b0", "border": "#c9960c", "fullFill": true }
  ],
  "lanes": [
    {
      "title": "1. Lane name",
      "items": [
        {
          "key": "unique_id",
          "id": "1.1",
          "icon": "lucide icon name in kebab-case (e.g. settings, database, server, link, shield, credit-card, bell, zap)",
          "title": "Step name",
          "desc": "Short one-line description",
          "style": "new | modified | reused | global | event",
          "row": 0,
          "standalone": false,
          "children": [
            { "key": "unique_child_id", "id": "1.2a", "icon": "...", "title": "...", "desc": "...", "style": "..." }
          ]
        }
      ]
    }
  ],
  "connections": [
    { "from": "unique_source_id", "to": "unique_target_id", "style": "solid | dashed", "bidirectional": false, "label": "2-4 words max" }
  ]
}
```
Interpretation rules (important, not optional):
- Every item must declare a unique "key" (used to reference it from "children" or "connections").
- Automatic chaining: each item connects only to the NEXT item in its own lane (simple downward arrow) — don't declare this connection manually, it's automatic. To stop an item from receiving that automatic arrow (because it's reached another way, e.g. a cross connection), mark it with `"standalone": true`.
- Branching ("children"): if an item opens several parallel paths within the same lane (e.g. several simultaneous validations), declare them as its "children" array (same fields as an item). They stack vertically inside the lane, with a rail connector on the left that leaves the parent and rejoins toward the next item in the lane. Do NOT use "connections" for this.
- "row" (optional integer, 0-based): fixes the row of the grid shared by all lanes. This aligns steps from the same moment of the process horizontally across lanes. If omitted, the next free row in the lane is used. Keep "row" values increasing along the chronological flow so cross-lane steps align.
- When an item has "children", those children occupy the row directly below it. The next item in the same lane must therefore use a row at least 2 higher (e.g. parent at row 2, children at row 3, next item at row 4). Items in other lanes may share those rows.
- "connections" is for relationships between lanes (adjacent or not) or additional relationships (dependencies, permissions, events). Don't repeat the automatic chaining. They're routed through the gaps between columns: a local elbow between adjacent lanes when there's room; otherwise separate rails below the whole grid, before the legend.
- Keep connection labels to 2-4 words. The engine keeps them clear of lines and boxes; don't add empty rows to make room for them.
- Use "style": "event" (solid yellow fill) only for the node that represents the end of a process or a relevant business event.
- "icon" uses Lucide (lucide.dev) icon names in kebab-case.
- Include in "legend" only the entries actually used in the diagram, with the exact hex codes above.
- If the conversation context does not specify whether steps are new, modified, or reused, default regular steps to "style": "new" (or "reused" for existing external systems) and the final milestone to "style": "event".
</json_schema>

<example>
```json
{
  "title": "PAYMENT PROCESSING AND FRAUD CHECK",
  "legend": [
    { "key": "new", "label": "New", "fill": "#ffffff", "border": "#7a9b7f" },
    { "key": "modified", "label": "Modified", "fill": "#ffffff", "border": "#5c8aa6" },
    { "key": "reused", "label": "Reused", "fill": "#ffffff", "border": "#b89a52" },
    { "key": "global", "label": "Global", "fill": "#ffffff", "border": "#8077a8" },
    { "key": "event", "label": "Event / Process end", "fill": "#fff3b0", "border": "#c9960c", "fullFill": true }
  ],
  "lanes": [
    {
      "title": "1. API Gateway",
      "items": [
        { "key": "gw_req", "id": "1.1", "icon": "link", "title": "Receive checkout", "desc": "POST /v1/payments request", "style": "reused", "row": 0 },
        { "key": "gw_auth", "id": "1.2", "icon": "shield", "title": "Validate token", "desc": "Verify JWT and scopes", "style": "global", "row": 1 }
      ]
    },
    {
      "title": "2. Payment Orchestrator",
      "items": [
        { "key": "orch_init", "id": "2.1", "icon": "server", "title": "Init transaction", "desc": "Create pending record", "style": "modified", "row": 1, "standalone": true },
        {
          "key": "orch_checks", "id": "2.2", "icon": "shuffle", "title": "Pre-auth checks", "desc": "Run parallel verifications", "style": "new", "row": 2,
          "children": [
            { "key": "chk_balance", "id": "2.2a", "icon": "credit-card", "title": "Check funds", "desc": "Verify wallet balance", "style": "reused" },
            { "key": "chk_limits", "id": "2.2b", "icon": "settings", "title": "Daily limits", "desc": "Validate user thresholds", "style": "new" }
          ]
        },
        { "key": "orch_capture", "id": "2.3", "icon": "credit-card", "title": "Capture funds", "desc": "Commit payment charge", "style": "modified", "row": 4 },
        { "key": "orch_done", "id": "2.4", "icon": "zap", "title": "Payment completed", "desc": "Emit OrderPaid event", "style": "event", "row": 5 }
      ]
    },
    {
      "title": "3. Fraud Engine",
      "items": [
        { "key": "fraud_eval", "id": "3.1", "icon": "shield", "title": "Risk scoring", "desc": "ML model evaluation", "style": "new", "row": 3, "standalone": true }
      ]
    },
    {
      "title": "4. Ledger & Notifications",
      "items": [
        { "key": "led_save", "id": "4.1", "icon": "database", "title": "Append ledger", "desc": "Write immutable entry", "style": "reused", "row": 4, "standalone": true },
        { "key": "notif_send", "id": "4.2", "icon": "bell", "title": "Send receipt", "desc": "Dispatch email to user", "style": "reused", "row": 5, "standalone": true }
      ]
    }
  ],
  "connections": [
    { "from": "gw_auth", "to": "orch_init", "style": "solid", "label": "Forward request" },
    { "from": "orch_checks", "to": "fraud_eval", "style": "dashed", "bidirectional": true, "label": "Sync risk check" },
    { "from": "orch_capture", "to": "led_save", "style": "solid", "label": "Record entry" },
    { "from": "orch_done", "to": "notif_send", "style": "dashed", "label": "Async event" }
  ]
}
```
</example>

<before_generating>
1. Gather context from <task> AND the preceding conversation (and any attached files). Use what is already there; do not ask for information that is already in it.
2. Infer minor visual/process omissions with sensible defaults (appropriate Lucide icons, concise 1-line descriptions, and "reused" or "new" styles when unspecified) instead of stopping. Do not invent extra steps or lanes just to fill space.
3. Stop and ask only if core process logic is missing or contradictory and cannot be deduced from context (which steps belong to which lane, whether steps run in parallel or sequence, cross-lane triggers, or where the process ends). Then ask at most 3 short, specific questions in the user's language, naming the gap (e.g. "does the fraud check run in parallel with capture, or before it?"). Do not ask generic questions like "can you clarify?". Otherwise, generate the diagram immediately.
</before_generating>

<task>
Generate the swimlane JSON representing the following process, split by phase/system (keep lane titles to 2-4 words).
If the placeholder below is left unedited or incomplete, extract the lanes, steps, branches, and cross-lane relationships from the preceding conversation or attached files instead.
[DESCRIBE THE LANES IN ORDER, THE STEPS WITHIN EACH ONE, WHETHER ANY STEP BRANCHES INTO SEVERAL PARALLEL PATHS, THE CROSS RELATIONSHIPS BETWEEN NON-ADJACENT LANES (permissions, queries, events), AND WHETHER EACH STEP IS "new", "modified", "reused", "global", OR an "event" marking the end of the process]
</task>

<output_format>
For THIS specific response only:
- If step 3 of <before_generating> applies, reply with ONLY your targeted questions (max 3), in plain text, in the user's language. No code.
- Otherwise, reply with ONLY one ```json code block, with no explanation before or after, ready to paste into Diagram Lab's editor.
</output_format>
