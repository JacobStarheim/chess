import { basename, join } from "node:path";
import { WebContents } from "electron";
import type {
  AnalysisRequest,
  DesktopEvent,
  EngineDefinition,
  InstallManagedResult,
  WorkspaceSnapshot
} from "@shared/contracts";
import { JsonStore } from "./app-store";
import { EngineSession } from "./engine-session";
import { ManagedInstaller } from "./managed-installer";

interface PersistedState {
  engines: EngineDefinition[];
  workspace: WorkspaceSnapshot;
}

export class EngineManager {
  private readonly sessions = new Map<string, EngineSession>();
  private webContents: WebContents | null = null;

  constructor(
    private readonly store: JsonStore<PersistedState>,
    private readonly managedRoot: string
  ) {}

  attachWebContents(webContents: WebContents): void {
    this.webContents = webContents;
  }

  async listEngines(): Promise<EngineDefinition[]> {
    const state = await this.ensureDefaults();
    return state.engines;
  }

  async installManaged(
    kind: "stockfish" | "lc0"
  ): Promise<InstallManagedResult> {
    const installer = new ManagedInstaller(this.managedRoot, (stage, message) => {
      this.emit({
        type: "engine:install-progress",
        engineId: kind,
        stage,
        message
      });
    });

    const engine = kind === "stockfish"
      ? await installer.installStockfish()
      : await installer.installLc0();

    await this.store.update((current) => ({
      ...current,
      engines: upsertEngine(current.engines, engine)
    }));

    this.emit({
      type: "engine:updated",
      engine
    });

    return { engine };
  }

  async addCustomEngine(binaryPath: string): Promise<EngineDefinition[]> {
    const id = `custom-${basename(binaryPath).replaceAll(/\W+/g, "-").toLowerCase()}`;
    const customEngine: EngineDefinition = {
      id,
      name: basename(binaryPath),
      kind: "custom",
      managed: false,
      version: "manual",
      binaryPath,
      threads: 6,
      hashMb: 1024,
      extraOptions: {},
      status: "ready"
    };

    const next = await this.store.update((current) => ({
      ...current,
      engines: upsertEngine(current.engines, customEngine)
    }));

    this.emit({
      type: "engine:updated",
      engine: customEngine
    });

    return next.engines;
  }

  async configureEngine(
    id: string,
    patch: Partial<EngineDefinition>
  ): Promise<EngineDefinition> {
    const next = await this.store.update((current) => ({
      ...current,
      engines: current.engines.map((engine) =>
        engine.id === id
          ? {
              ...engine,
              ...patch,
              extraOptions: {
                ...engine.extraOptions,
                ...patch.extraOptions
              }
            }
          : engine
      )
    }));

    const engine = next.engines.find((candidate) => candidate.id === id);
    if (!engine) {
      throw new Error(`Engine ${id} was not found.`);
    }

    const session = this.sessions.get(id);
    if (session) {
      await session.dispose();
      this.sessions.delete(id);
    }

    this.emit({
      type: "engine:updated",
      engine
    });

    return engine;
  }

  async updateEngine(id: string): Promise<InstallManagedResult> {
    if (id === "stockfish" || id === "lc0") {
      return this.installManaged(id);
    }

    throw new Error("Only managed engines support update.");
  }

  async startAnalysis(request: AnalysisRequest): Promise<void> {
    const engines = await this.listEngines();
    const engine = engines.find((candidate) => candidate.id === request.engineId);
    if (!engine || !engine.binaryPath) {
      throw new Error(`Engine ${request.engineId} is not installed.`);
    }

    let session = this.sessions.get(engine.id);
    if (!session) {
      session = new EngineSession({
        engine,
        onLines: (sessionId, lines) => {
          this.emit({
            type: "analysis:update",
            engineId: engine.id,
            sessionId,
            lines
          });
        },
        onStop: (sessionId) => {
          this.emit({
            type: "analysis:stopped",
            engineId: engine.id,
            sessionId
          });
        }
      });
      this.sessions.set(engine.id, session);
    }

    await session.analyze(request);
  }

  async stopAnalysis(sessionId: string): Promise<void> {
    await Promise.all(
      Array.from(this.sessions.values()).map((session) => session.stop(sessionId))
    );
  }

  async dispose(): Promise<void> {
    await Promise.all(
      Array.from(this.sessions.values()).map((session) => session.dispose())
    );
    this.sessions.clear();
  }

  private emit(event: DesktopEvent): void {
    this.webContents?.send("desktop:event", event);
  }

  private async ensureDefaults(): Promise<PersistedState> {
    return this.store.update((current) => {
      if (current.engines.length > 0) {
        return current;
      }

      return {
        ...current,
        engines: [
          {
            id: "stockfish",
            name: "Stockfish",
            kind: "stockfish",
            managed: true,
            version: "not-installed",
            binaryPath: "",
            threads: 6,
            hashMb: 2048,
            extraOptions: {},
            status: "missing"
          },
          {
            id: "lc0",
            name: "Lc0",
            kind: "lc0",
            managed: true,
            version: "not-installed",
            binaryPath: "",
            threads: 6,
            hashMb: 1024,
            backend: "metal",
            extraOptions: {},
            status: "missing"
          }
        ]
      };
    });
  }
}

function upsertEngine(
  engines: EngineDefinition[],
  incoming: EngineDefinition
): EngineDefinition[] {
  const existing = engines.some((engine) => engine.id === incoming.id);
  if (!existing) {
    return [...engines, incoming];
  }

  return engines.map((engine) => (engine.id === incoming.id ? incoming : engine));
}

export function createInitialPersistedState(): PersistedState {
  return {
    engines: [],
    workspace: {
      orientation: "white",
      selectedEngineIds: ["stockfish", "lc0"],
      recentPositions: [],
      multipv: 3,
      mode: "infinite",
      depth: 18,
      movetimeMs: 1500
    }
  };
}

export function resolveManagedRoot(projectRoot: string): string {
  return join(projectRoot, "assets", "engines");
}
