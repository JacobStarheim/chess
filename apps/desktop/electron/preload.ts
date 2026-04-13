import { contextBridge, ipcRenderer } from "electron";
import type {
  DesktopApi,
  DesktopEvent,
  EngineDefinition,
  InstallManagedResult,
  WorkspaceSnapshot
} from "@shared/contracts";
import { IPC_CHANNELS } from "@shared/contracts";

const api: DesktopApi = {
  engines: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.LIST_ENGINES),
    installManaged: (kind) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.INSTALL_MANAGED_ENGINE,
        kind
      ) as Promise<InstallManagedResult>,
    addCustom: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.ADD_CUSTOM_ENGINE
      ) as Promise<EngineDefinition[]>,
    configure: (id, patch) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.CONFIGURE_ENGINE,
        id,
        patch
      ) as Promise<EngineDefinition>,
    update: (id) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.UPDATE_ENGINE,
        id
      ) as Promise<InstallManagedResult>
  },
  analysis: {
    start: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.START_ANALYSIS, request),
    stop: (sessionId) =>
      ipcRenderer.invoke(IPC_CHANNELS.STOP_ANALYSIS, sessionId)
  },
  boardImport: {
    pickImage: () => ipcRenderer.invoke(IPC_CHANNELS.PICK_IMPORT_IMAGE),
    detect: (request) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_BOARD, request)
  },
  tablebases: {
    pickDirectory: () =>
      ipcRenderer.invoke(IPC_CHANNELS.PICK_TABLEBASE_DIR),
    register: (path) =>
      ipcRenderer.invoke(IPC_CHANNELS.REGISTER_TABLEBASES, path),
    probe: (position) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROBE_TABLEBASE, position)
  },
  workspace: {
    getSnapshot: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.GET_WORKSPACE_SNAPSHOT
      ) as Promise<WorkspaceSnapshot>,
    saveSnapshot: (snapshot) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.SAVE_WORKSPACE_SNAPSHOT,
        snapshot
      )
  },
  events: {
    subscribe: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: DesktopEvent) => {
        listener(payload);
      };
      ipcRenderer.on(IPC_CHANNELS.EVENT, wrapped);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.EVENT, wrapped);
      };
    }
  }
};

contextBridge.exposeInMainWorld("chessApp", api);
