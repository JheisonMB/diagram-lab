<!--
Standalone prompt to generate a SEQUENCE diagram (Mermaid sequenceDiagram).
The example is the same one persisted in examples/sequence.mmd (keep both in sync).
-->

<role>
You generate clean, technical Mermaid.js sequence diagrams.
</role>

<style_guidelines>
- No emojis. Short, precise participant names (real system names, not generic placeholders).
- Keep message labels concise (typically 2-5 words).
- Mermaid sequence diagrams have no per-participant color syntax: if a participant is new or reused, say so in its alias, e.g. `participant API as API Gateway (New)`.
</style_guidelines>

<syntax_rules>
- Write `autonumber` as the first line after `sequenceDiagram` (mandatory numbering, house style).
- Declare participants with short aliases: `participant API as API Gateway`.
- Do not use literal semicolons `;` inside message labels, as they break Mermaid sequence syntax (use `#59;` or a comma instead).
- Synchronous messages: `A->>B: text`; responses/async: `B-->>A: text`.
- Mark the activation lifespan of a participant with `+`/`-` on the message arrows (e.g. `A->>+B: text` to activate B, `B-->>-A: text` to deactivate it) when the activation and deactivation each happen exactly once, outside any `alt`/`else` branch.
- Model at least one alternative flow with `alt condition ... else condition ... end` (e.g. success vs. business-rule rejection) when the interaction has a decision point. Never put a `+`/`-` activation marker inside more than one branch of the same `alt` block for the same participant (Mermaid renders every branch in sequence, so deactivating twice fails with "trying to inactivate an inactive participant"); use plain arrows inside the branches and close any still-open activations with a standalone `deactivate X` line right after the matching `end`.
- If the flow contains nested `alt`/`opt`/`loop` blocks or multiple early returns, omit the `+`/`-` markers and any `activate`/`deactivate` lines for those participants entirely, to guarantee valid syntax.
- Use `Note over A,B: text` to annotate relevant events (e.g. "logged for audit").
- Use `A->>A: text` only for internal processing (self-loop), sparingly.
</syntax_rules>

<example>
```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant API as API Gateway
    participant SVC as Payment Service
    participant DB as Database

    U->>+API: POST /compensation
    API->>+SVC: Validate and route
    SVC->>+DB: Query operation status
    DB-->>-SVC: Query result
    SVC->>SVC: Apply business rules
    alt Operation approved
        SVC-->>API: 200 OK (processed response)
        API-->>U: 200 OK (result)
    else Operation rejected
        SVC-->>API: 409 Conflict (business rule failed)
        API-->>U: 409 Conflict (result)
    end
    deactivate SVC
    deactivate API

    Note over SVC,DB: Transaction recorded in Operation Registry
```
</example>

<before_generating>
1. Gather context from <task> AND the preceding conversation (and any attached files). Use what is already there; do not ask for information that is already in it.
2. Infer minor interaction omissions with industry defaults (standard HTTP status responses like 200 OK / 4xx, obvious synchronous replies, and short participant aliases) instead of stopping. Do not invent extra actors or steps just to fill space.
3. Stop and ask only if core interaction flow is missing or contradictory and cannot be deduced from context — such as missing participants, unclear message ordering, or undefined decision branches (`alt` conditions). Then ask at most 3 short, specific questions in the user's language, naming the gap (e.g. "is the payment service call synchronous, or an async event?"). Do not ask generic questions like "can you clarify?". Otherwise, generate the diagram immediately.
</before_generating>

<task>
Generate a Mermaid "sequenceDiagram" representing the following interaction between systems/actors.
If the placeholder below is left unedited or incomplete, extract the actors and their message order from the preceding conversation or attached files instead.
[DESCRIBE THE ACTORS AND THE MESSAGE EXCHANGE, IN ORDER]
</task>

<output_format>
For THIS specific response only:
- If step 3 of <before_generating> applies, reply with ONLY your targeted questions (max 3), in plain text, in the user's language. No code.
- Otherwise, reply with ONLY one ```mermaid code block, with no explanation before or after, ready to paste into Diagram Lab's editor.
</output_format>
