/**
 * prompts.js
 * Prompt library (XML-tag technique) to ask any LLM (ChatGPT, Gemini, Copilot
 * Chat web, etc. — no agentic tools) to generate diagram-as-code in the same
 * "blueprint" style as this tool.
 *
 * window.DL_PROMPTS: Record<string, string> — same keys as DL_EXAMPLES.
 * Each prompt is self-contained: copy-paste it into any chat, no dependency
 * on this repository. Section order is always:
 * role -> style/syntax -> example -> before_generating -> task -> output_format.
 */
window.DL_PROMPTS = (function () {
  const PALETTE_STYLE = `<style_guidelines>
- Technical "blueprint" palette: no saturated colors, gradients, shadows, or decorative stock icons.
- If the diagram needs to distinguish categories (new/modified/reused/global, or similar), use this fixed semantic palette (only the entries actually used):
  - New      -> border #7a9b7f (sage green)
  - Modified -> border #5c8aa6 (blue)
  - Reused   -> border #b89a52 (ochre)
  - Global   -> border #8077a8 (violet)
  Fills always white or very light tints of that border color (never the saturated color as a fill).
- No emojis inside diagram boxes. Short, precise text (real system, step, or entity names, not generic placeholders).
- Keep connection labels to 2-4 words.
</style_guidelines>`;

  const CONTEXT_NOTE = (what) =>
    `If the placeholder below is left unedited or incomplete, extract ${what} from the preceding conversation or attached files instead.`;

  const clarify = (infer, stopWhen, example) => `<before_generating>
1. Gather context from <task> AND the preceding conversation (and any attached files). Use what is already there; do not ask for information that is already in it.
2. ${infer}
3. Stop and ask only if ${stopWhen}. Then ask at most 3 short, specific questions in the user's language, naming the gap (e.g. ${example}). Do not ask generic questions like "can you clarify?". Otherwise, generate the diagram immediately.
</before_generating>`;

  const outputFormat = (lang) => `<output_format>
For THIS specific response only:
- If step 3 of <before_generating> applies, reply with ONLY your targeted questions (max 3), in plain text, in the user's language. No code.
- Otherwise, reply with ONLY one \`\`\`${lang} code block, with no explanation before or after, ready to paste into Diagram Lab's editor.
</output_format>`;

  const OUTPUT_MERMAID = outputFormat('mermaid');
  const OUTPUT_JSON = outputFormat('json');

  const fenced = (lang, code) => `\`\`\`${lang}\n${code}\n\`\`\``;

  const prompts = {};

  prompts.sequence = `<role>
You generate clean, technical Mermaid.js sequence diagrams.
</role>

<style_guidelines>
- No emojis. Short, precise participant names (real system names, not generic placeholders).
- Keep message labels concise (typically 2-5 words).
- Mermaid sequence diagrams have no per-participant color syntax: if a participant is new or reused, say so in its alias, e.g. \`participant API as API Gateway (New)\`.
</style_guidelines>

<syntax_rules>
- Write \`autonumber\` as the first line after \`sequenceDiagram\` (mandatory numbering, house style).
- Declare participants with short aliases: \`participant API as API Gateway\`.
- Do not use literal semicolons \`;\` inside message labels, as they break Mermaid sequence syntax (use \`#59;\` or a comma instead).
- Synchronous messages: \`A->>B: text\`; responses/async: \`B-->>A: text\`.
- Mark the activation lifespan of a participant with \`+\`/\`-\` on the message arrows
  (e.g. \`A->>+B: text\` to activate B, \`B-->>-A: text\` to deactivate it) when the
  activation and deactivation each happen exactly once, outside any \`alt\`/\`else\`
  branch.
- Model at least one alternative flow with \`alt condition ... else condition ... end\`
  (e.g. success vs. business-rule rejection) when the interaction has a decision point.
  Never put a \`+\`/\`-\` activation marker inside more than one branch of the same
  \`alt\` block for the same participant (Mermaid renders every branch in sequence, so
  deactivating twice fails with "trying to inactivate an inactive participant"); use
  plain arrows inside the branches and close any still-open activations with a
  standalone \`deactivate X\` line right after the matching \`end\`.
- If the flow contains nested \`alt\`/\`opt\`/\`loop\` blocks or multiple early returns, omit the \`+\`/\`-\` markers and any \`activate\`/\`deactivate\` lines for those participants entirely, to guarantee valid syntax.
- Use \`Note over A,B: text\` to annotate relevant events (e.g. "logged for audit").
- Use \`A->>A: text\` only for internal processing (self-loop), sparingly.
</syntax_rules>

<example>
${fenced('mermaid', DL_EXAMPLES.sequence)}
</example>

${clarify(
  'Infer minor interaction omissions with industry defaults (standard HTTP status responses like 200 OK / 4xx, obvious synchronous replies, and short participant aliases) instead of stopping. Do not invent extra actors or steps just to fill space.',
  'core interaction flow is missing or contradictory and cannot be deduced from context — such as missing participants, unclear message ordering, or undefined decision branches (`alt` conditions)',
  '"is the payment service call synchronous, or an async event?"'
)}

<task>
Generate a Mermaid "sequenceDiagram" representing the following interaction between systems/actors.
${CONTEXT_NOTE('the actors and their message order')}
[DESCRIBE THE ACTORS AND THE MESSAGE EXCHANGE, IN ORDER]
</task>

${OUTPUT_MERMAID}`;

  prompts.er = `<role>
You generate clean, technical Mermaid.js entity-relationship diagrams, with attributes and keys when the model requires them.
</role>

${PALETTE_STYLE}

<syntax_rules>
- Write \`direction LR\` as the first line after \`erDiagram\` so the diagram grows horizontally (document pages are wide, not tall).
- Relationship format: \`ENTITY_A ||--o{ ENTITY_B : relationship\` (adjust cardinality: ||, o|, }o, }|).
- Entity names in UPPERCASE, relationship names in lowercase snake_case.
- Declare each entity's relevant attributes inside braces, one per line, with type and name: \`ENTITY { type attribute_name }\`.
- Mark keys at the end of the attribute name: \`PK\` (primary key), \`FK\` (foreign key), \`UK\` (unique key). E.g.: \`string customer_id PK\`. An attribute that is both PK and FK is written with both markers separated by a comma: \`string user_id PK, FK\`.
- List no more than 4-6 attributes per entity (only what's relevant to understand the model); omit trivial audit attributes unless explicitly requested.
- Attribute types are one token: no spaces, commas, or parentheses. Strip SQL lengths and precisions: write \`varchar\` or \`string\`, never \`varchar(50)\`; write \`decimal\`, never \`numeric(10,2)\`.
- If a relationship label contains spaces, wrap it in double quotes (e.g. \`CUSTOMER ||--o{ ORDER : "places order"\`), or use single-word snake_case.
- If the description needs categories, declare one \`classDef\` per category with the border hex from <style_guidelines> and fill #ffffff (e.g. \`classDef new fill:#ffffff,stroke:#7a9b7f,stroke-width:2px\`), and apply it with \`class CUSTOMER new\`.
</syntax_rules>

<example>
${fenced('mermaid', DL_EXAMPLES.er)}
</example>

${clarify(
  'Infer minor data-model omissions with standard database defaults (attribute types such as string, int, decimal, or datetime, and obvious PK/FK naming conventions like `entity_id`) instead of stopping. Do not invent extra entities just to fill space.',
  'core relational logic is missing or contradictory and cannot be deduced from context — such as undefined cardinalities (1:1, 1:N, M:N) or unresolved many-to-many relationships',
  '"can an account have multiple cards, or only one?"'
)}

<task>
Generate a Mermaid "erDiagram" representing the following data model.
${CONTEXT_NOTE('the entities, attributes, and relationships')}
[DESCRIBE THE ENTITIES, THEIR MAIN ATTRIBUTES, AND THEIR RELATIONSHIPS / CARDINALITIES]
</task>

${OUTPUT_MERMAID}`;

  prompts.bpmn = `<role>
You model business processes in simplified BPMN, generating the JSON that Diagram Lab's own engine interprets (NOT Mermaid).
</role>

<style_guidelines>
- No emojis inside boxes. Short, precise names for systems and steps (no generic placeholders).
- Keep lane titles and connection labels to 2-4 words.
</style_guidelines>

<json_schema>
\`\`\`json
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
\`\`\`
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
${fenced('json', DL_EXAMPLES.bpmn)}
</example>

${clarify(
  'Infer minor process omissions with sensible defaults (appropriate Lucide icons, concise 1-line descriptions, start/end labels, and solid sequence vs. dashed message styles) instead of stopping. Do not invent extra business steps or lanes just to fill space.',
  'core business logic is missing or contradictory and cannot be deduced from context (who is responsible for key steps, missing Yes/No branches on decisions, or how the process ends)',
  '"does a rejected review end the claim, or return it to the customer?"'
)}

<task>
Generate the BPMN JSON for the following business process, split by responsible party (lane).
${CONTEXT_NOTE('the responsible parties, tasks, decisions, and messages')}
[DESCRIBE THE RESPONSIBLE PARTIES, THE TASKS IN ORDER, THE DECISIONS (with their Yes/No branches), THE START/END EVENTS, AND THE MESSAGES BETWEEN RESPONSIBLE PARTIES]
</task>

${OUTPUT_JSON}`;

  prompts.classDiagram = `<role>
You generate clean, technical Mermaid.js class diagrams, typical of software architecture documentation (COBOL/Java/service classes, DTOs, etc.).
</role>

${PALETTE_STYLE}

<syntax_rules>
- Add \`direction LR\` as the first line after \`classDiagram\` when the diagram is wider than tall; otherwise omit it.
- If a class name contains dashes (e.g. "CDVST001-01-CO"), declare it as \`class CDVST001_01_CO["CDVST001-01-CO"] { ... }\` (internal identifier without dashes, visible text in quotes).
- Attributes as \`-name: type\`, methods as \`+method(param: type) returnType\`.
- Generic types use tildes, not angle brackets: \`-lines: List~OrderLine~\`.
- Relationship arrows (use exactly these forms):
  - Inheritance: \`Animal <|-- Duck\`
  - Implementation (realization): \`PaymentService ..|> PaymentPort\`
  - Composition (part deleted with the whole): \`Order *-- OrderLine\`
  - Aggregation (part can outlive the whole): \`Cart o-- Item\`
  - Association: \`Customer --> Order\`
  - Dependency: \`ReportService ..> Repository\`
- Add a short label after a colon when useful: \`Customer --> Order : places\`.
- If the description needs categories, declare one \`classDef\` per category with the border hex from <style_guidelines> and fill #ffffff (e.g. \`classDef new fill:#ffffff,stroke:#7a9b7f,stroke-width:2px\`), and apply it with \`class Order new\`.
</syntax_rules>

<example>
${fenced('mermaid', DL_EXAMPLES.classDiagram)}
</example>

${clarify(
  'Infer minor technical omissions with standard OOP defaults (attribute types such as string, int, or boolean, void/boolean return types, and private `-` visibility for fields / public `+` for methods) instead of stopping. Do not invent extra classes just to fill space.',
  'core domain structure is missing or contradictory and cannot be deduced from context — such as unclear relationship directions or types (inheritance vs. composition vs. dependency) or missing core entities',
  '"is OrderLine deleted together with its Order, or only associated with it?"'
)}

<task>
Generate a Mermaid "classDiagram" representing the following classes/modules and their relationships.
${CONTEXT_NOTE('the classes, their attributes and methods, and the relationships')}
[DESCRIBE THE CLASSES, THEIR ATTRIBUTES (-private/+public), METHODS, AND THE RELATIONSHIPS (inheritance, implementation, composition, aggregation, association, dependency)]
</task>

${OUTPUT_MERMAID}`;

  prompts.architecture = `<role>
You are an expert in Diagram Lab's extended Mermaid "architecture-beta" syntax, which includes custom layout directives such as \`align row\`.
</role>

<style_guidelines>
- No emojis. Short, precise group and service names (real systems, not generic placeholders).
</style_guidelines>

<syntax_rules>
- Start with this frontmatter (before architecture-beta) to reproduce the tested spacing:
\`\`\`yaml
---
config:
  architecture:
    padding: 48
    iconSize: 96
    fontSize: 16
    idealEdgeLengthMultiplier: 4
    nodeSeparation: 100
    seed: 1
---
\`\`\`
- Declare each group with \`group id(cloud)[Visible name]\` (2-3 words).
- Declare each service with \`service id(icon)[Title with technical detail] in group\`. Valid icons: cloud, database, disk, internet, server.
- Connections with ports: \`source:R --> L:destination\` (R, L, T, B). One connection per service pair; don't use edge labels.
- For a horizontal chain, add \`align row\` after declaring the services, listing them in the same order as the \`R --> L\` arrows.
- For branching (1-to-N connections), keep the main backbone in \`align row\` using \`R --> L\`, and connect secondary branches or databases using top/bottom ports (\`T --> B\` or \`B --> T\`).
- Never declare alignments that contradict arrow directions, or two alignments on the same axis sharing a service. Keep service titles to at most two lines.
- Use 2-3 groups and 1-3 services per group. Don't invent services or groups just to force spacing.
- architecture-beta does not support classDef or direct control over the margin between groups; built-in icons have their own colors, not themeVariables. Without registering extra icon packs, use only cloud, database, disk, internet, server. Edge labels (\`-[text]->\`) exist, but in this style put protocol, IP, or port in the service title instead. Padding enlarges groups: don't raise it just to separate them.
</syntax_rules>

<example>
${fenced('mermaid', DL_EXAMPLES.architecture)}
</example>

${clarify(
  'Infer minor technical omissions with industry defaults (standard ports such as 443, 8080, or 5432, protocols like HTTPS/TCP, and appropriate icons from the valid list) instead of stopping. Do not invent extra services or groups just to fill space.',
  'core architecture topology is missing or contradictory and cannot be deduced from context (missing groups/services, undeclared connection directions, or contradictory ordering)',
  '"does the API call the database directly, or through the cache?"'
)}

<task>
Generate a Mermaid "architecture-beta" diagram representing the following flow architecture.
${CONTEXT_NOTE('the groups, the services with their protocols and ports, and the direction of the connections')}
[DESCRIBE THE GROUPS (e.g. SOURCE, PROCESSING, DESTINATION), THE SERVICES IN EACH GROUP WITH THEIR IP/PROTOCOL/PORT, AND THE DIRECTION OF THE CONNECTIONS]
</task>

${OUTPUT_MERMAID}`;

  const SWIMLANE_JSON_SCHEMA = `<json_schema>
The JSON format (NOT Mermaid) that this tool interprets is:
\`\`\`json
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
\`\`\`
Interpretation rules (important, not optional):
- Every item must declare a unique "key" (used to reference it from "children" or "connections").
- Automatic chaining: each item connects only to the NEXT item in its own lane (simple downward arrow) — don't declare this connection manually, it's automatic. To stop an item from receiving that automatic arrow (because it's reached another way, e.g. a cross connection), mark it with \`"standalone": true\`.
- Branching ("children"): if an item opens several parallel paths within the same lane (e.g. several simultaneous validations), declare them as its "children" array (same fields as an item). They stack vertically inside the lane, with a rail connector on the left that leaves the parent and rejoins toward the next item in the lane. Do NOT use "connections" for this.
- "layout" (optional, at the JSON root): "compact" (default) packs each lane from the top, ignoring "row" — no leading or internal gaps from global numbering. "aligned" restores the shared grid below.
- "row" (optional integer, 0-based; only used with "layout": "aligned"): fixes the row of the grid shared by all lanes. This aligns steps from the same moment of the process horizontally across lanes. If omitted, the next free row in the lane is used. Keep "row" values increasing along the chronological flow so cross-lane steps align.
- When an item has "children", those children occupy the row directly below it. With "layout": "aligned", the next item in the same lane must therefore use a row at least 2 higher (e.g. parent at row 2, children at row 3, next item at row 4). Items in other lanes may share those rows.
- "connections" is for relationships between lanes (adjacent or not) or additional relationships (dependencies, permissions, events). Don't repeat the automatic chaining. They're routed through the gaps between columns: a local elbow between adjacent lanes when there's room; otherwise separate rails below the whole grid, before the legend.
- Keep connection labels to 2-4 words. The engine keeps them clear of lines and boxes; don't add empty rows to make room for them.
- Use "style": "event" (solid yellow fill) only for the node that represents the end of a process or a relevant business event.
- "icon" uses Lucide (lucide.dev) icon names in kebab-case.
- Include in "legend" only the entries actually used in the diagram, with the exact hex codes above.
- If the conversation context does not specify whether steps are new, modified, or reused, default regular steps to "style": "new" (or "reused" for existing external systems) and the final milestone to "style": "event".
</json_schema>`;

  prompts.swimlane = `<role>
You generate technical swimlane diagrams in JSON, for a bespoke "diagram as code" tool (not Mermaid), able to represent processes with parallel branches and cross connections between non-adjacent lanes.
</role>

${PALETTE_STYLE}

${SWIMLANE_JSON_SCHEMA}

<example>
${fenced('json', DL_EXAMPLES.swimlane)}
</example>

${clarify(
  'Infer minor visual/process omissions with sensible defaults (appropriate Lucide icons, concise 1-line descriptions, and "reused" or "new" styles when unspecified) instead of stopping. Do not invent extra steps or lanes just to fill space.',
  'core process logic is missing or contradictory and cannot be deduced from context (which steps belong to which lane, whether steps run in parallel or sequence, cross-lane triggers, or where the process ends)',
  '"does the fraud check run in parallel with capture, or before it?"'
)}

<task>
Generate the swimlane JSON representing the following process, split by phase/system (keep lane titles to 2-4 words).
${CONTEXT_NOTE('the lanes, steps, branches, and cross-lane relationships')}
[DESCRIBE THE LANES IN ORDER, THE STEPS WITHIN EACH ONE, WHETHER ANY STEP BRANCHES INTO SEVERAL PARALLEL PATHS, THE CROSS RELATIONSHIPS BETWEEN NON-ADJACENT LANES (permissions, queries, events), AND WHETHER EACH STEP IS "new", "modified", "reused", "global", OR an "event" marking the end of the process]
</task>

${OUTPUT_JSON}`;

  return prompts;
})();
