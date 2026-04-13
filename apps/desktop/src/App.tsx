import { useEffect, useState } from "react";
import type { AnalysisRequest, BoardImportRequest, DesktopEvent } from "@shared/contracts";
import styles from "./App.module.css";
import BoardImportModal from "@/components/BoardImportModal";
import BoardPanel from "@/components/BoardPanel";
import CameraCaptureModal from "@/components/CameraCaptureModal";
import EnginePanel from "@/components/EnginePanel";
import NotationPanel from "@/components/NotationPanel";
import {
  deriveWorkspace,
  parseFullFen
} from "@/lib/chess-workspace";
import { useDesktopStore } from "@/store/useDesktopStore";

export default function App() {
  const {
    engines,
    selectedEngineIds,
    orientation,
    rootPosition,
    moveHistory,
    search,
    editorMode,
    selectedEditorPiece,
    engineLines,
    activeSessions,
    analysisActive,
    recentPositions,
    tablebaseRegistration,
    tablebaseProbe,
    importModalOpen,
    importDraft,
    importResult,
    cameraModalOpen,
    statusMessage,
    hydrate,
    setEngines,
    setSelectedEngineIds,
    toggleOrientation,
    setSearch,
    setEditorMode,
    setSelectedEditorPiece,
    applyMove,
    replaceFen,
    loadPgn,
    resetBoard,
    clearMoves,
    editSquare,
    setRootPositionPatch,
    setEngineLines,
    setActiveSession,
    clearActiveSessions,
    setAnalysisActive,
    addRecentPosition,
    setTablebaseRegistration,
    setTablebaseProbe,
    openImportModal,
    closeImportModal,
    updateImportDraft,
    setImportResult,
    applyImportedPosition,
    openCameraModal,
    setStatusMessage
  } = useDesktopStore();

  const workspace = deriveWorkspace(rootPosition, moveHistory);
  const currentFen = workspace.currentFen;
  const [fenInput, setFenInput] = useState(currentFen);
  const [pgnInput, setPgnInput] = useState(workspace.pgn);

  useEffect(() => {
    void loadInitialState();

    const unsubscribe = window.chessApp.events.subscribe((event: DesktopEvent) => {
      if (event.type === "analysis:update") {
        const currentSession = useDesktopStore.getState().activeSessions[event.engineId];
        if (currentSession !== event.sessionId) {
          return;
        }

        useDesktopStore.getState().setEngineLines(event.engineId, event.lines);
      }

      if (event.type === "analysis:stopped") {
        const state = useDesktopStore.getState();
        if (state.activeSessions[event.engineId] === event.sessionId) {
          state.setStatusMessage(`${event.engineId} completed its current search.`);
        }
      }

      if (event.type === "engine:install-progress") {
        useDesktopStore
          .getState()
          .setStatusMessage(`${event.engineId}: ${event.message}`);
      }

      if (event.type === "engine:updated") {
        void refreshEngines();
        useDesktopStore
          .getState()
          .setStatusMessage(`${event.engine.name} is ready at ${event.engine.version}.`);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    setFenInput(currentFen);
  }, [currentFen]);

  useEffect(() => {
    setPgnInput(workspace.pgn);
  }, [workspace.pgn]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void window.chessApp.workspace.saveSnapshot({
        orientation,
        selectedEngineIds,
        recentPositions,
        tablebasePath: tablebaseRegistration?.path,
        lastFen: currentFen,
        lastPgn: workspace.pgn,
        multipv: search.multipv,
        mode: search.mode,
        depth: search.depth,
        movetimeMs: search.movetimeMs
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [
    orientation,
    selectedEngineIds,
    recentPositions,
    tablebaseRegistration?.path,
    currentFen,
    workspace.pgn,
    search.multipv,
    search.mode,
    search.depth,
    search.movetimeMs
  ]);

  useEffect(() => {
    if (!analysisActive) {
      return;
    }

    void startAnalysis();
  }, [currentFen, search.multipv, search.mode, search.depth, search.movetimeMs, selectedEngineIds.join("|")]);

  async function loadInitialState() {
    try {
      const [snapshot, availableEngines] = await Promise.all([
        window.chessApp.workspace.getSnapshot(),
        window.chessApp.engines.list()
      ]);

      hydrate({
        engines: availableEngines,
        orientation: snapshot.orientation,
        selectedEngineIds: snapshot.selectedEngineIds,
        recentPositions: snapshot.recentPositions,
        tablebasePath: snapshot.tablebasePath,
        lastFen: snapshot.lastFen,
        mode: snapshot.mode,
        multipv: snapshot.multipv,
        depth: snapshot.depth,
        movetimeMs: snapshot.movetimeMs
      });
    } catch (error) {
      setStatusMessage(getErrorMessage(error));
    }
  }

  async function refreshEngines() {
    try {
      const availableEngines = await window.chessApp.engines.list();
      setEngines(availableEngines);
    } catch (error) {
      setStatusMessage(getErrorMessage(error));
    }
  }

  async function startAnalysis() {
    try {
      const readyEngines = engines.filter(
        (engine) => selectedEngineIds.includes(engine.id) && Boolean(engine.binaryPath)
      );

      if (readyEngines.length === 0) {
        setStatusMessage("Install or select at least one ready engine first.");
        return;
      }

      setAnalysisActive(true);

      const timestamp = Date.now();
      await Promise.all(
        readyEngines.map(async (engine) => {
          const sessionId = `${engine.id}-${timestamp}`;
          setActiveSession(engine.id, sessionId);
          setEngineLines(engine.id, []);

          const request: AnalysisRequest = {
            sessionId,
            fen: currentFen,
            moves: [],
            engineId: engine.id,
            multipv: search.multipv,
            mode: search.mode,
            depth: search.depth,
            movetimeMs: search.movetimeMs
          };

          await window.chessApp.analysis.start(request);
        })
      );
    } catch (error) {
      setAnalysisActive(false);
      setStatusMessage(getErrorMessage(error));
    }
  }

  async function stopAnalysis() {
    try {
      await Promise.all(
        Object.values(activeSessions).map((sessionId) =>
          window.chessApp.analysis.stop(sessionId)
        )
      );
      clearActiveSessions();
      setAnalysisActive(false);
      setStatusMessage("Analysis stopped.");
    } catch (error) {
      setStatusMessage(getErrorMessage(error));
    }
  }

  async function pickTablebases() {
    try {
      const path = await window.chessApp.tablebases.pickDirectory();
      if (!path) {
        return;
      }

      const registration = await window.chessApp.tablebases.register(path);
      setTablebaseRegistration(registration);
      await refreshEngines();
      setStatusMessage(registration.message);
    } catch (error) {
      setStatusMessage(getErrorMessage(error));
    }
  }

  async function probeTablebase() {
    try {
      const probe = await window.chessApp.tablebases.probe(parseFullFen(currentFen));
      setTablebaseProbe(probe);
    } catch (error) {
      setStatusMessage(getErrorMessage(error));
    }
  }

  async function installManaged(kind: "stockfish" | "lc0") {
    try {
      await window.chessApp.engines.installManaged(kind);
      await refreshEngines();
    } catch (error) {
      setStatusMessage(getErrorMessage(error));
    }
  }

  async function addCustomEngine() {
    try {
      const next = await window.chessApp.engines.addCustom();
      setEngines(next);
    } catch (error) {
      setStatusMessage(getErrorMessage(error));
    }
  }

  async function openImageImportFromDisk() {
    try {
      const imagePath = await window.chessApp.boardImport.pickImage();
      if (!imagePath) {
        return;
      }

      openImportModal({
        imagePath,
        imageDataUrl: undefined
      });
    } catch (error) {
      setStatusMessage(getErrorMessage(error));
    }
  }

  async function detectBoardFromDraft() {
    try {
      const request: BoardImportRequest = {
        imagePath: importDraft.imagePath,
        imageDataUrl: importDraft.imageDataUrl,
        rotationDeg: importDraft.rotationDeg,
        crop: importDraft.crop,
        perspectiveCorners: importDraft.perspectiveCorners
      };

      const result = await window.chessApp.boardImport.detect(request);
      setImportResult(result);
      setStatusMessage(
        `Detected placement with ${(result.confidence * 100).toFixed(1)}% confidence.`
      );
    } catch (error) {
      setStatusMessage(getErrorMessage(error));
    }
  }

  return (
    <main className={styles.app}>
      <div className={styles.shell}>
        <header className={styles.masthead}>
          <div>
            <p className={styles.eyebrow}>Jacob Starheim Chess</p>
            <h1 className={styles.title}>Desktop Analysis Workstation</h1>
            <p className={styles.subtitle}>
              Local Stockfish and Lc0 analysis, MultiPV, Syzygy probing, PGN/FEN workflow,
              and board recognition from uploaded photos or live camera capture.
            </p>
          </div>
          <div className={styles.status}>{statusMessage ?? "Ready for analysis."}</div>
        </header>

        <section className={styles.workspace}>
          <BoardPanel
            currentFen={currentFen}
            editorMode={editorMode}
            importResult={importResult}
            onApplyImportedPosition={applyImportedPosition}
            onClearMoves={clearMoves}
            onOpenCamera={() => openCameraModal(true)}
            onOpenImport={() => void openImageImportFromDisk()}
            onPieceDrop={(sourceSquare, targetSquare) => applyMove(sourceSquare, targetSquare)}
            onResetBoard={resetBoard}
            onSelectPiece={setSelectedEditorPiece}
            onSquareClick={editSquare}
            onToggleEditorMode={setEditorMode}
            onToggleOrientation={toggleOrientation}
            onUpdateRootPosition={setRootPositionPatch}
            orientation={orientation}
            rootPosition={rootPosition}
            selectedEditorPiece={selectedEditorPiece}
            statusMessage={statusMessage}
          />

          <NotationPanel
            fenInput={fenInput}
            onApplyFen={() => {
              try {
                replaceFen(fenInput);
                setStatusMessage("FEN applied.");
              } catch (error) {
                setStatusMessage(getErrorMessage(error));
              }
            }}
            onFenInputChange={setFenInput}
            onApplyPgn={() => {
              try {
                loadPgn(pgnInput);
                setStatusMessage("PGN loaded.");
              } catch (error) {
                setStatusMessage(getErrorMessage(error));
              }
            }}
            onLoadRecent={(fen) => {
              try {
                replaceFen(fen);
                setStatusMessage("Recent position loaded.");
              } catch (error) {
                setStatusMessage(getErrorMessage(error));
              }
            }}
            onPgnInputChange={setPgnInput}
            onSaveRecent={() => {
              addRecentPosition();
              setStatusMessage("Position saved to recent snapshots.");
            }}
            pgnInput={pgnInput}
            recentPositions={recentPositions}
            sanMoves={workspace.sanMoves}
          />

          <EnginePanel
            analysisActive={analysisActive}
            engines={engines}
            linesByEngine={engineLines}
            onAddCustom={() => void addCustomEngine()}
            onConfigureEngine={(id, patch) =>
              void window.chessApp.engines.configure(id, patch).then(refreshEngines)
            }
            onInstallManaged={(kind) => void installManaged(kind)}
            onPickTablebases={() => void pickTablebases()}
            onProbeTablebase={() => void probeTablebase()}
            onSetSearch={setSearch}
            onSetSelected={setSelectedEngineIds}
            onStartAnalysis={() => void startAnalysis()}
            onStopAnalysis={() => void stopAnalysis()}
            onUpdateEngine={(id) =>
              void window.chessApp.engines.update(id).then(refreshEngines)
            }
            search={search}
            selectedEngineIds={selectedEngineIds}
            tablebaseProbe={tablebaseProbe}
            tablebaseRegistration={tablebaseRegistration}
          />
        </section>
      </div>

      <BoardImportModal
        draft={importDraft}
        imageDataUrl={importDraft.imageDataUrl}
        imagePath={importDraft.imagePath}
        onChange={updateImportDraft}
        onClose={closeImportModal}
        onDetect={detectBoardFromDraft}
        open={importModalOpen}
      />

      <CameraCaptureModal
        onCaptured={(dataUrl) => {
          openCameraModal(false);
          openImportModal({
            imageDataUrl: dataUrl,
            imagePath: undefined
          });
        }}
        onClose={() => openCameraModal(false)}
        open={cameraModalOpen}
      />
    </main>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
}
