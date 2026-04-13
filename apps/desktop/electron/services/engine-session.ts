import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { once } from "node:events";
import type { AnalysisLine, AnalysisRequest, EngineDefinition } from "@shared/contracts";
import { formatAnalysisLine, parseInfoLine } from "./uci";

interface EngineSessionOptions {
  engine: EngineDefinition;
  onLines: (sessionId: string, lines: AnalysisLine[]) => void;
  onStop: (sessionId: string) => void;
}

export class EngineSession {
  private process: ChildProcessWithoutNullStreams | null = null;
  private readonly optionNames = new Set<string>();
  private readonly lines = new Map<number, AnalysisLine>();
  private currentFen = "startpos";
  private currentSessionId: string | null = null;
  private initialized = false;

  constructor(private readonly options: EngineSessionOptions) {}

  async analyze(request: AnalysisRequest): Promise<void> {
    await this.ensureReady();
    this.currentFen = request.fen;
    this.currentSessionId = request.sessionId;
    this.lines.clear();

    await this.send("stop");
    await this.send("isready");
    await this.waitForReadyOk();

    await this.applyDynamicOptions(request);
    await this.send(`position fen ${request.fen}`);
    await this.send(buildGoCommand(request));
  }

  async stop(sessionId?: string): Promise<void> {
    if (!this.process) {
      return;
    }

    await this.send("stop");
    this.lines.clear();
    if (sessionId && this.currentSessionId === sessionId) {
      this.options.onStop(sessionId);
    }
  }

  async dispose(): Promise<void> {
    if (!this.process) {
      return;
    }

    await this.send("quit");
    this.process.kill();
    this.process = null;
    this.initialized = false;
  }

  private async ensureReady(): Promise<void> {
    if (this.process && this.initialized) {
      return;
    }

    this.process = spawn(this.options.engine.binaryPath, [], {
      env: process.env
    });

    let buffer = "";
    this.process.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        this.handleLine(line.trim());
      }
    });

    this.process.stderr.on("data", (chunk) => {
      console.error(`[${this.options.engine.name}]`, chunk.toString("utf8"));
    });

    this.process.on("exit", () => {
      this.process = null;
      this.initialized = false;
      if (this.currentSessionId) {
        this.options.onStop(this.currentSessionId);
      }
    });

    await once(this.process, "spawn");
    const uciReady = this.waitForUciOk();
    await this.send("uci");
    await uciReady;
    await this.applyStaticOptions();
    this.initialized = true;
  }

  private readonly readyWaiters: Array<() => void> = [];
  private readonly uciWaiters: Array<() => void> = [];

  private handleLine(line: string): void {
    if (!line) {
      return;
    }

    if (line.startsWith("option name ")) {
      const name = line
        .replace(/^option name\s+/i, "")
        .split(/\s+type\s+/i)[0]
        .trim();
      this.optionNames.add(name);
      return;
    }

    if (line === "uciok") {
      this.uciWaiters.splice(0).forEach((resolve) => resolve());
      return;
    }

    if (line === "readyok") {
      this.readyWaiters.splice(0).forEach((resolve) => resolve());
      return;
    }

    if (line.startsWith("bestmove") && this.currentSessionId) {
      this.options.onStop(this.currentSessionId);
      return;
    }

    const parsed = parseInfoLine(line);
    if (!parsed || !this.currentSessionId) {
      return;
    }

    const formatted = formatAnalysisLine(
      this.currentFen,
      this.options.engine.id,
      this.options.engine.name,
      this.currentSessionId,
      parsed
    );

    this.lines.set(formatted.multipv, formatted);
    const sorted = Array.from(this.lines.values()).sort(
      (left, right) => left.multipv - right.multipv
    );
    this.options.onLines(this.currentSessionId, sorted);
  }

  private async applyStaticOptions(): Promise<void> {
    await this.setOptionIfPresent("Threads", this.options.engine.threads);
    await this.setOptionIfPresent("Hash", this.options.engine.hashMb);
    await this.setOptionIfPresent("SyzygyPath", this.options.engine.syzygyPath);
    await this.setOptionIfPresent("WeightsFile", this.options.engine.networkPath);
    await this.setOptionIfPresent("Backend", this.options.engine.backend);

    for (const [key, value] of Object.entries(
      this.options.engine.extraOptions
    ) as Array<[string, string | number | boolean]>) {
      await this.setOptionIfPresent(key, value);
    }

    const ready = this.waitForReadyOk();
    await this.send("isready");
    await ready;
  }

  private async applyDynamicOptions(request: AnalysisRequest): Promise<void> {
    await this.setOptionIfPresent("MultiPV", request.multipv);
    const ready = this.waitForReadyOk();
    await this.send("isready");
    await ready;
  }

  private async setOptionIfPresent(
    name: string,
    value: string | number | boolean | undefined
  ): Promise<void> {
    if (value === undefined || !this.optionNames.has(name)) {
      return;
    }

    await this.send(`setoption name ${name} value ${value}`);
  }

  private async send(command: string): Promise<void> {
    this.process?.stdin.write(command + "\n");
  }

  private async waitForReadyOk(): Promise<void> {
    if (!this.process) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.readyWaiters.push(resolve);
    });
  }

  private async waitForUciOk(): Promise<void> {
    if (!this.process) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.uciWaiters.push(resolve);
    });
  }
}

function buildGoCommand(request: AnalysisRequest): string {
  switch (request.mode) {
    case "depth":
      return `go depth ${request.depth ?? 18}`;
    case "movetime":
      return `go movetime ${request.movetimeMs ?? 1500}`;
    default:
      return "go infinite";
  }
}
