import { Chess } from "chess.js";
import type { AnalysisLine } from "@shared/contracts";

interface ParsedInfo {
  depth: number;
  seldepth?: number;
  multipv: number;
  scoreCp?: number;
  mateIn?: number;
  nodes?: number;
  nps?: number;
  wdl?: [number, number, number];
  pvUci: string[];
}

export function parseInfoLine(line: string): ParsedInfo | null {
  if (!line.startsWith("info ")) {
    return null;
  }

  const tokens = line.trim().split(/\s+/);
  const parsed: ParsedInfo = {
    depth: 0,
    multipv: 1,
    pvUci: []
  };

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    switch (token) {
      case "depth":
        parsed.depth = Number(tokens[index + 1] ?? "0");
        index += 1;
        break;
      case "seldepth":
        parsed.seldepth = Number(tokens[index + 1] ?? "0");
        index += 1;
        break;
      case "multipv":
        parsed.multipv = Number(tokens[index + 1] ?? "1");
        index += 1;
        break;
      case "score":
        if (tokens[index + 1] === "cp") {
          parsed.scoreCp = Number(tokens[index + 2] ?? "0");
          index += 2;
        } else if (tokens[index + 1] === "mate") {
          parsed.mateIn = Number(tokens[index + 2] ?? "0");
          index += 2;
        }
        break;
      case "nodes":
        parsed.nodes = Number(tokens[index + 1] ?? "0");
        index += 1;
        break;
      case "nps":
        parsed.nps = Number(tokens[index + 1] ?? "0");
        index += 1;
        break;
      case "wdl":
        parsed.wdl = [
          Number(tokens[index + 1] ?? "0"),
          Number(tokens[index + 2] ?? "0"),
          Number(tokens[index + 3] ?? "0")
        ];
        index += 3;
        break;
      case "pv":
        parsed.pvUci = tokens.slice(index + 1);
        index = tokens.length;
        break;
      default:
        break;
    }
  }

  if (!parsed.depth || parsed.pvUci.length === 0) {
    return null;
  }

  return parsed;
}

export function formatAnalysisLine(
  fen: string,
  engineId: string,
  engineName: string,
  sessionId: string,
  parsed: ParsedInfo
): AnalysisLine {
  return {
    multipv: parsed.multipv,
    pvSan: uciVariationToSan(fen, parsed.pvUci),
    pvUci: parsed.pvUci,
    scoreCp: parsed.scoreCp,
    mateIn: parsed.mateIn,
    depth: parsed.depth,
    seldepth: parsed.seldepth,
    nodes: parsed.nodes,
    nps: parsed.nps,
    wdl: parsed.wdl,
    engineId,
    engineName,
    sessionId
  };
}

export function uciVariationToSan(fen: string, pvUci: string[]): string[] {
  const chess = new Chess(fen);
  const sanMoves: string[] = [];

  for (const move of pvUci) {
    const played = chess.move({
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move[4] as "q" | "r" | "b" | "n" | undefined
    });

    if (!played) {
      sanMoves.push(move);
      break;
    }

    sanMoves.push(played.san);
  }

  return sanMoves;
}
