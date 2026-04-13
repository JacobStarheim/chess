import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  IPC_CHANNELS,
  type AnalysisRequest,
  type BoardImportRequest,
  type EngineDefinition,
  type PositionSetup,
  type WorkspaceSnapshot
} from "@shared/contracts";
import { JsonStore } from "./services/app-store";
import {
  createInitialPersistedState,
  EngineManager,
  resolveManagedRoot
} from "./services/engine-manager";
import { registerTablebases } from "./services/tablebases";
import { VisionClient } from "./services/vision-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..", "..", "..", "..");

const persistedStatePath = join(
  app.getPath("userData"),
  "workspace-state.json"
);
const store = new JsonStore(persistedStatePath, createInitialPersistedState());
const engineManager = new EngineManager(store, resolveManagedRoot(projectRoot));
const visionClient = new VisionClient(projectRoot);

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: "#11110e",
    title: "Jacob Starheim Chess",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  engineManager.attachWebContents(window.webContents);

  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("[renderer] process gone", details);
  });

  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("[renderer] did-fail-load", {
      errorCode,
      errorDescription,
      validatedURL
    });
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await window.loadFile(join(projectRoot, "apps", "desktop", "out", "renderer", "index.html"));
  }
}

app.whenReady().then(async () => {
  registerIpc();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  await engineManager.dispose();
  visionClient.dispose();
});

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.LIST_ENGINES, async () => engineManager.listEngines());

  ipcMain.handle(
    IPC_CHANNELS.INSTALL_MANAGED_ENGINE,
    async (_event, kind: "stockfish" | "lc0") => engineManager.installManaged(kind)
  );

  ipcMain.handle(IPC_CHANNELS.ADD_CUSTOM_ENGINE, async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      title: "Choose a UCI engine binary"
    });

    if (result.canceled || result.filePaths.length === 0) {
      return engineManager.listEngines();
    }

    return engineManager.addCustomEngine(result.filePaths[0]);
  });

  ipcMain.handle(
    IPC_CHANNELS.CONFIGURE_ENGINE,
    async (_event, id: string, patch: Partial<EngineDefinition>) =>
      engineManager.configureEngine(id, patch)
  );

  ipcMain.handle(IPC_CHANNELS.UPDATE_ENGINE, async (_event, id: string) =>
    engineManager.updateEngine(id)
  );

  ipcMain.handle(
    IPC_CHANNELS.START_ANALYSIS,
    async (_event, request: AnalysisRequest) => engineManager.startAnalysis(request)
  );

  ipcMain.handle(
    IPC_CHANNELS.STOP_ANALYSIS,
    async (_event, sessionId: string) => engineManager.stopAnalysis(sessionId)
  );

  ipcMain.handle(IPC_CHANNELS.PICK_IMPORT_IMAGE, async () => {
    const result = await dialog.showOpenDialog({
      title: "Choose a board image",
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle(
    IPC_CHANNELS.IMPORT_BOARD,
    async (_event, request: BoardImportRequest) => visionClient.importBoard(request)
  );

  ipcMain.handle(IPC_CHANNELS.PICK_TABLEBASE_DIR, async () => {
    const result = await dialog.showOpenDialog({
      title: "Choose a Syzygy folder",
      properties: ["openDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.REGISTER_TABLEBASES, async (_event, path: string) => {
    const registration = await registerTablebases(path);
    if (registration.available) {
      await store.update((current) => ({
        ...current,
        workspace: {
          ...current.workspace,
          tablebasePath: path
        },
        engines: current.engines.map((engine) => ({
          ...engine,
          syzygyPath: path
        }))
      }));
    }

    return registration;
  });

  ipcMain.handle(
    IPC_CHANNELS.PROBE_TABLEBASE,
    async (_event, position: PositionSetup) => {
      const state = await store.read();
      if (!state.workspace.tablebasePath) {
        return {
          available: false,
          wdl: null,
          bestMovesSan: [],
          source: "local-syzygy" as const,
          message: "No tablebase directory has been registered yet."
        };
      }

      return visionClient.probeTablebase(state.workspace.tablebasePath, position);
    }
  );

  ipcMain.handle(IPC_CHANNELS.GET_WORKSPACE_SNAPSHOT, async () => {
    const state = await store.read();
    return state.workspace;
  });

  ipcMain.handle(
    IPC_CHANNELS.SAVE_WORKSPACE_SNAPSHOT,
    async (_event, snapshot: WorkspaceSnapshot) =>
      store.update((current) => ({
        ...current,
        workspace: snapshot
      }))
  );
}
