import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { join } from "node:path";
import type {
  BoardImportRequest,
  BoardImportResult,
  PositionSetup,
  TablebaseProbeResult
} from "@shared/contracts";

type WorkerRequest =
  | {
      id: string;
      method: "import_board";
      params: BoardImportRequest;
    }
  | {
      id: string;
      method: "probe_tablebase";
      params: {
        path: string;
        position: PositionSetup;
      };
    };

type WorkerResponse<T> = {
  id: string;
  result?: T;
  error?: string;
};

export class VisionClient {
  private process: ChildProcessWithoutNullStreams | null = null;
  private readonly pending = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor(private readonly projectRoot: string) {}

  async importBoard(
    request: BoardImportRequest
  ): Promise<BoardImportResult> {
    return this.request<BoardImportResult>({
      id: randomUUID(),
      method: "import_board",
      params: request
    });
  }

  async probeTablebase(
    path: string,
    position: PositionSetup
  ): Promise<TablebaseProbeResult> {
    return this.request<TablebaseProbeResult>({
      id: randomUUID(),
      method: "probe_tablebase",
      params: { path, position }
    });
  }

  dispose(): void {
    this.process?.kill();
    this.process = null;
  }

  private async request<T>(payload: WorkerRequest): Promise<T> {
    await this.ensureProcess();

    return new Promise<T>((resolve, reject) => {
      this.pending.set(payload.id, {
        resolve: resolve as (value: unknown) => void,
        reject
      });
      this.process?.stdin.write(JSON.stringify(payload) + "\n");
    });
  }

  private async ensureProcess(): Promise<void> {
    if (this.process) {
      return;
    }

    const serviceRoot = join(this.projectRoot, "services", "vision");
    const pythonExecutable = await resolvePythonExecutable(serviceRoot);
    this.process = spawn(
      pythonExecutable,
      ["-m", "vision_worker.worker"],
      {
        cwd: serviceRoot,
        env: {
          ...process.env,
          PYTHONPATH: [serviceRoot, join(serviceRoot, ".vendor")]
            .filter(Boolean)
            .join(":")
        }
      }
    );

    let buffer = "";

    this.process.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const response = JSON.parse(line) as WorkerResponse<unknown>;
        const pending = this.pending.get(response.id);
        if (!pending) {
          continue;
        }

        this.pending.delete(response.id);
        if (response.error) {
          pending.reject(new Error(response.error));
        } else {
          pending.resolve(response.result);
        }
      }
    });

    this.process.stderr.on("data", (chunk) => {
      console.error("[vision-worker]", chunk.toString("utf8"));
    });

    this.process.on("exit", () => {
      for (const [, request] of this.pending) {
        request.reject(new Error("Vision worker exited unexpectedly"));
      }
      this.pending.clear();
      this.process = null;
    });
  }
}

async function resolvePythonExecutable(serviceRoot: string): Promise<string> {
  const venvPython = join(serviceRoot, ".venv", "bin", "python");
  try {
    await access(venvPython);
    return venvPython;
  } catch (_error) {
    return "python3";
  }
}
