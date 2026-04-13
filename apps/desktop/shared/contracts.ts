export type EngineKind = "stockfish" | "lc0" | "custom";
export type EngineStatus = "missing" | "ready" | "installing" | "error";
export type AnalysisMode = "infinite" | "depth" | "movetime";
export type Orientation = "white" | "black";

export interface EngineDefinition {
  id: string;
  name: string;
  kind: EngineKind;
  managed: boolean;
  version: string;
  binaryPath: string;
  networkPath?: string;
  backend?: string;
  threads: number;
  hashMb: number;
  extraOptions: Record<string, string | number | boolean>;
  syzygyPath?: string;
  status?: EngineStatus;
  lastError?: string;
  lastInstalledAt?: string;
}

export interface AnalysisRequest {
  sessionId: string;
  fen: string;
  moves: string[];
  engineId: string;
  multipv: number;
  mode: AnalysisMode;
  depth?: number;
  movetimeMs?: number;
}

export interface AnalysisLine {
  multipv: number;
  pvSan: string[];
  pvUci: string[];
  scoreCp?: number;
  mateIn?: number;
  depth: number;
  seldepth?: number;
  nodes?: number;
  nps?: number;
  wdl?: [number, number, number];
  engineId: string;
  engineName?: string;
  sessionId: string;
}

export interface AnalysisUpdateEvent {
  type: "analysis:update";
  sessionId: string;
  engineId: string;
  lines: AnalysisLine[];
}

export interface AnalysisStoppedEvent {
  type: "analysis:stopped";
  sessionId: string;
  engineId: string;
}

export interface EngineInstallProgressEvent {
  type: "engine:install-progress";
  engineId: string;
  stage: string;
  message: string;
}

export interface EngineUpdatedEvent {
  type: "engine:updated";
  engine: EngineDefinition;
}

export type DesktopEvent =
  | AnalysisUpdateEvent
  | AnalysisStoppedEvent
  | EngineInstallProgressEvent
  | EngineUpdatedEvent;

export interface NormalizedCorner {
  x: number;
  y: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoardImportRequest {
  imagePath?: string;
  imageDataUrl?: string;
  rotationDeg?: number;
  crop?: CropRect;
  perspectiveCorners?: [
    NormalizedCorner,
    NormalizedCorner,
    NormalizedCorner,
    NormalizedCorner
  ];
}

export interface SquareConfidence {
  square: string;
  confidence: number;
  predictedPiece?: string;
}

export interface BoardImportResult {
  placementFen: string;
  confidence: number;
  orientationGuess: Orientation;
  squareConfidences: SquareConfidence[];
  needsReview: true;
}

export interface PositionSetup {
  placementFen: string;
  sideToMove: "w" | "b";
  castling: string;
  enPassant: string;
  halfmoveClock: number;
  fullmoveNumber: number;
}

export interface TablebaseProbeResult {
  available: boolean;
  wdl: number | null;
  dtz?: number | null;
  bestMovesSan: string[];
  source: "local-syzygy";
  message?: string;
}

export interface TablebaseRegistration {
  path: string;
  available: boolean;
  counts: {
    wdlFiles: number;
    dtzFiles: number;
  };
  coverage: string[];
  message?: string;
}

export interface RecentPosition {
  label: string;
  fen: string;
  updatedAt: string;
}

export interface WorkspaceSnapshot {
  orientation: Orientation;
  selectedEngineIds: string[];
  recentPositions: RecentPosition[];
  tablebasePath?: string;
  lastFen?: string;
  lastPgn?: string;
  multipv: number;
  mode: AnalysisMode;
  depth?: number;
  movetimeMs?: number;
}

export interface InstallManagedResult {
  engine: EngineDefinition;
}

export interface DesktopApi {
  engines: {
    list: () => Promise<EngineDefinition[]>;
    installManaged: (kind: Extract<EngineKind, "stockfish" | "lc0">) => Promise<InstallManagedResult>;
    addCustom: () => Promise<EngineDefinition[]>;
    configure: (id: string, patch: Partial<EngineDefinition>) => Promise<EngineDefinition>;
    update: (id: string) => Promise<InstallManagedResult>;
  };
  analysis: {
    start: (request: AnalysisRequest) => Promise<void>;
    stop: (sessionId: string) => Promise<void>;
  };
  boardImport: {
    pickImage: () => Promise<string | null>;
    detect: (request: BoardImportRequest) => Promise<BoardImportResult>;
  };
  tablebases: {
    pickDirectory: () => Promise<string | null>;
    register: (path: string) => Promise<TablebaseRegistration>;
    probe: (position: PositionSetup) => Promise<TablebaseProbeResult>;
  };
  workspace: {
    getSnapshot: () => Promise<WorkspaceSnapshot>;
    saveSnapshot: (snapshot: WorkspaceSnapshot) => Promise<void>;
  };
  events: {
    subscribe: (listener: (event: DesktopEvent) => void) => () => void;
  };
}

export const IPC_CHANNELS = {
  LIST_ENGINES: "engines:list",
  INSTALL_MANAGED_ENGINE: "engines:installManaged",
  ADD_CUSTOM_ENGINE: "engines:addCustom",
  CONFIGURE_ENGINE: "engines:configure",
  UPDATE_ENGINE: "engines:update",
  START_ANALYSIS: "analysis:start",
  STOP_ANALYSIS: "analysis:stop",
  PICK_IMPORT_IMAGE: "boardImport:pickImage",
  IMPORT_BOARD: "boardImport:detect",
  PICK_TABLEBASE_DIR: "tablebases:pickDirectory",
  REGISTER_TABLEBASES: "tablebases:register",
  PROBE_TABLEBASE: "tablebases:probe",
  GET_WORKSPACE_SNAPSHOT: "workspace:getSnapshot",
  SAVE_WORKSPACE_SNAPSHOT: "workspace:saveSnapshot",
  EVENT: "desktop:event"
} as const;
