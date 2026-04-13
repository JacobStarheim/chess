from __future__ import annotations

from typing import Any

import chess
import chess.syzygy


def probe_tablebase(path: str, position: dict[str, Any]) -> dict[str, Any]:
    fen = " ".join(
        [
            position["placementFen"],
            position["sideToMove"],
            position["castling"],
            position["enPassant"],
            str(position["halfmoveClock"]),
            str(position["fullmoveNumber"]),
        ]
    )

    board = chess.Board(fen)
    try:
        with open_tablebases(path) as tablebases:
            wdl = tablebases.probe_wdl(board)
            dtz = tablebases.probe_dtz(board)
            moves = best_moves(board, tablebases)
    except FileNotFoundError:
        return {
            "available": False,
            "wdl": None,
            "bestMovesSan": [],
            "source": "local-syzygy",
            "message": "The registered tablebase path no longer exists.",
        }
    except KeyError:
        return {
            "available": False,
            "wdl": None,
            "bestMovesSan": [],
            "source": "local-syzygy",
            "message": "The current material is not covered by the available Syzygy files.",
        }

    return {
        "available": True,
        "wdl": wdl,
        "dtz": dtz,
        "bestMovesSan": moves,
        "source": "local-syzygy",
    }


def open_tablebases(path: str):
    if hasattr(chess.syzygy, "open_tablebase"):
        return chess.syzygy.open_tablebase(path)
    return chess.syzygy.open_tablebases(path)


def best_moves(board: chess.Board, tablebases: Any) -> list[str]:
    scored: list[tuple[int, int, str]] = []

    for move in board.legal_moves:
        board.push(move)
        try:
            child_wdl = tablebases.probe_wdl(board)
            child_dtz = tablebases.probe_dtz(board)
        except KeyError:
            board.pop()
            continue
        board.pop()

        scored.append((-child_wdl, -abs(child_dtz), board.san(move)))

    scored.sort(reverse=True)
    return [san for _, _, san in scored[:3]]
