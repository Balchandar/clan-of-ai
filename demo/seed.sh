#!/bin/bash
set -euo pipefail

# Demo seed script — creates the research-clan-alpha example clan
# Usage: ./demo/seed.sh [BASE_URL]
# Default BASE_URL: http://localhost:8000

BASE_URL="${1:-http://localhost:8000}/api/v1"

echo "Seeding demo clan to $BASE_URL..."

# Create clan
CLAN_RESPONSE=$(curl -sf -X POST "$BASE_URL/clans" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "research-clan-alpha",
    "description": "Multi-agent research team for automated literature review and synthesis",
    "config": {
      "model_preference": "claude-3-5-sonnet",
      "max_tokens_per_agent": 4096,
      "temperature": 0.3
    }
  }')

CLAN_ID=$(echo "$CLAN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Created clan: $CLAN_ID"

# Add agents
for AGENT_PAYLOAD in \
  '{"agent_id":"orchestrator-1","name":"Research Orchestrator","role":"orchestrator","config":{"strategy":"divide-and-conquer"}}' \
  '{"agent_id":"searcher-1","name":"Literature Searcher","role":"worker","config":{"sources":["arxiv","pubmed"]}}' \
  '{"agent_id":"analyzer-1","name":"Content Analyzer","role":"worker","config":{"extraction_fields":["methodology","results"]}}' \
  '{"agent_id":"synthesizer-1","name":"Synthesis Agent","role":"worker","config":{"output_format":"structured_report"}}' \
  '{"agent_id":"validator-1","name":"Quality Validator","role":"validator","config":{"threshold":0.85}}' \
  '{"agent_id":"monitor-1","name":"Execution Monitor","role":"monitor","config":{"alert_on_failure":true}}'
do
  curl -sf -X POST "$BASE_URL/clans/$CLAN_ID/agents" \
    -H "Content-Type: application/json" \
    -d "$AGENT_PAYLOAD" > /dev/null
  echo "  Added agent: $(echo "$AGENT_PAYLOAD" | python3 -c "import sys,json; print(json.load(sys.stdin)['agent_id'])")"
done

# Configure governance
curl -sf -X PUT "$BASE_URL/clans/$CLAN_ID/governance" \
  -H "Content-Type: application/json" \
  -d '{
    "max_retries": 3,
    "timeout_s": 600,
    "max_concurrent_executions": 3,
    "allowed_agent_roles": ["orchestrator", "worker", "validator", "monitor"],
    "require_determinism_verification": true,
    "rules": [
      {
        "rule_id": "halt-on-validator-failure",
        "name": "Halt if validation fails",
        "condition": "validator_score < 0.7",
        "action": "halt",
        "enabled": true,
        "priority": 100
      }
    ]
  }' > /dev/null
echo "Configured governance for clan $CLAN_ID"

echo ""
echo "Demo clan created successfully!"
echo "Clan ID: $CLAN_ID"
echo "Open: http://localhost:3000/clans/$CLAN_ID"
