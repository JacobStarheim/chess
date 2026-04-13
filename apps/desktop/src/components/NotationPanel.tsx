import type { RecentPosition } from "@shared/contracts";
import styles from "./NotationPanel.module.css";

interface NotationPanelProps {
  fenInput: string;
  pgnInput: string;
  sanMoves: string[];
  recentPositions: RecentPosition[];
  onFenInputChange: (value: string) => void;
  onApplyFen: () => void;
  onPgnInputChange: (value: string) => void;
  onApplyPgn: () => void;
  onLoadRecent: (fen: string) => void;
  onSaveRecent: () => void;
}

export default function NotationPanel(props: NotationPanelProps) {
  const {
    fenInput,
    pgnInput,
    sanMoves,
    recentPositions,
    onFenInputChange,
    onApplyFen,
    onPgnInputChange,
    onApplyPgn,
    onLoadRecent,
    onSaveRecent
  } = props;

  const pairedMoves = [];
  for (let index = 0; index < sanMoves.length; index += 2) {
    pairedMoves.push({
      turn: Math.floor(index / 2) + 1,
      white: sanMoves[index],
      black: sanMoves[index + 1]
    });
  }

  return (
    <section className={styles.panel}>
      <div className={styles.card}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>FEN Workspace</h2>
        </div>
        <textarea
          className={styles.textarea}
          onChange={(event) => onFenInputChange(event.target.value)}
          value={fenInput}
        />
        <div className={styles.buttonRow}>
          <button className={styles.button} onClick={onApplyFen} type="button">
            Apply FEN
          </button>
          <button
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={onSaveRecent}
            type="button"
          >
            Save To Recent
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>PGN Workspace</h2>
        </div>
        <textarea
          className={styles.textarea}
          onChange={(event) => onPgnInputChange(event.target.value)}
          value={pgnInput}
        />
        <div className={styles.buttonRow}>
          <button className={styles.button} onClick={onApplyPgn} type="button">
            Load PGN
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Move List</h2>
        </div>
        <div className={styles.moves}>
          {pairedMoves.length > 0 ? (
            pairedMoves.map((pair) => (
              <div className={styles.moveItem} key={pair.turn}>
                {pair.turn}. {pair.white ?? "…"} {pair.black ?? ""}
              </div>
            ))
          ) : (
            <div className={styles.subtle}>Moves you play or load will appear here.</div>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Recent Positions</h2>
        </div>
        <div className={styles.recentList}>
          {recentPositions.length > 0 ? (
            recentPositions.map((position) => (
              <div className={styles.recentItem} key={`${position.updatedAt}-${position.fen}`}>
                <div className={styles.recentMeta}>
                  <strong>{position.label}</strong>
                  <span className={styles.subtle}>
                    {new Date(position.updatedAt).toLocaleString()}
                  </span>
                </div>
                <button
                  className={`${styles.button} ${styles.secondaryButton}`}
                  onClick={() => onLoadRecent(position.fen)}
                  type="button"
                >
                  Load
                </button>
              </div>
            ))
          ) : (
            <div className={styles.subtle}>Saved snapshots show up here for quick return trips.</div>
          )}
        </div>
      </div>
    </section>
  );
}
