import "server-only";
import fs from "fs/promises";
import path from "path";
import type { CrimeCctvStat, DistrictStat, Pharmacy, Summary } from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");

async function readJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, filename), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getPharmacies(): Promise<Pharmacy[]> {
  return readJson<Pharmacy[]>("pharmacies.json", []);
}

export async function getDistrictStats(): Promise<DistrictStat[]> {
  return readJson<DistrictStat[]>("district_stats.json", []);
}

export async function getSummary(): Promise<Summary | null> {
  return readJson<Summary | null>("summary.json", null);
}

export async function getCrimeCctvStats(): Promise<CrimeCctvStat[]> {
  return readJson<CrimeCctvStat[]>("crime_cctv_stats.json", []);
}
