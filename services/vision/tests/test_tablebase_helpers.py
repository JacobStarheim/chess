import unittest

import chess

from vision_worker.tablebase import best_moves


class DummyTablebase:
    def probe_wdl(self, board: chess.Board) -> int:
        return 2 if board.king(chess.BLACK) == chess.E8 else 0

    def probe_dtz(self, board: chess.Board) -> int:
        return 1


class TablebaseHelperTests(unittest.TestCase):
    def test_best_moves_returns_san(self) -> None:
        board = chess.Board("8/4k3/8/8/8/8/4Q3/4K3 w - - 0 1")
        moves = best_moves(board, DummyTablebase())
        self.assertTrue(moves)
        self.assertIsInstance(moves[0], str)


if __name__ == "__main__":
    unittest.main()
