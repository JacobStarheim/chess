import { readdir } from "node:fs/promises";
import { extname } from "node:path";
import type { TablebaseRegistration } from "@shared/contracts";

const PIECE_COUNT_PATTERN = /^([A-Za-z0-9vKQBNRP]+)\.(rtbw|rtbz)$/;

export async function registerTablebases(
  directory: string
): Promise<TablebaseRegistration> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);

  const wdlFiles = files.filter((file) => extname(file) === ".rtbw").length;
  const dtzFiles = files.filter((file) => extname(file) === ".rtbz").length;

  const coverage = Array.from(
    new Set(
      files.flatMap((file) => {
        const match = file.match(PIECE_COUNT_PATTERN);
        if (!match) {
          return [];
        }

        const material = match[1];
        const pieces = material.replace(/v/g, "").length;
        return [`${pieces}-piece`];
      })
    )
  ).sort();

  const available = wdlFiles > 0;

  return {
    path: directory,
    available,
    counts: {
      wdlFiles,
      dtzFiles
    },
    coverage,
    message: available
      ? `Detected ${wdlFiles} WDL files and ${dtzFiles} DTZ files.`
      : "No Syzygy tablebase files were found in the selected directory."
  };
}
