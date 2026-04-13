import type { BoardImportResult, PositionSetup } from "@shared/contracts";
import { Chessboard } from "react-chessboard";
import styles from "./BoardPanel.module.css";
import type { EditorPiece } from "@/lib/chess-workspace";

const PIECES: Array<{ value: EditorPiece; label: string }> = [
  { value: "K", label: "♔" },
  { value: "Q", label: "♕" },
  { value: "R", label: "♖" },
  { value: "B", label: "♗" },
  { value: "N", label: "♘" },
  { value: "P", label: "♙" },
  { value: "k", label: "♚" },
  { value: "q", label: "♛" },
  { value: "r", label: "♜" },
  { value: "b", label: "♝" },
  { value: "n", label: "♞" },
  { value: "p", label: "♟" },
  { value: "", label: "Clear" }
];

interface BoardPanelProps {
  currentFen: string;
  orientation: "white" | "black";
  editorMode: boolean;
  selectedEditorPiece: EditorPiece;
  importResult?: BoardImportResult;
  rootPosition: PositionSetup;
  statusMessage?: string;
  onPieceDrop: (sourceSquare: string, targetSquare: string, piece: string) => boolean;
  onSquareClick: (square: string) => void;
  onToggleOrientation: () => void;
  onToggleEditorMode: (next: boolean) => void;
  onSelectPiece: (piece: EditorPiece) => void;
  onResetBoard: () => void;
  onClearMoves: () => void;
  onOpenImport: () => void;
  onOpenCamera: () => void;
  onApplyImportedPosition: () => void;
  onUpdateRootPosition: (patch: Partial<PositionSetup>) => void;
}

export default function BoardPanel(props: BoardPanelProps) {
  const {
    currentFen,
    orientation,
    editorMode,
    selectedEditorPiece,
    importResult,
    rootPosition,
    statusMessage,
    onPieceDrop,
    onSquareClick,
    onToggleOrientation,
    onToggleEditorMode,
    onSelectPiece,
    onResetBoard,
    onClearMoves,
    onOpenImport,
    onOpenCamera,
    onApplyImportedPosition,
    onUpdateRootPosition
  } = props;

  return (
    <section className={styles.panel}>
      <div className={styles.boardCard}>
        <div className={styles.boardFrame}>
          <Chessboard
            options={{
              boardOrientation: orientation,
              darkSquareStyle: { backgroundColor: "#89633c" },
              lightSquareStyle: { backgroundColor: "#f0d6a8" },
              boardStyle: {
                borderRadius: "22px"
              },
              id: "analysis-board",
              onPieceDrop: ({ sourceSquare, targetSquare, piece }) =>
                editorMode || !targetSquare
                  ? false
                  : onPieceDrop(sourceSquare, targetSquare, piece.pieceType),
              onSquareClick: ({ square }) => {
                if (editorMode) {
                  onSquareClick(square);
                }
              },
              position: currentFen
            }}
          />
        </div>
      </div>

      <div className={styles.controlsCard}>
        <div className={styles.buttonRow}>
          <button className={styles.button} onClick={onToggleOrientation} type="button">
            Flip Board
          </button>
          <button
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={() => onToggleEditorMode(!editorMode)}
            type="button"
          >
            {editorMode ? "Leave Editor" : "Board Editor"}
          </button>
          <button
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={onClearMoves}
            type="button"
          >
            Clear Moves
          </button>
          <button
            className={`${styles.button} ${styles.dangerButton}`}
            onClick={onResetBoard}
            type="button"
          >
            Reset Board
          </button>
        </div>

        {editorMode ? (
          <>
            <p className={styles.metaText}>
              Editor mode lets you repair imported boards or build a position from scratch.
              Pick a piece, then click squares on the board.
            </p>
            <div className={styles.piecePalette}>
              {PIECES.map((piece) => (
                <button
                  key={piece.label}
                  className={`${styles.pieceButton} ${
                    selectedEditorPiece === piece.value ? styles.pieceButtonActive : ""
                  }`}
                  onClick={() => onSelectPiece(piece.value)}
                  type="button"
                >
                  {piece.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        <div className={styles.metaGrid}>
          <label className={styles.label}>
            Side To Move
            <select
              className={styles.select}
              onChange={(event) =>
                onUpdateRootPosition({
                  sideToMove: event.target.value as "w" | "b"
                })
              }
              value={rootPosition.sideToMove}
            >
              <option value="w">White</option>
              <option value="b">Black</option>
            </select>
          </label>
          <label className={styles.label}>
            Castling Rights
            <input
              className={styles.input}
              onChange={(event) =>
                onUpdateRootPosition({
                  castling: event.target.value || "-"
                })
              }
              value={rootPosition.castling}
            />
          </label>
          <label className={styles.label}>
            En Passant
            <input
              className={styles.input}
              onChange={(event) =>
                onUpdateRootPosition({
                  enPassant: event.target.value || "-"
                })
              }
              value={rootPosition.enPassant}
            />
          </label>
          <label className={styles.label}>
            Halfmove Clock
            <input
              className={styles.input}
              min={0}
              onChange={(event) =>
                onUpdateRootPosition({
                  halfmoveClock: Number(event.target.value)
                })
              }
              type="number"
              value={rootPosition.halfmoveClock}
            />
          </label>
          <label className={styles.label}>
            Fullmove Number
            <input
              className={styles.input}
              min={1}
              onChange={(event) =>
                onUpdateRootPosition({
                  fullmoveNumber: Number(event.target.value)
                })
              }
              type="number"
              value={rootPosition.fullmoveNumber}
            />
          </label>
        </div>

        {importResult ? (
          <div className={styles.confidenceBox}>
            <div className={styles.metaRow}>
              <strong>
                Detected board confidence: {(importResult.confidence * 100).toFixed(1)}%
              </strong>
              <button className={styles.button} onClick={onApplyImportedPosition} type="button">
                Load Into Editor
              </button>
            </div>
            <p className={styles.metaText}>
              The imported placement is never used blindly. Load it into the editor, fix any
              squares, confirm metadata, then run the engines.
            </p>
          </div>
        ) : null}

        {statusMessage ? <p className={styles.metaText}>{statusMessage}</p> : null}
      </div>

      <div className={styles.importCard}>
        <div className={styles.importRow}>
          <button className={styles.button} onClick={onOpenImport} type="button">
            Upload Board Photo
          </button>
          <button
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={onOpenCamera}
            type="button"
          >
            Capture From Camera
          </button>
        </div>
        <p className={styles.metaText}>
          The photo flow includes rotation, crop, perspective handles, automatic piece detection,
          and a mandatory review step before analysis.
        </p>
      </div>
    </section>
  );
}
