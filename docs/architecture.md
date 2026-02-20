# Clan-of-AI Architecture

## Clean Architecture Layers

Clan-of-AI follows clean architecture principles with strict layer separation:

```
┌─────────────────────────────────────────┐
│  API Layer (api/routers/)               │
│  - HTTP request/response handling       │
│  - Pydantic schema validation           │
│  - Route definitions                    │
└──────────────────┬──────────────────────┘
                   │ calls
┌──────────────────▼──────────────────────┐
│  Service Layer (services/)              │
│  - Business logic orchestration         │
│  - Cross-domain coordination            │
│  - Audit logging triggers               │
└──────────┬────────────────┬─────────────┘
           │                │
┌──────────▼──────┐  ┌──────▼──────────────┐
│ Repositories    │  │ Adapters             │
│ (repositories/) │  │ (adapters/)          │
│                 │  │                      │
│ Data access     │  │ IntentusNet client   │
│ ORM queries     │  │ Retry logic          │
│ No business     │  │ Error classification │
│ logic           │  │ Response mapping     │
└──────────┬──────┘  └──────────────────────┘
           │
┌──────────▼──────────────────────────────┐
│  Domain (domain/)                       │
│  - Pure business models (dataclasses)   │
│  - ORM models (SQLAlchemy)              │
│  - No external dependencies             │
└─────────────────────────────────────────┘
```

## Key Design Decisions

### 1. IntentusNet is a Black Box

Clan-of-AI never re-implements deterministic execution logic. All execution is delegated to IntentusNet via the `IntentusNetClient` adapter. The adapter:
- Translates domain objects to HTTP payloads
- Maps HTTP responses back to domain objects
- Handles retries with exponential backoff
- Classifies errors (transient vs permanent)

### 2. Immutable DAG Storage

Execution DAGs are stored as JSONB in Postgres and never modified after storage. This enables:
- Determinism verification via hash comparison
- Audit trail integrity
- Historical diff comparisons

### 3. Execution Hash

```python
def compute_hash(dag: ExecutionDAG) -> str:
    payload = json.dumps({
        "nodes": [n.node_id for n in sorted(dag.nodes)],
        "edges": sorted(dag.edges),
    }, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()
```

The hash covers DAG topology (node IDs + edges) but not timing/outputs, matching IntentusNet's determinism contract.

### 4. Repository Pattern

All database access goes through typed repositories. Services never call SQLAlchemy directly. This makes the data layer replaceable and testable.

### 5. Audit Log

Every write operation in the system appends an immutable `audit_logs` record with:
- Action type (enum)
- Actor (who triggered it)
- Payload (structured context)
- Timestamp

This creates a complete audit trail for compliance and debugging.

## IntentusNet Integration Contract

Clan-of-AI expects IntentusNet to expose these endpoints:

### POST /run
**Request:**
```json
{
  "clan_id": "uuid",
  "task": "string",
  "inputs": {},
  "agents": [
    {"agent_id": "str", "name": "str", "role": "str", "config": {}}
  ],
  "governance": {
    "max_retries": 3,
    "timeout_s": 300,
    "require_determinism_verification": false
  }
}
```
**Response:**
```json
{
  "execution_id": "str",
  "dag": {
    "nodes": [
      {
        "node_id": "str", "agent_id": "str", "task_name": "str",
        "status": "str", "inputs": {}, "outputs": {},
        "duration_ms": 1000, "dependencies": [], "error": null
      }
    ],
    "edges": [["node-a", "node-b"]],
    "metadata": {}
  }
}
```

### POST /replay/{id}
**Response:**
```json
{
  "steps": [
    {
      "node_id": "str", "agent_id": "str", "task_name": "str",
      "status": "str", "inputs": {}, "outputs": {}, "duration_ms": 1000
    }
  ]
}
```

### POST /diff
**Request:** `{"execution_a_id": "str", "execution_b_id": "str"}`
**Response:**
```json
{
  "diverged": true,
  "divergence_node": "node-id or null",
  "node_diffs": [
    {
      "node_id": "str", "field": "str",
      "value_a": "any", "value_b": "any", "is_diverged": true
    }
  ],
  "summary": "str"
}
```

### GET /health
**Response:** `200 OK` if engine is running.

## Error Handling

Errors are classified into:

| Class | Description | Retry? |
|-------|-------------|--------|
| `transient` | Network/connectivity issues | Yes (tenacity) |
| `permanent` | Logic/config errors | No |
| `timeout` | Request timeout exceeded | Yes (once) |
| `validation` | Bad request payload | No |
| `upstream` | IntentusNet internal error | No |

The retry strategy uses exponential backoff: 1s → 2s → 4s (max 3 attempts for transient errors).
