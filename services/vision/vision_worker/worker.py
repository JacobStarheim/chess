from __future__ import annotations

import sys

from vision_worker.board_import import import_board
from vision_worker.protocol import WorkerMessage, make_error, make_result
from vision_worker.tablebase import probe_tablebase


def handle_message(message: WorkerMessage):
    if message.method == "import_board":
        return import_board(message.params)
    if message.method == "probe_tablebase":
        return probe_tablebase(
            message.params["path"],
            message.params["position"],
        )
    raise RuntimeError(f"Unknown method: {message.method}")


def main() -> int:
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue

        message = WorkerMessage.from_json(raw)

        try:
            result = handle_message(message)
            sys.stdout.write(make_result(message.id, result) + "\n")
        except Exception as error:  # pragma: no cover - process level safety
            sys.stdout.write(make_error(message.id, str(error)) + "\n")

        sys.stdout.flush()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
