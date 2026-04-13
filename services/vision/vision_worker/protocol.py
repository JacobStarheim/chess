from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class WorkerMessage:
    id: str
    method: str
    params: dict[str, Any]

    @classmethod
    def from_json(cls, raw: str) -> "WorkerMessage":
        payload = json.loads(raw)
        return cls(
            id=str(payload["id"]),
            method=str(payload["method"]),
            params=dict(payload.get("params", {})),
        )


def make_result(message_id: str, result: Any) -> str:
    return json.dumps({"id": message_id, "result": result})


def make_error(message_id: str, error: str) -> str:
    return json.dumps({"id": message_id, "error": error})
