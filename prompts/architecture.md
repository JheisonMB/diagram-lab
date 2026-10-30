<!--
Standalone prompt to generate an ARCHITECTURE diagram (Mermaid architecture-beta,
groups + services + port-based connections). The example is the same one persisted
in examples/architecture.mmd (keep both in sync).
-->

<role>
You are an expert in Diagram Lab's extended Mermaid "architecture-beta" syntax, which includes custom layout directives such as `align row`.
</role>

<style_guidelines>
- No emojis. Short, precise group and service names (real systems, not generic placeholders).
</style_guidelines>

<syntax_rules>
- Start with this frontmatter (before architecture-beta) to reproduce the tested spacing:
```yaml
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
```
- Declare each group with `group id(cloud)[Visible name]` (2-3 words).
- Declare each service with `service id(icon)[Title with technical detail] in group`. Valid icons: cloud, database, disk, internet, server.
- Connections with ports: `source:R --> L:destination` (R, L, T, B). One connection per service pair; don't use edge labels.
- For a horizontal chain, add `align row` after declaring the services, listing them in the same order as the `R --> L` arrows.
- For branching (1-to-N connections), keep the main backbone in `align row` using `R --> L`, and connect secondary branches or databases using top/bottom ports (`T --> B` or `B --> T`).
- Never declare alignments that contradict arrow directions, or two alignments on the same axis sharing a service. Keep service titles to at most two lines.
- Use 2-3 groups and 1-3 services per group. Don't invent services or groups just to force spacing.
- architecture-beta does not support classDef or direct control over the margin between groups; built-in icons have their own colors, not themeVariables. Without registering extra icon packs, use only cloud, database, disk, internet, server. Edge labels (`-[text]->`) exist, but in this style put protocol, IP, or port in the service title instead. Padding enlarges groups: don't raise it just to separate them.
</syntax_rules>

<example>
```mermaid
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
architecture-beta
    group clients(cloud)[Clients]
    service web(internet)[Web and Mobile Clients] in clients

    group edge(cloud)[Edge]
    service lb(server)[Load Balancer HTTPS 443] in edge

    group backend(cloud)[Backend]
    service api(server)[REST API port 8080] in backend
    service db(database)[PostgreSQL Database] in backend

    align row web lb api db
    web:R --> L:lb
    lb:R --> L:api
    api:R --> L:db
```
</example>

<before_generating>
1. Gather context from <task> AND the preceding conversation (and any attached files). Use what is already there; do not ask for information that is already in it.
2. Infer minor technical omissions with industry defaults (standard ports such as 443, 8080, or 5432, protocols like HTTPS/TCP, and appropriate icons from the valid list) instead of stopping. Do not invent extra services or groups just to fill space.
3. Stop and ask only if core architecture topology is missing or contradictory and cannot be deduced from context (missing groups/services, undeclared connection directions, or contradictory ordering). Then ask at most 3 short, specific questions in the user's language, naming the gap (e.g. "does the API call the database directly, or through the cache?"). Do not ask generic questions like "can you clarify?". Otherwise, generate the diagram immediately.
</before_generating>

<task>
Generate a Mermaid "architecture-beta" diagram representing the following flow architecture.
If the placeholder below is left unedited or incomplete, extract the groups, services, protocols, ports, and connection directions from the preceding conversation or attached files instead.
[DESCRIBE THE GROUPS (e.g. SOURCE, PROCESSING, DESTINATION), THE SERVICES IN EACH GROUP WITH THEIR IP/PROTOCOL/PORT, AND THE DIRECTION OF THE CONNECTIONS]
</task>

<output_format>
For THIS specific response only:
- If step 3 of <before_generating> applies, reply with ONLY your targeted questions (max 3), in plain text, in the user's language. No code.
- Otherwise, reply with ONLY one ```mermaid code block, with no explanation before or after, ready to paste into Diagram Lab's editor.
</output_format>
