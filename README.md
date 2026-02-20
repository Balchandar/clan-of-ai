# CLAN-OF-AI

**Visual Control Plane for Deterministic Multi-Agent AI Systems**

Clan-of-AI sits on top of [IntentusNet](https://github.com/intentusnet/engine) — a deterministic multi-agent execution engine — and provides a production-grade management layer: clan creation, agent assignment, execution orchestration, DAG visualization, step-by-step replay, and execution diff comparison.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                 CLAN-OF-AI                  │
│                                             │
│  ┌──────────────┐    ┌──────────────────┐  │
│  │  Next.js UI   │    │  FastAPI Backend  │  │
│  │  (Port 3000)  │◄──►│  (Port 8000)     │  │
│  │               │    │                  │  │
│  │ /dashboard    │    │ Clan domain      │  │
│  │ /clans        │    │ Governance       │  │
│  │ /executions   │    │ Execution orch.  │  │
│  │ /diff         │    │ Repositories     │  │
│  └──────────────┘    └────────┬─────────┘  │
│                               │             │
│                      ┌────────▼─────────┐  │
│                      │    PostgreSQL     │  │
│                      │    (Port 5432)    │  │
│                      └──────────────────┘  │
└───────────────────────┬─────────────────────┘
                        │ HTTP
                        ▼
          ┌─────────────────────────┐
          │      IntentusNet        │
          │      (Port 8001)        │
          │                         │
          │  POST /run              │
          │  GET  /execution/{id}   │
          │  POST /replay/{id}      │
          │  POST /diff             │
          └─────────────────────────┘
```

## Repo Structure

```
clan-of-ai/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI app + lifespan
│   │   ├── config.py                  # Pydantic settings
│   │   ├── database.py                # Async SQLAlchemy engine
│   │   ├── logging_config.py          # Structlog configuration
│   │   ├── domain/
│   │   │   ├── models.py              # Pure domain models (no ORM)
│   │   │   └── orm_models.py          # SQLAlchemy ORM models
│   │   ├── adapters/
│   │   │   └── intentusnet_client.py  # IntentusNet HTTP adapter
│   │   ├── repositories/
│   │   │   ├── clan_repository.py
│   │   │   ├── execution_repository.py
│   │   │   ├── governance_repository.py
│   │   │   └── audit_repository.py
│   │   ├── services/
│   │   │   ├── clan_service.py
│   │   │   ├── execution_service.py
│   │   │   └── governance_service.py
│   │   ├── api/
│   │   │   ├── dependencies.py
│   │   │   └── routers/
│   │   │       ├── clans.py
│   │   │       ├── agents.py
│   │   │       ├── executions.py
│   │   │       ├── governance.py
│   │   │       └── health.py
│   │   └── schemas/
│   │       ├── clan.py
│   │       ├── execution.py
│   │       └── governance.py
│   ├── migrations/
│   │   └── versions/
│   │       └── 0001_initial_schema.py
│   ├── Dockerfile
│   ├── alembic.ini
│   └── requirements.txt
├── ui/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx               # Redirects to /dashboard
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── clans/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── executions/
│   │   │   │   └── [id]/page.tsx
│   │   │   └── diff/page.tsx
│   │   ├── components/
│   │   │   ├── dag/
│   │   │   │   └── ExecutionGraph.tsx  # ReactFlow DAG
│   │   │   ├── replay/
│   │   │   │   └── ReplayTimeline.tsx  # Step replay
│   │   │   ├── diff/
│   │   │   │   └── DiffViewer.tsx      # Side-by-side diff
│   │   │   └── ui/                     # Design system components
│   │   ├── lib/
│   │   │   ├── api.ts                  # API client (axios)
│   │   │   └── utils.ts
│   │   └── types/index.ts
│   ├── Dockerfile
│   └── package.json
├── demo/
│   ├── research_clan.json              # Example clan definition
│   ├── example_execution.json          # Example execution response
│   └── seed.sh                         # Demo seeding script
├── docs/
│   └── architecture.md
├── docker-compose.yml
├── docker-compose.dev.yml
└── README.md
```

---

## Prerequisites

- Docker 24+ and Docker Compose v2
- (For local dev) Python 3.12+, Node.js 20+
- IntentusNet engine running (see IntentusNet docs for setup)

---

## Quick Start (Docker)

```bash
# 1. Clone
git clone https://github.com/your-org/clan-of-ai.git
cd clan-of-ai

# 2. Configure backend environment
cp backend/.env.example backend/.env
# Edit backend/.env:
#   SECRET_KEY=<openssl rand -hex 32>
#   INTENTUSNET_BASE_URL=http://intentusnet:8001   (or your IntentusNet host)

# 3. Start all services (DB + migrations + backend + UI)
docker compose up -d

# 4. Wait for health checks (about 30 seconds)
docker compose ps

# 5. Open the UI
open http://localhost:3000

# 6. (Optional) Seed the demo clan
./demo/seed.sh

# 7. View API docs
open http://localhost:8000/docs
```

---

## Local Development

### Backend

```bash
cd backend

# Create virtualenv
python3.12 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start Postgres (Docker)
docker run -d --name clanai-db \
  -e POSTGRES_USER=clanai \
  -e POSTGRES_PASSWORD=clanai \
  -e POSTGRES_DB=clanai \
  -p 5432:5432 \
  postgres:16-alpine

# Copy and edit env
cp .env.example .env

# Run migrations
alembic upgrade head

# Start server (hot reload)
uvicorn app.main:app --reload --port 8000
```

### UI

```bash
cd ui

# Install dependencies
npm install

# Copy env
cp .env.example .env.local
# Set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Start dev server
npm run dev
```

Open `http://localhost:3000`.

---

## API Reference

All endpoints are prefixed with `/api/v1`.

### Clans

| Method | Path | Description |
|--------|------|-------------|
| POST | `/clans` | Create a new clan |
| GET | `/clans` | List all clans |
| GET | `/clans/{id}` | Get clan by ID |
| DELETE | `/clans/{id}` | Delete clan |
| POST | `/clans/{id}/clone` | Clone clan with optional config override |

### Agents

| Method | Path | Description |
|--------|------|-------------|
| POST | `/clans/{id}/agents` | Add agent to clan |
| DELETE | `/clans/{id}/agents/{agentId}` | Remove agent from clan |

### Executions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/clans/{id}/run` | Run a task with the clan |
| GET | `/clans/{id}/executions` | List clan executions |
| GET | `/executions/{id}` | Get execution details + DAG |
| POST | `/executions/{id}/replay` | Replay execution steps |
| POST | `/executions/diff` | Compare two executions |

### Governance

| Method | Path | Description |
|--------|------|-------------|
| GET | `/clans/{id}/governance` | Get clan governance config |
| PUT | `/clans/{id}/governance` | Update governance config |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | System health (DB + IntentusNet) |

---

## Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://clanai:clanai@localhost:5432/clanai` | Postgres connection string |
| `INTENTUSNET_BASE_URL` | `http://intentusnet:8001` | IntentusNet engine URL |
| `INTENTUSNET_TIMEOUT_S` | `60.0` | Request timeout |
| `INTENTUSNET_MAX_RETRIES` | `3` | Retry attempts |
| `SECRET_KEY` | (required in prod) | JWT/crypto secret |
| `ALLOWED_ORIGINS` | `["http://localhost:3000"]` | CORS origins (JSON list) |
| `LOG_LEVEL` | `INFO` | Logging level |
| `ENVIRONMENT` | `production` | `production` or `development` |
| `DEBUG` | `false` | SQLAlchemy echo + verbose logs |

### UI

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Backend URL |

---

## Database Schema

```sql
clans                    -- clan definitions
  id UUID PK
  name VARCHAR(255) UNIQUE
  description TEXT
  config JSONB
  created_at, updated_at TIMESTAMPTZ

clan_agents              -- agents assigned to clans
  id UUID PK
  clan_id UUID FK → clans
  agent_id VARCHAR(255)
  name VARCHAR(255)
  role VARCHAR(64)        -- orchestrator|worker|validator|monitor
  config JSONB
  created_at TIMESTAMPTZ
  UNIQUE(clan_id, agent_id)

clan_executions          -- execution records (DAG stored as JSONB, immutable)
  id UUID PK
  clan_id UUID FK → clans
  task VARCHAR(512)
  task_inputs JSONB
  status VARCHAR(64)      -- pending|running|completed|failed|replaying|cancelled
  execution_hash VARCHAR(64)   -- SHA-256 of DAG structure for determinism
  dag JSONB               -- immutable execution DAG from IntentusNet
  started_at TIMESTAMPTZ
  completed_at TIMESTAMPTZ
  error_message TEXT
  error_class VARCHAR(64) -- transient|permanent|timeout|validation|upstream
  retry_count INT
  determinism_verified BOOL

execution_metadata       -- auxiliary metadata per execution
  id UUID PK
  execution_id UUID FK → clan_executions UNIQUE
  inputs, outputs JSONB
  duration_ms INT
  node_count INT
  determinism_verified BOOL

governance_configs       -- per-clan governance rules
  id UUID PK
  clan_id UUID FK → clans UNIQUE
  max_retries INT
  timeout_s INT
  max_concurrent_executions INT
  allowed_agent_roles JSONB
  rules JSONB
  require_determinism_verification BOOL

audit_logs               -- immutable audit trail
  id UUID PK
  clan_id UUID (nullable)
  execution_id UUID (nullable)
  action VARCHAR(128)
  actor VARCHAR(255)
  payload JSONB
  created_at TIMESTAMPTZ
```

---

## Execution Flow

```
Client → POST /clans/{id}/run
  │
  ├── Validate clan exists
  ├── Load governance config
  ├── Create execution record (status=pending)
  ├── Write audit log: execution_started
  ├── Update execution status → running
  ├── Call IntentusNet POST /run
  │     ├── Pass clan_id, task, agents, governance
  │     └── Receive: { execution_id, dag }
  ├── Compute execution hash (SHA-256 of DAG topology)
  ├── Store DAG as immutable JSONB
  ├── Update execution status → completed
  ├── Write execution_metadata record
  ├── Write audit log: execution_completed
  └── Return execution response with DAG
```

---

## Determinism Verification

Each completed execution receives an `execution_hash` — a SHA-256 digest of its DAG structure (node IDs + edge topology). This enables:

1. **Verification**: Two runs with identical inputs and agents must produce the same hash
2. **Diff**: Compare hash values before calling IntentusNet `/diff` for full node-level comparison
3. **Audit**: Hashes are stored immutably in `clan_executions.execution_hash`

---

## Governance Rules

Governance configs control how clans execute:

```json
{
  "max_retries": 3,
  "timeout_s": 300,
  "max_concurrent_executions": 5,
  "require_determinism_verification": true,
  "rules": [
    {
      "rule_id": "halt-on-score",
      "name": "Halt if quality score too low",
      "condition": "quality_score < 0.7",
      "action": "halt",
      "enabled": true,
      "priority": 100
    }
  ]
}
```

Governance rules are forwarded to IntentusNet as part of the `/run` payload. IntentusNet enforces them during execution.

---

## Production Deployment

### Docker Compose (recommended for single-node)

```bash
# Production
docker compose -f docker-compose.yml up -d

# Scale backend (requires load balancer)
docker compose up -d --scale backend=3
```

### Environment Hardening

```bash
# Generate a secure secret key
openssl rand -hex 32

# Set in backend/.env
SECRET_KEY=<output-from-above>
ENVIRONMENT=production
DEBUG=false
```

### Monitoring

- Backend health: `GET /health` — returns DB + IntentusNet status
- Metrics: Prometheus metrics exposed at `/metrics` (if `ENABLE_METRICS=true`)
- Structured JSON logs via structlog (production mode)

---

## License

See [LICENSE](./LICENSE).
