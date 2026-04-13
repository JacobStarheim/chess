import { createWriteStream } from "node:fs";
import { chmod, mkdir, readdir, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { dirname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { EngineDefinition } from "@shared/contracts";

const execFileAsync = promisify(execFile);

interface DownloadAsset {
  url: string;
  version: string;
}

export class ManagedInstaller {
  constructor(
    private readonly rootDir: string,
    private readonly onProgress: (stage: string, message: string) => void
  ) {}

  async installStockfish(): Promise<EngineDefinition> {
    const asset = await this.resolveStockfishAsset();
    return this.installArchive({
      id: "stockfish",
      name: "Stockfish",
      kind: "stockfish",
      asset,
      executablePattern: /^stockfish(?:-macos.*)?$/i
    });
  }

  async installLc0(): Promise<EngineDefinition> {
    const asset = await this.resolveLc0Asset();
    return this.installArchive({
      id: "lc0",
      name: "Lc0",
      kind: "lc0",
      asset,
      executablePattern: /lc0$/i,
      networkPattern: /\.(pb|pb\.gz)$/i,
      backend: "metal"
    });
  }

  private async installArchive(options: {
    id: "stockfish" | "lc0";
    name: string;
    kind: "stockfish" | "lc0";
    asset: DownloadAsset;
    executablePattern: RegExp;
    networkPattern?: RegExp;
    backend?: string;
  }): Promise<EngineDefinition> {
    const downloadDir = join(this.rootDir, "downloads");
    const installDir = join(this.rootDir, "managed", options.id, options.asset.version);
    const archivePath = join(
      downloadDir,
      `${options.id}-${options.asset.version}${archiveSuffixForUrl(options.asset.url)}`
    );

    this.onProgress("prepare", `Preparing ${options.name} directories`);
    await mkdir(downloadDir, { recursive: true });
    await rm(installDir, { recursive: true, force: true });
    await mkdir(installDir, { recursive: true });

    this.onProgress("download", `Downloading ${options.name} ${options.asset.version}`);
    await downloadFile(options.asset.url, archivePath);

    this.onProgress("extract", `Extracting ${options.name}`);
    await extractArchive(archivePath, installDir);

    const executablePath = await findFirstMatch(installDir, options.executablePattern);
    if (!executablePath) {
      throw new Error(`Could not locate the ${options.name} executable after extraction.`);
    }

    await chmod(executablePath, 0o755);

    const networkPath = options.networkPattern
      ? await findFirstMatch(installDir, options.networkPattern)
      : undefined;

    return {
      id: options.id,
      name: options.name,
      kind: options.kind,
      managed: true,
      version: options.asset.version,
      binaryPath: executablePath,
      networkPath: networkPath ?? undefined,
      backend: options.backend,
      threads: 6,
      hashMb: options.kind === "stockfish" ? 2048 : 1024,
      extraOptions: {},
      status: "ready",
      lastInstalledAt: new Date().toISOString()
    };
  }

  private async resolveStockfishAsset(): Promise<DownloadAsset> {
    const response = await fetch("https://stockfishchess.org/download/");
    const html = await response.text();
    const version = html.match(/Download Stockfish ([0-9.]+)/i)?.[1] ?? "latest";
    const url = findLink(html, (href) =>
      (href.endsWith(".zip") || href.endsWith(".tar") || href.endsWith(".tar.gz")) &&
      href.toLowerCase().includes("stockfish") &&
      href.toLowerCase().includes("macos") &&
      (href.toLowerCase().includes("apple-silicon") || href.toLowerCase().includes("m1"))
    );

    if (!url) {
      throw new Error("Could not resolve the Stockfish Apple Silicon download URL.");
    }

    return {
      url,
      version
    };
  }

  private async resolveLc0Asset(): Promise<DownloadAsset> {
    const githubResponse = await fetch("https://api.github.com/repos/LeelaChessZero/lc0/releases/latest");
    const release = (await githubResponse.json()) as {
      tag_name: string;
      assets: Array<{ browser_download_url: string; name: string }>;
    };

    const asset = release.assets.find((candidate) => {
      const name = candidate.name.toLowerCase();
      return name.endsWith(".zip") && name.includes("mac");
    });

    if (!asset) {
      throw new Error("Could not resolve the latest Lc0 macOS release.");
    }

    return {
      url: asset.browser_download_url,
      version: release.tag_name.replace(/^v/i, "")
    };
  }
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed for ${url}`);
  }

  await pipeline(
    Readable.fromWeb(response.body as any),
    createWriteStream(outputPath)
  );
}

async function findFirstMatch(
  directory: string,
  pattern: RegExp
): Promise<string | null> {
  const queue = [directory];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (pattern.test(entry.name)) {
        return fullPath;
      }
    }
  }

  return null;
}

async function extractArchive(
  archivePath: string,
  outputDir: string
): Promise<void> {
  if (archivePath.endsWith(".zip")) {
    await execFileAsync("/usr/bin/ditto", ["-x", "-k", archivePath, outputDir]);
    return;
  }

  if (archivePath.endsWith(".tar") || archivePath.endsWith(".tar.gz") || archivePath.endsWith(".tgz")) {
    await execFileAsync("/usr/bin/tar", ["-xf", archivePath, "-C", outputDir]);
    return;
  }

  throw new Error(`Unsupported archive format for ${archivePath}`);
}

function archiveSuffixForUrl(url: string): string {
  if (url.endsWith(".tar.gz")) {
    return ".tar.gz";
  }

  if (url.endsWith(".tgz")) {
    return ".tgz";
  }

  if (url.endsWith(".tar")) {
    return ".tar";
  }

  if (url.endsWith(".zip")) {
    return ".zip";
  }

  return ".archive";
}

function findLink(
  html: string,
  predicate: (href: string) => boolean
): string | null {
  const matches = html.matchAll(/href="([^"]+)"/gi);
  for (const match of matches) {
    const href = decodeHtml(match[1]);
    if (predicate(href)) {
      return toAbsoluteUrl(href);
    }
  }

  return null;
}

function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }

  if (href.startsWith("//")) {
    return `https:${href}`;
  }

  if (href.startsWith("/")) {
    return `https://stockfishchess.org${href}`;
  }

  return href;
}

function decodeHtml(value: string): string {
  return value.replaceAll("&amp;", "&");
}
