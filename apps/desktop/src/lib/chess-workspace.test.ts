import { describe, expect, it } from "vitest";
import {
  boardMapToPlacementFen,
  deriveWorkspace,
  parseFullFen,
  setSquarePiece,
  START_POSITION,
  tryApplyMove
} from "./chess-workspace";

describe("chess-workspace helpers", () => {
  it("applies a legal move and derives SAN history", () => {
    const nextMoves = tryApplyMove(START_POSITION, [], "e2", "e4");
    expect(nextMoves).toEqual(["e2e4"]);

    const workspace = deriveWorkspace(START_POSITION, nextMoves ?? []);
    expect(workspace.sanMoves).toEqual(["e4"]);
    expect(parseFullFen(workspace.currentFen).sideToMove).toBe("b");
  });

  it("edits piece placement square-by-square", () => {
    const emptyBoard = "8/8/8/8/8/8/8/8";
    const withKings = setSquarePiece(emptyBoard, "e1", "K");
    const withBothKings = setSquarePiece(withKings, "e8", "k");

    expect(withBothKings).toBe("4k3/8/8/8/8/8/8/4K3");
    expect(boardMapToPlacementFen(new Map([["a1", "Q"], ["h8", "q"]]))).toBe(
      "7q/8/8/8/8/8/8/Q7"
    );
  });
});
