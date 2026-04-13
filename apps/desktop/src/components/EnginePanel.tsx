import { useState } from "react";
import type {
  AnalysisLine,
  AnalysisMode,
  EngineDefinition,
  TablebaseProbeResult,
  TablebaseRegistration
} from "@shared/contracts";
import styles from "./EnginePanel.module.css";

interface EnginePanelProps {
  engines: EngineDefinition[];
  selectedEngineIds: string[];
  analysisActive: boolean;
  search: {
    multipv: number;
    mode: AnalysisMode;
    depth: number;
    movetimeMs: number;
  };
  linesByEngine: Record<string, AnalysisLine[]>;
  tablebaseRegistration?: TablebaseRegistration;
  tablebaseProbe?: TablebaseProbeResult;
  onSetSelected: (engineIds: string[]) => void;
  onInstallManaged: (kind: "stockfish" | "lc0") => void;
  onUpdateEngine: (id: string) => void;
  onAddCustom: () => void;
  onConfigureEngine: (id: string, patch: Partial<EngineDefinition>) => void;
  onSetSearch: (patch: Partial<{ multipv: number; mode: AnalysisMode; depth: number; movetimeMs: number }>) => void;
  onStartAnalysis: () => void;
  onStopAnalysis: () => void;
  onPickTablebases: () => void;
  onProbeTablebase: () => void;
}

export default function EnginePanel(props: EnginePanelProps) {
  const {
    engines,
    selectedEngineIds,
    analysisActive,
    search,
    linesByEngine,
    tablebaseRegistration,
    tablebaseProbe,
    onSetSelected,
    onInstallManaged,
    onUpdateEngine,
    onAddCustom,
    onConfigureEngine,
    onSetSearch,
    onStartAnalysis,
    onStopAnalysis,
    onPickTablebases,
    onProbeTablebase
  } = props;

  return (
    <section className={styles.panel}>
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <h2 className={styles.title}>Analysis Controls</h2>
        </div>
        <div className={styles.grid}>
          <label className={styles.label}>
            MultiPV
            <input
              className={styles.input}
              min={1}
              onChange={(event) =>
                onSetSearch({
                  multipv: Number(event.target.value)
                })
              }
              type="number"
              value={search.multipv}
            />
          </label>
          <label className={styles.label}>
            Search Mode
            <select
              className={styles.select}
              onChange={(event) =>
                onSetSearch({
                  mode: event.target.value as AnalysisMode
                })
              }
              value={search.mode}
            >
              <option value="infinite">Infinite</option>
              <option value="depth">Depth</option>
              <option value="movetime">Move Time</option>
            </select>
          </label>
          <label className={styles.label}>
            Depth
            <input
              className={styles.input}
              min={1}
              onChange={(event) =>
                onSetSearch({
                  depth: Number(event.target.value)
                })
              }
              type="number"
              value={search.depth}
            />
          </label>
          <label className={styles.label}>
            Move Time (ms)
            <input
              className={styles.input}
              min={100}
              onChange={(event) =>
                onSetSearch({
                  movetimeMs: Number(event.target.value)
                })
              }
              type="number"
              value={search.movetimeMs}
            />
          </label>
        </div>
        <div className={styles.buttonRow}>
          <button className={styles.button} onClick={onStartAnalysis} type="button">
            Start Analysis
          </button>
          <button
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={onStopAnalysis}
            type="button"
          >
            Stop Analysis
          </button>
        </div>
        {analysisActive ? (
          <p className={styles.subtle}>
            Analysis auto-restarts when the current position or search settings change.
          </p>
        ) : null}
      </div>

      <div className={styles.card}>
        <div className={styles.headerRow}>
          <h2 className={styles.title}>Engines</h2>
          <div className={styles.buttonRow}>
            <button className={styles.button} onClick={() => onInstallManaged("stockfish")} type="button">
              Install Stockfish
            </button>
            <button
              className={`${styles.button} ${styles.secondaryButton}`}
              onClick={() => onInstallManaged("lc0")}
              type="button"
            >
              Install Lc0
            </button>
            <button
              className={`${styles.button} ${styles.secondaryButton}`}
              onClick={onAddCustom}
              type="button"
            >
              Add Custom UCI
            </button>
          </div>
        </div>

        <div className={styles.engineList}>
          {engines.map((engine) => (
            <EngineCard
              engine={engine}
              key={engine.id}
              lines={linesByEngine[engine.id] ?? []}
              onConfigureEngine={onConfigureEngine}
              onSelect={() => {
                const next = selectedEngineIds.includes(engine.id)
                  ? selectedEngineIds.filter((id) => id !== engine.id)
                  : [...selectedEngineIds, engine.id];
                onSetSelected(next);
              }}
              onUpdateEngine={onUpdateEngine}
              selected={selectedEngineIds.includes(engine.id)}
            />
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.headerRow}>
          <h2 className={styles.title}>Tablebases</h2>
          <div className={styles.buttonRow}>
            <button className={styles.button} onClick={onPickTablebases} type="button">
              Choose Syzygy Folder
            </button>
            <button
              className={`${styles.button} ${styles.secondaryButton}`}
              onClick={onProbeTablebase}
              type="button"
            >
              Probe Current Position
            </button>
          </div>
        </div>
        {tablebaseRegistration ? (
          <>
            <p className={styles.subtle}>{tablebaseRegistration.message}</p>
            <div className={styles.engineMeta}>
              <span className={styles.badge}>{tablebaseRegistration.path}</span>
              <span className={styles.badge}>
                Coverage: {tablebaseRegistration.coverage.join(", ") || "Unknown"}
              </span>
            </div>
          </>
        ) : (
          <p className={styles.subtle}>
            Register a local Syzygy directory to enable WDL/DTZ probing and engine integration.
          </p>
        )}
        {tablebaseProbe ? (
          <div className={styles.lineCard}>
            <div className={styles.strong}>
              WDL: {tablebaseProbe.wdl ?? "N/A"} | DTZ: {tablebaseProbe.dtz ?? "N/A"}
            </div>
            <div className={styles.subtle}>
              Best moves: {tablebaseProbe.bestMovesSan.join(", ") || "No moves reported"}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function EngineCard(props: {
  engine: EngineDefinition;
  lines: AnalysisLine[];
  selected: boolean;
  onSelect: () => void;
  onConfigureEngine: (id: string, patch: Partial<EngineDefinition>) => void;
  onUpdateEngine: (id: string) => void;
}) {
  const { engine, lines, selected, onSelect, onConfigureEngine, onUpdateEngine } = props;
  const [threads, setThreads] = useState(engine.threads);
  const [hashMb, setHashMb] = useState(engine.hashMb);

  return (
    <div className={styles.engineCard}>
      <div className={styles.engineHead}>
        <div className={styles.engineName}>
          <label>
            <input checked={selected} onChange={onSelect} type="checkbox" />
          </label>
          <div>
            <strong>{engine.name}</strong>
            <div className={styles.subtle}>
              {engine.version} · {engine.status ?? "missing"}
            </div>
          </div>
        </div>
        {engine.managed ? (
          <button
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={() => onUpdateEngine(engine.id)}
            type="button"
          >
            Update
          </button>
        ) : (
          <span className={styles.badge}>Custom</span>
        )}
      </div>

      <div className={styles.grid}>
        <label className={styles.label}>
          Threads
          <input
            className={styles.input}
            min={1}
            onChange={(event) => setThreads(Number(event.target.value))}
            type="number"
            value={threads}
          />
        </label>
        <label className={styles.label}>
          Hash (MB)
          <input
            className={styles.input}
            min={16}
            onChange={(event) => setHashMb(Number(event.target.value))}
            type="number"
            value={hashMb}
          />
        </label>
      </div>

      <div className={styles.buttonRow}>
        <button
          className={styles.button}
          onClick={() =>
            onConfigureEngine(engine.id, {
              threads,
              hashMb
            })
          }
          type="button"
        >
          Apply Engine Settings
        </button>
      </div>

      {engine.networkPath ? (
        <div className={styles.subtle}>Network: {engine.networkPath}</div>
      ) : null}
      {engine.syzygyPath ? (
        <div className={styles.subtle}>Syzygy: {engine.syzygyPath}</div>
      ) : null}

      <div className={styles.lineList}>
        {lines.length > 0 ? (
          lines.map((line) => (
            <div className={styles.lineCard} key={`${engine.id}-${line.multipv}`}>
              <div className={styles.strong}>
                #{line.multipv} · depth {line.depth}
                {line.scoreCp !== undefined ? ` · ${line.scoreCp / 100}` : ""}
                {line.mateIn !== undefined ? ` · mate ${line.mateIn}` : ""}
              </div>
              <div>{line.pvSan.join(" ")}</div>
              <div className={styles.subtle}>
                {line.nodes ? `${line.nodes.toLocaleString()} nodes` : "Live"}{" "}
                {line.nps ? `· ${line.nps.toLocaleString()} nps` : ""}
              </div>
            </div>
          ))
        ) : (
          <div className={styles.subtle}>
            No lines yet. Install the engine if needed, then start analysis.
          </div>
        )}
      </div>
    </div>
  );
}
