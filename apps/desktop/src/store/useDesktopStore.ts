import { create } from "zustand";
import type {
  AnalysisLine,
  AnalysisMode,
  BoardImportResult,
  EngineDefinition,
  Orientation,
  PositionSetup,
  RecentPosition,
  TablebaseProbeResult,
  TablebaseRegistration
} from "@shared/contracts";
import {
  deriveWorkspace,
  describePosition,
  loadPgnState,
  parseFullFen,
  setSquarePiece,
  START_POSITION,
  tryApplyMove,
  type EditorPiece
} from "@/lib/chess-workspace";

interface SearchSettings {
  multipv: number;
  mode: AnalysisMode;
  depth: number;
  movetimeMs: number;
}

interface ImportDraft {
  imagePath?: string;
  imageDataUrl?: string;
  rotationDeg: number;
  crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  perspectiveCorners: [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number }
  ];
}

interface DesktopState {
  engines: EngineDefinition[];
  selectedEngineIds: string[];
  orientation: Orientation;
  rootPosition: PositionSetup;
  moveHistory: string[];
  search: SearchSettings;
  editorMode: boolean;
  selectedEditorPiece: EditorPiece;
  engineLines: Record<string, AnalysisLine[]>;
  activeSessions: Record<string, string>;
  analysisActive: boolean;
  recentPositions: RecentPosition[];
  tablebasePath?: string;
  tablebaseRegistration?: TablebaseRegistration;
  tablebaseProbe?: TablebaseProbeResult;
  importModalOpen: boolean;
  importDraft: ImportDraft;
  importResult?: BoardImportResult;
  cameraModalOpen: boolean;
  statusMessage?: string;
  hydrate: (payload: {
    engines: EngineDefinition[];
    orientation: Orientation;
    selectedEngineIds: string[];
    recentPositions: RecentPosition[];
    tablebasePath?: string;
    lastFen?: string;
    mode: AnalysisMode;
    multipv: number;
    depth?: number;
    movetimeMs?: number;
  }) => void;
  setEngines: (engines: EngineDefinition[]) => void;
  setSelectedEngineIds: (engineIds: string[]) => void;
  toggleOrientation: () => void;
  setSearch: (patch: Partial<SearchSettings>) => void;
  setEditorMode: (enabled: boolean) => void;
  setSelectedEditorPiece: (piece: EditorPiece) => void;
  applyMove: (from: string, to: string, promotion?: string) => boolean;
  replaceFen: (fen: string) => void;
  loadPgn: (pgn: string) => void;
  resetBoard: () => void;
  clearMoves: () => void;
  editSquare: (square: string) => void;
  setRootPositionPatch: (patch: Partial<PositionSetup>) => void;
  setEngineLines: (engineId: string, lines: AnalysisLine[]) => void;
  setActiveSession: (engineId: string, sessionId: string) => void;
  clearActiveSessions: () => void;
  setAnalysisActive: (active: boolean) => void;
  addRecentPosition: () => void;
  setTablebaseRegistration: (registration: TablebaseRegistration) => void;
  setTablebaseProbe: (probe?: TablebaseProbeResult) => void;
  openImportModal: (patch?: Partial<ImportDraft>) => void;
  closeImportModal: () => void;
  updateImportDraft: (patch: Partial<ImportDraft>) => void;
  setImportResult: (result?: BoardImportResult) => void;
  applyImportedPosition: () => void;
  openCameraModal: (open: boolean) => void;
  setStatusMessage: (message?: string) => void;
}

const DEFAULT_IMPORT_DRAFT: ImportDraft = {
  rotationDeg: 0,
  crop: {
    x: 0,
    y: 0,
    width: 1,
    height: 1
  },
  perspectiveCorners: [
    { x: 0.08, y: 0.08 },
    { x: 0.92, y: 0.08 },
    { x: 0.92, y: 0.92 },
    { x: 0.08, y: 0.92 }
  ]
};

export const useDesktopStore = create<DesktopState>((set, get) => ({
  engines: [],
  selectedEngineIds: ["stockfish", "lc0"],
  orientation: "white",
  rootPosition: START_POSITION,
  moveHistory: [],
  search: {
    multipv: 3,
    mode: "infinite",
    depth: 18,
    movetimeMs: 1500
  },
  editorMode: false,
  selectedEditorPiece: "Q",
  engineLines: {},
  activeSessions: {},
  analysisActive: false,
  recentPositions: [],
  importModalOpen: false,
  importDraft: DEFAULT_IMPORT_DRAFT,
  cameraModalOpen: false,
  hydrate: (payload) =>
    set(() => ({
      engines: payload.engines,
      selectedEngineIds: payload.selectedEngineIds,
      orientation: payload.orientation,
      recentPositions: payload.recentPositions,
      tablebasePath: payload.tablebasePath,
      search: {
        multipv: payload.multipv,
        mode: payload.mode,
        depth: payload.depth ?? 18,
        movetimeMs: payload.movetimeMs ?? 1500
      },
      rootPosition: payload.lastFen ? parseFullFen(payload.lastFen) : START_POSITION
    })),
  setEngines: (engines) => set(() => ({ engines })),
  setSelectedEngineIds: (selectedEngineIds) => set(() => ({ selectedEngineIds })),
  toggleOrientation: () =>
    set((state) => ({
      orientation: state.orientation === "white" ? "black" : "white"
    })),
  setSearch: (patch) =>
    set((state) => ({
      search: {
        ...state.search,
        ...patch
      }
    })),
  setEditorMode: (editorMode) => set(() => ({ editorMode })),
  setSelectedEditorPiece: (selectedEditorPiece) =>
    set(() => ({ selectedEditorPiece })),
  applyMove: (from, to, promotion) => {
    const next = tryApplyMove(
      get().rootPosition,
      get().moveHistory,
      from,
      to,
      promotion
    );

    if (!next) {
      return false;
    }

    set(() => ({ moveHistory: next }));
    return true;
  },
  replaceFen: (fen) =>
    set(() => ({
      rootPosition: parseFullFen(fen),
      moveHistory: []
    })),
  loadPgn: (pgn) => {
    const loaded = loadPgnState(pgn);
    set(() => ({
      rootPosition: loaded.rootPosition,
      moveHistory: loaded.moveHistory
    }));
  },
  resetBoard: () =>
    set(() => ({
      rootPosition: START_POSITION,
      moveHistory: []
    })),
  clearMoves: () =>
    set(() => ({
      moveHistory: []
    })),
  editSquare: (square) =>
    set((state) => ({
      rootPosition: {
        ...state.rootPosition,
        placementFen: setSquarePiece(
          state.rootPosition.placementFen,
          square,
          state.selectedEditorPiece
        )
      },
      moveHistory: []
    })),
  setRootPositionPatch: (patch) =>
    set((state) => ({
      rootPosition: {
        ...state.rootPosition,
        ...patch
      }
    })),
  setEngineLines: (engineId, lines) =>
    set((state) => ({
      engineLines: {
        ...state.engineLines,
        [engineId]: lines
      }
    })),
  setActiveSession: (engineId, sessionId) =>
    set((state) => ({
      activeSessions: {
        ...state.activeSessions,
        [engineId]: sessionId
      }
    })),
  clearActiveSessions: () => set(() => ({ activeSessions: {} })),
  setAnalysisActive: (analysisActive) => set(() => ({ analysisActive })),
  addRecentPosition: () =>
    set((state) => {
      const currentFen = deriveWorkspace(state.rootPosition, state.moveHistory).currentFen;
      const entry = {
        label: describePosition(state.rootPosition, state.moveHistory),
        fen: currentFen,
        updatedAt: new Date().toISOString()
      };

      return {
        recentPositions: [entry, ...state.recentPositions].slice(0, 8)
      };
    }),
  setTablebaseRegistration: (tablebaseRegistration) =>
    set(() => ({
      tablebaseRegistration,
      tablebasePath: tablebaseRegistration.path
    })),
  setTablebaseProbe: (tablebaseProbe) => set(() => ({ tablebaseProbe })),
  openImportModal: (patch) =>
    set((state) => ({
      importModalOpen: true,
      importDraft: {
        ...DEFAULT_IMPORT_DRAFT,
        ...state.importDraft,
        ...patch
      }
    })),
  closeImportModal: () => set(() => ({ importModalOpen: false })),
  updateImportDraft: (patch) =>
    set((state) => ({
      importDraft: {
        ...state.importDraft,
        ...patch
      }
    })),
  setImportResult: (importResult) => set(() => ({ importResult })),
  applyImportedPosition: () =>
    set((state) => ({
      rootPosition: {
        ...state.rootPosition,
        placementFen: state.importResult?.placementFen ?? state.rootPosition.placementFen
      },
      moveHistory: [],
      editorMode: true,
      importModalOpen: false
    })),
  openCameraModal: (cameraModalOpen) => set(() => ({ cameraModalOpen })),
  setStatusMessage: (statusMessage) => set(() => ({ statusMessage }))
}));
