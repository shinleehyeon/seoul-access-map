import "server-only";
import fs from "fs/promises";
import path from "path";
import type { CrimeCctvStat } from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");

async function readJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, filename), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getCrimeCctvStats(): Promise<CrimeCctvStat[]> {
  return readJson<CrimeCctvStat[]>("crime_cctv_stats.json", []);
}
