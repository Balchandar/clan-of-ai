"""
IntentusNet HTTP client adapter.

This adapter is the ONLY component that communicates with IntentusNet.
It translates domain requests into HTTP calls and maps responses back
to domain objects. No deterministic logic is re-implemented here.
"""
from __future__ import annotations

import uuid
from typing import Any
from uuid import UUID

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings
from app.domain.models import (
    DAGNode,
    ExecutionDAG,
    ExecutionDiff,
    NodeDiff,
    ReplayStep,
)
from app.logging_config import get_logger

logger = get_logger(__name__)


class IntentusNetError(Exception):
    def __init__(self, message: str, status_code: int | None = None, upstream_body: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.upstream_body = upstream_body


class IntentusNetUnavailableError(IntentusNetError):
    pass


class IntentusNetValidationError(IntentusNetError):
    pass


def _build_dag_from_response(data: dict[str, Any]) -> ExecutionDAG:
    nodes = []
    for n in data.get("nodes", []):
        nodes.append(
            DAGNode(
                node_id=n["node_id"],
                agent_id=n["agent_id"],
                task_name=n["task_name"],
                status=n["status"],
                inputs=n.get("inputs", {}),
                outputs=n.get("outputs", {}),
                duration_ms=n.get("duration_ms", 0),
                dependencies=n.get("dependencies", []),
                error=n.get("error"),
            )
        )

    edges = [tuple(e) for e in data.get("edges", [])]
    return ExecutionDAG(nodes=nodes, edges=edges, metadata=data.get("metadata", {}))


def _build_replay_steps(data: list[dict[str, Any]]) -> list[ReplayStep]:
    steps = []
    cumulative = 0
    for idx, step in enumerate(data):
        duration = step.get("duration_ms", 0)
        cumulative += duration
        steps.append(
            ReplayStep(
                step_index=idx,
                node_id=step["node_id"],
                agent_id=step["agent_id"],
                task_name=step["task_name"],
                status=step["status"],
                inputs=step.get("inputs", {}),
                outputs=step.get("outputs", {}),
                duration_ms=duration,
                cumulative_duration_ms=cumulative,
            )
        )
    return steps


def _build_diff(data: dict[str, Any], exec_a: UUID, exec_b: UUID) -> ExecutionDiff:
    node_diffs = [
        NodeDiff(
            node_id=d["node_id"],
            field=d["field"],
            value_a=d["value_a"],
            value_b=d["value_b"],
            is_diverged=d["is_diverged"],
        )
        for d in data.get("node_diffs", [])
    ]
    return ExecutionDiff(
        execution_a_id=exec_a,
        execution_b_id=exec_b,
        diverged=data.get("diverged", False),
        divergence_node=data.get("divergence_node"),
        node_diffs=node_diffs,
        summary=data.get("summary", ""),
    )


class IntentusNetClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._base_url = settings.intentusnet_base_url.rstrip("/")
        self._timeout = settings.intentusnet_timeout_s
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
                headers={"Content-Type": "application/json", "X-Source": "clan-of-ai"},
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    @retry(
        retry=retry_if_exception_type(IntentusNetUnavailableError),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def run_execution(
        self,
        clan_id: UUID,
        task: str,
        task_inputs: dict[str, Any],
        agents: list[dict[str, Any]],
        governance: dict[str, Any],
    ) -> tuple[str, ExecutionDAG]:
        """
        Calls IntentusNet POST /run.
        Returns (intentusnet_execution_id, dag).
        """
        client = await self._get_client()
        payload = {
            "clan_id": str(clan_id),
            "task": task,
            "inputs": task_inputs,
            "agents": agents,
            "governance": governance,
        }
        logger.info("intentusnet.run", clan_id=str(clan_id), task=task)
        try:
            response = await client.post("/run", json=payload)
        except httpx.ConnectError as exc:
            raise IntentusNetUnavailableError(f"IntentusNet unreachable: {exc}") from exc
        except httpx.TimeoutException as exc:
            raise IntentusNetUnavailableError(f"IntentusNet timeout: {exc}") from exc

        if response.status_code == 422:
            raise IntentusNetValidationError(
                "IntentusNet rejected the request",
                status_code=422,
                upstream_body=response.json(),
            )
        if response.status_code >= 500:
            raise IntentusNetUnavailableError(
                f"IntentusNet server error {response.status_code}",
                status_code=response.status_code,
            )
        if response.status_code >= 400:
            raise IntentusNetError(
                f"IntentusNet client error {response.status_code}",
                status_code=response.status_code,
                upstream_body=response.json(),
            )

        body = response.json()
        execution_id = body["execution_id"]
        dag = _build_dag_from_response(body.get("dag", {"nodes": [], "edges": [], "metadata": {}}))
        logger.info("intentusnet.run.complete", execution_id=execution_id)
        return execution_id, dag

    @retry(
        retry=retry_if_exception_type(IntentusNetUnavailableError),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def get_execution(self, intentusnet_execution_id: str) -> ExecutionDAG:
        """Calls IntentusNet GET /execution/{id}."""
        client = await self._get_client()
        try:
            response = await client.get(f"/execution/{intentusnet_execution_id}")
        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            raise IntentusNetUnavailableError(str(exc)) from exc

        if response.status_code == 404:
            raise IntentusNetError("Execution not found in IntentusNet", status_code=404)
        if response.status_code >= 400:
            raise IntentusNetError(f"IntentusNet error {response.status_code}", status_code=response.status_code)

        return _build_dag_from_response(response.json())

    @retry(
        retry=retry_if_exception_type(IntentusNetUnavailableError),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def replay_execution(
        self,
        intentusnet_execution_id: str,
        step_limit: int | None = None,
    ) -> list[ReplayStep]:
        """Calls IntentusNet POST /replay/{id}."""
        client = await self._get_client()
        payload: dict[str, Any] = {}
        if step_limit is not None:
            payload["step_limit"] = step_limit

        try:
            response = await client.post(f"/replay/{intentusnet_execution_id}", json=payload)
        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            raise IntentusNetUnavailableError(str(exc)) from exc

        if response.status_code >= 400:
            raise IntentusNetError(f"IntentusNet replay error {response.status_code}", status_code=response.status_code)

        body = response.json()
        return _build_replay_steps(body.get("steps", []))

    @retry(
        retry=retry_if_exception_type(IntentusNetUnavailableError),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def diff_executions(
        self,
        intentusnet_execution_a_id: str,
        intentusnet_execution_b_id: str,
        clan_execution_a_id: UUID,
        clan_execution_b_id: UUID,
    ) -> ExecutionDiff:
        """Calls IntentusNet POST /diff."""
        client = await self._get_client()
        payload = {
            "execution_a_id": intentusnet_execution_a_id,
            "execution_b_id": intentusnet_execution_b_id,
        }
        try:
            response = await client.post("/diff", json=payload)
        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            raise IntentusNetUnavailableError(str(exc)) from exc

        if response.status_code >= 400:
            raise IntentusNetError(f"IntentusNet diff error {response.status_code}", status_code=response.status_code)

        return _build_diff(response.json(), clan_execution_a_id, clan_execution_b_id)

    async def health_check(self) -> bool:
        """Returns True if IntentusNet is reachable."""
        client = await self._get_client()
        try:
            response = await client.get("/health", timeout=5.0)
            return response.status_code == 200
        except Exception:
            return False


_client_instance: IntentusNetClient | None = None


def get_intentusnet_client() -> IntentusNetClient:
    global _client_instance
    if _client_instance is None:
        _client_instance = IntentusNetClient()
    return _client_instance
