import { Chess, type PieceSymbol, type Square } from "chess.js";
import type { PositionSetup } from "@shared/contracts";

export const START_POSITION: PositionSetup = {
  placementFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
  sideToMove: "w",
  castling: "KQkq",
  enPassant: "-",
  halfmoveClock: 0,
  fullmoveNumber: 1
};

export interface DerivedWorkspace {
  chess: Chess;
  currentFen: string;
  pgn: string;
  sanMoves: string[];
}

export type EditorPiece =
  | "P"
  | "N"
  | "B"
  | "R"
  | "Q"
  | "K"
  | "p"
  | "n"
  | "b"
  | "r"
  | "q"
  | "k"
  | "";

export function fullFenFromSetup(setup: PositionSetup): string {
  return [
    setup.placementFen,
    setup.sideToMove,
    setup.castling || "-",
    setup.enPassant || "-",
    String(setup.halfmoveClock),
    String(setup.fullmoveNumber)
  ].join(" ");
}

export function parseFullFen(fen: string): PositionSetup {
  const validated = new Chess(fen);
  const [placementFen, sideToMove, castling, enPassant, halfmoveClock, fullmoveNumber] =
    validated.fen().split(" ");

  return {
    placementFen,
    sideToMove: sideToMove as "w" | "b",
    castling,
    enPassant,
    halfmoveClock: Number(halfmoveClock),
    fullmoveNumber: Number(fullmoveNumber)
  };
}

export function deriveWorkspace(
  rootPosition: PositionSetup,
  moveHistory: string[]
): DerivedWorkspace {
  const chess = new Chess(fullFenFromSetup(rootPosition));

  for (const move of moveHistory) {
    chess.move({
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move[4] as "q" | "r" | "b" | "n" | undefined
    });
  }

  return {
    chess,
    currentFen: chess.fen(),
    pgn: chess.pgn({ maxWidth: 120, newline: "\n" }),
    sanMoves: chess.history()
  };
}

export function tryApplyMove(
  rootPosition: PositionSetup,
  moveHistory: string[],
  from: string,
  to: string,
  promotion = "q"
): string[] | null {
  const chess = deriveWorkspace(rootPosition, moveHistory).chess;
  const result = chess.move({
    from: from as Square,
    to: to as Square,
    promotion: promotion as PieceSymbol
  });

  if (!result) {
    return null;
  }

  return [...moveHistory, toUci(result.from, result.to, result.promotion)];
}

export function loadPgnState(pgn: string): {
  rootPosition: PositionSetup;
  moveHistory: string[];
} {
  const fenHeader = pgn.match(/\[FEN "([^"]+)"\]/)?.[1];
  const chess = fenHeader ? new Chess(fenHeader) : new Chess();
  chess.loadPgn(pgn);

  return {
    rootPosition: fenHeader ? parseFullFen(fenHeader) : START_POSITION,
    moveHistory: chess.history({ verbose: true }).map((move) =>
      toUci(move.from, move.to, move.promotion)
    )
  };
}

export function setSquarePiece(
  placementFen: string,
  square: string,
  piece: EditorPiece
): string {
  const board = placementFenToBoardMap(placementFen);
  if (piece) {
    board.set(square, piece);
  } else {
    board.delete(square);
  }

  return boardMapToPlacementFen(board);
}

export function placementFenToBoardMap(
  placementFen: string
): Map<string, EditorPiece> {
  const board = new Map<string, EditorPiece>();
  const ranks = placementFen.split("/");

  for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
    let fileIndex = 0;
    for (const token of ranks[rankIndex]) {
      if (/\d/.test(token)) {
        fileIndex += Number(token);
      } else {
        const square = `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`;
        board.set(square, token as EditorPiece);
        fileIndex += 1;
      }
    }
  }

  return board;
}

export function boardMapToPlacementFen(board: Map<string, EditorPiece>): string {
  const ranks: string[] = [];

  for (let rank = 8; rank >= 1; rank -= 1) {
    let empty = 0;
    let output = "";

    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const square = `${String.fromCharCode(97 + fileIndex)}${rank}`;
      const piece = board.get(square);

      if (!piece) {
        empty += 1;
        continue;
      }

      if (empty > 0) {
        output += String(empty);
        empty = 0;
      }

      output += piece;
    }

    if (empty > 0) {
      output += String(empty);
    }

    ranks.push(output);
  }

  return ranks.join("/");
}

export function describePosition(
  setup: PositionSetup,
  moveHistory: string[]
): string {
  const view = deriveWorkspace(setup, moveHistory);
  const prefix = view.sanMoves.length > 0
    ? view.sanMoves.slice(-4).join(" ")
    : setup.placementFen === START_POSITION.placementFen
      ? "Initial position"
      : "Custom position";

  return prefix;
}

export function toUci(
  from: string,
  to: string,
  promotion?: string
): string {
  return `${from}${to}${promotion ?? ""}`;
}
