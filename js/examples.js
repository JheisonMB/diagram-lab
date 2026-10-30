/**
 * examples.js
 * Catalog of examples loadable from the UI selector.
 * window.DL_EXAMPLES: Record<string, string>
 * Keep in sync with the files in examples/ (same content, one file per key).
 */
window.DL_EXAMPLES = {
  sequence: `sequenceDiagram
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

    Note over SVC,DB: Transaction recorded in Operation Registry`,

  er: `erDiagram
    direction LR
    CUSTOMER {
        string customer_id PK
        string name
        string document_id UK
        string email
    }
    ACCOUNT {
        string account_id PK
        string customer_id FK
        string account_type
        decimal balance
    }
    CARD {
        string card_id PK
        string account_id FK
        string masked_number UK
        date expiration_date
        string status
    }
    MERCHANT {
        string merchant_id PK
        string name
        string mcc_category
    }
    AUTHORIZATION {
        string authorization_id PK
        string card_id FK
        string merchant_id FK
        decimal amount
        string currency
        string status
        datetime timestamp
    }
    POSTING {
        string posting_id PK
        string authorization_id FK
        decimal posted_amount
        string reconciliation_status
        date process_date
    }

    CUSTOMER ||--o{ ACCOUNT : owns
    ACCOUNT ||--o{ CARD : issues
    CARD ||--o{ AUTHORIZATION : generates
    MERCHANT ||--o{ AUTHORIZATION : receives
    AUTHORIZATION ||--o| POSTING : settles`,

  classDiagram: `classDiagram
    direction LR
    class PaymentService_01_CO["PaymentService-01-CO"] {
        -AccountClient: AccountClient
        -LedgerClient: LedgerClient
        -Log: Log
        -Dto: DTO
        +ServiceExecution() void
        +DataBaseExecution() void
    }
    class DTO {
        -Street: char
        -City: char
        -Country: char
        -PostalCode: int
        -State: int
        +equals() void
        +ToString() void
    }
    class AccountClient {
        -Logs: Log
        -ApiConnector: Connector
        +PaymentAch() void
        +ReportAch() void
    }
    class LedgerClient {
        -Logs: Log
        -Jdbc: JdbcClient
        +InsertExecution() void
        +UpdateExecution() void
    }
    PaymentService_01_CO --> AccountClient
    PaymentService_01_CO --> LedgerClient
    PaymentService_01_CO --> DTO`,

  architecture: `---
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
    api:R --> L:db`,

  bpmn: JSON.stringify({
    kind: "bpmn",
    title: "PAYMENT CLAIM (BPMN process)",
    lanes: [
      { title: "Customer", items: [
        { key: "e1", type: "start", title: "Start: claim", row: 0 },
        { key: "t1", type: "task", id: "1", icon: "smartphone", title: "Submit claim", desc: "Via the bank's app", row: 1 },
        { key: "e3", type: "end", title: "Customer notified", row: 7, standalone: true }
      ]},
      { title: "Digital Channel", items: [
        { key: "t2", type: "task", id: "2", icon: "user-check", title: "Verify identity", desc: "Customer authentication", row: 2 },
        { key: "t3", type: "task", id: "3", icon: "file-plus", title: "Create case", desc: "Registers the claim case", row: 3 }
      ]},
      { title: "Payments Back Office", items: [
        { key: "g1", type: "gateway", title: "Amount > threshold?", row: 4,
          branches: [{ label: "Yes", to: "t5" }, { label: "No", to: "t4" }] },
        { key: "t5", type: "task", id: "4", icon: "user-round-search", title: "Manual review", desc: "Analyst validates the case", row: 5 },
        { key: "t6", type: "task", id: "5", icon: "file-check", title: "Generate resolution", desc: "Issues the case resolution", row: 6 }
      ]},
      { title: "Automated Rules", items: [
        { key: "t4", type: "task", id: "4b", icon: "cpu", title: "Automated review", desc: "Payments rules engine", row: 5 }
      ]},
      { title: "Core System", items: [
        { key: "t7", type: "task", id: "6", icon: "database", title: "Update account", desc: "Impacts account status", row: 7 },
        { key: "e2", type: "end", title: "Claim resolved", row: 8 }
      ]}
    ],
    connections: [
      { from: "t1", to: "t2", style: "solid" },
      { from: "t3", to: "g1", style: "solid" },
      { from: "t4", to: "t6", style: "solid" },
      { from: "t6", to: "t7", style: "solid" },
      { from: "t6", to: "e3", style: "dashed", label: "Notification" }
    ]
  }, null, 2),


  swimlane: JSON.stringify({
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
  }, null, 2)
};
