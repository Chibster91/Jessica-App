import type { EggOracleData } from "./components/CycleView";

const STORAGE_KEY = "eggOracleTrackingFirst.v2";

function defaultCycleData(): EggOracleData {
  return { cycleLengthFallback: 44, periodLengthFallback: 5, trackFertile: true, logs: {} };
}

export function loadCycleData(): EggOracleData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultCycleData();
    const parsed = JSON.parse(raw) as Partial<EggOracleData>;
    return {
      ...defaultCycleData(),
      ...parsed,
      logs: parsed.logs && typeof parsed.logs === "object" ? parsed.logs : {},
    };
  } catch {
    return defaultCycleData();
  }
}

export function saveCycleData(data: EggOracleData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage can fail in privacy/sandbox modes — app still runs
  }
}
