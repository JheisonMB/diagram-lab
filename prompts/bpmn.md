<!--
Standalone prompt to generate simplified BPMN as Diagram Lab JSON (kind: "bpmn").
The example is the same one persisted in examples/bpmn.json (keep both in sync).
-->

<role>
You model business processes in simplified BPMN, generating the JSON that Diagram Lab's own engine interprets (NOT Mermaid).
</role>

<style_guidelines>
- No emojis inside boxes. Short, precise names for systems and steps (no generic placeholders).
- Keep lane titles and connection labels to 2-4 words.
</style_guidelines>

<json_schema>
```json
{
  "kind": "bpmn",
  "title": "PROCESS TITLE",
  "lanes": [
    {
      "title": "Responsible party / pool",
      "items": [
        { "key": "unique_id", "type": "start | end | task | gateway", "id": "1", "icon": "kebab-case-lucide", "title": "Short text", "desc": "Optional one-line detail", "row": 0, "standalone": false },
        { "key": "g1", "type": "gateway", "title": "Question?", "row": 4, "branches": [ { "label": "Yes", "to": "target_key" }, { "label": "No", "to": "other_key" } ] }
      ]
    }
  ],
  "connections": [
    { "from": "key_a", "to": "key_b", "style": "solid | dashed", "label": "optional" }
  ]
}
```
Interpretation rules (important):
- "kind" must be exactly "bpmn". Without it, the tool treats the JSON as a swimlane.
- type: "start" and "end" = event circles; "task" = rounded rectangle; "gateway" = decision diamond.
- Every item needs a unique "key". "id" is optional (task numbering, e.g. "1", "4b").
- "row" (integer, 0-based): row shared by all lanes. Steps at the same point in the process share a row; the flow must advance toward higher rows. Set "layout": "compact" to pack each lane from the top instead (ignores "row").
- Automatic chaining: each "start" or "task" item connects to the next item in its own lane, unless that next item has "standalone": true. "gateway" and "end" items NEVER auto-chain to the next item in the lane: a gateway's "branches" are explicit.
- "standalone": true cuts the automatic incoming arrow from the previous item in the lane. Use it on an item that is reached only through a branch or an explicit connection. The first item of a lane has no previous item in its lane, so it never needs it.
- "branches" (gateway only): each branch points via "to" to an item's key, which may live in another lane. Use short labels (Yes/No).
- Keep titles short. Don't add empty rows or coordinates to make room for labels.
- "connections": flows between lanes (including adjacent ones) or message flows. "style": "dashed" = message flow between responsible parties; "solid" = sequence flow. Never declare a connection that automatic chaining already produces (the next item in the same lane).
- Keep connection labels to 2-4 words. The engine routes and labels the connections; don't add coordinates to the JSON.
- Every branch must reach an end event or converge into another step; never leave a branch dangling.
- "icon" uses Lucide (lucide.dev) icon names in kebab-case.
</json_schema>

<example>
```json
{
  "kind": "bpmn",
  "title": "PAYMENT CLAIM (BPMN process)",
  "lanes": [
    {
      "title": "Customer",
      "items": [
        { "key": "e1", "type": "start", "title": "Start: claim", "row": 0 },
        { "key": "t1", "type": "task", "id": "1", "icon": "smartphone", "title": "Submit claim", "desc": "Via the bank's app", "row": 1 },
        { "key": "e3", "type": "end", "title": "Customer notified", "row": 7, "standalone": true }
      ]
    },
    {
      "title": "Digital Channel",
      "items": [
        { "key": "t2", "type": "task", "id": "2", "icon": "user-check", "title": "Verify identity", "desc": "Customer authentication", "row": 2 },
        { "key": "t3", "type": "task", "id": "3", "icon": "file-plus", "title": "Create case", "desc": "Registers the claim case", "row": 3 }
      ]
    },
    {
      "title": "Payments Back Office",
      "items": [
        {
          "key": "g1", "type": "gateway", "title": "Amount > threshold?", "row": 4,
          "branches": [{ "label": "Yes", "to": "t5" }, { "label": "No", "to": "t4" }]
        },
        { "key": "t5", "type": "task", "id": "4", "icon": "user-round-search", "title": "Manual review", "desc": "Analyst validates the case", "row": 5 },
        { "key": "t6", "type": "task", "id": "5", "icon": "file-check", "title": "Generate resolution", "desc": "Issues the case resolution", "row": 6 }
      ]
    },
    {
      "title": "Automated Rules",
      "items": [
        { "key": "t4", "type": "task", "id": "4b", "icon": "cpu", "title": "Automated review", "desc": "Payments rules engine", "row": 5 }
      ]
    },
    {
      "title": "Core System",
      "items": [
        { "key": "t7", "type": "task", "id": "6", "icon": "database", "title": "Update account", "desc": "Impacts account status", "row": 7 },
        { "key": "e2", "type": "end", "title": "Claim resolved", "row": 8 }
      ]
    }
  ],
  "connections": [
    { "from": "t1", "to": "t2", "style": "solid" },
    { "from": "t3", "to": "g1", "style": "solid" },
    { "from": "t4", "to": "t6", "style": "solid" },
    { "from": "t6", "to": "t7", "style": "solid" },
    { "from": "t6", "to": "e3", "style": "dashed", "label": "Notification" }
  ]
}
```
</example>

<before_generating>
1. Gather context from <task> AND the preceding conversation (and any attached files). Use what is already there; do not ask for information that is already in it.
2. Infer minor process omissions with sensible defaults (appropriate Lucide icons, concise 1-line descriptions, start/end labels, and solid sequence vs. dashed message styles) instead of stopping. Do not invent extra business steps or lanes just to fill space.
3. Stop and ask only if core business logic is missing or contradictory and cannot be deduced from context (who is responsible for key steps, missing Yes/No branches on decisions, or how the process ends). Then ask at most 3 short, specific questions in the user's language, naming the gap (e.g. "does a rejected review end the claim, or return it to the customer?"). Do not ask generic questions like "can you clarify?". Otherwise, generate the diagram immediately.
</before_generating>

<task>
Generate the BPMN JSON for the following business process, split by responsible party (lane).
If the placeholder below is left unedited or incomplete, extract the responsible parties, tasks, decisions, and messages from the preceding conversation or attached files instead.
[DESCRIBE THE RESPONSIBLE PARTIES, THE TASKS IN ORDER, THE DECISIONS (with their Yes/No branches), THE START/END EVENTS, AND THE MESSAGES BETWEEN RESPONSIBLE PARTIES]
</task>

<output_format>
For THIS specific response only:
- If step 3 of <before_generating> applies, reply with ONLY your targeted questions (max 3), in plain text, in the user's language. No code.
- Otherwise, reply with ONLY one ```json code block, with no explanation before or after, ready to paste into Diagram Lab's editor.
</output_format>
