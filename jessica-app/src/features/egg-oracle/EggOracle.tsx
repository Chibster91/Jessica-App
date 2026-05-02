import { type ReactNode, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "eggOracleTrackingFirst.v2";

// ─── Types ───────────────────────────────────────────────────────────────────

type FlowLevel = "none" | "light" | "medium" | "heavy";
type MucusType = "" | "dry" | "sticky" | "creamy" | "watery" | "egg-white";
type OPKResult = "" | "negative" | "positive" | "peak";

type EggOracleLog = {
  periodStart: boolean;
  periodEnd: boolean;
  periodFlow: FlowLevel;
  spotting: boolean;
  cervicalMucus: MucusType;
  intercourse: boolean;
  opk: OPKResult;
  notes: string;
};

type EggOracleData = {
  cycleLengthFallback: number;
  periodLengthFallback: number;
  logs: Record<string, Partial<EggOracleLog>>;
};

type CycleStats = {
  periodStarts: string[];
  periodEnds: string[];
  cycleLengths: number[];
  periodLengths: number[];
  averageCycleLength: number;
  shortestCycle: number;
  longestCycle: number;
  medianCycle: number;
  averagePeriodLength: number;
  shortestPeriod: number;
  longestPeriod: number;
  periodDayCount: number;
  loggedDays: number;
  intercourseDays: number;
  spottingDays: number;
  fertileMucusDays: number;
  positiveOPKDays: number;
};

type CycleInfo = CycleStats & {
  currentStart: Date;
  nextStart: Date;
  cycleDay: number;
  calendarOvulationDate: Date;
  ovulationDate: Date;
  ovulationSource: string;
  opkDate: Date | null;
  fertileStart: Date;
  fertileStartSource: string;
  fertileMucusStartDate: Date | null;
  fertileEnd: Date;
  periodEnd: Date;
  nextPeriodEnd: Date;
};

type DayInfo = {
  iso: string;
  log: EggOracleLog;
  cycle: CycleInfo;
  explicitPeriodFlow: boolean;
  knownPeriod: boolean;
  actualPeriod: boolean;
  predictedPeriod: boolean;
  fertile: boolean;
  ovulation: boolean;
  fertileMucus: boolean;
  positiveOPK: boolean;
  hasLog: boolean;
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function diffDays(a: Date, b: Date): number {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function isBetween(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function monthTitle(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateLong(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

function buildMonthDays(monthDate: Date): Date[] {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

function defaultData(): EggOracleData {
  return { cycleLengthFallback: 44, periodLengthFallback: 5, logs: {} };
}

function loadData(): EggOracleData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw) as Partial<EggOracleData>;
    return {
      ...defaultData(),
      ...parsed,
      logs: parsed.logs && typeof parsed.logs === "object" ? parsed.logs : {},
    };
  } catch {
    return defaultData();
  }
}

function saveData(data: EggOracleData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage can fail in privacy/sandbox modes — app still runs
  }
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function cleanLog(log: Partial<EggOracleLog> = {}): EggOracleLog {
  return {
    periodStart: !!log.periodStart,
    periodEnd: !!log.periodEnd,
    periodFlow: (log.periodFlow as FlowLevel) || "none",
    spotting: !!log.spotting,
    cervicalMucus: (log.cervicalMucus as MucusType) || "",
    intercourse: !!log.intercourse,
    opk: (log.opk as OPKResult) || "",
    notes: log.notes || "",
  };
}

function normalizeImportedData(value: unknown): EggOracleData {
  if (!value || typeof value !== "object") throw new Error("Import file is not valid Egg Oracle data.");
  const obj = value as Record<string, unknown>;
  const rawLogs = obj.logs && typeof obj.logs === "object" ? obj.logs as Record<string, unknown> : {};
  const cleanedLogs: Record<string, Partial<EggOracleLog>> = {};
  Object.entries(rawLogs).forEach(([iso, log]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) cleanedLogs[iso] = cleanLog(log as Partial<EggOracleLog>);
  });
  return {
    cycleLengthFallback: clampNumber(obj.cycleLengthFallback, 44, 15, 60),
    periodLengthFallback: clampNumber(obj.periodLengthFallback, 5, 1, 14),
    logs: cleanedLogs,
  };
}

function makeExportPayload(data: EggOracleData) {
  return { app: "Egg Oracle", version: 2, exportedAt: new Date().toISOString(), data: normalizeImportedData(data) };
}

// ─── Cycle computation ────────────────────────────────────────────────────────

function getPeriodStartDates(data: EggOracleData): string[] {
  return Object.entries(data.logs)
    .filter(([, log]) => log?.periodStart)
    .map(([iso]) => iso)
    .sort();
}

function getPeriodEndDates(data: EggOracleData): string[] {
  return Object.entries(data.logs)
    .filter(([, log]) => log?.periodEnd)
    .map(([iso]) => iso)
    .sort();
}

function getPeriodEndForStart(data: EggOracleData, startISO: string, nextStartISO?: string): Date | null {
  const start = fromISO(startISO);
  const nextStart = nextStartISO ? fromISO(nextStartISO) : addDays(start, 21);
  const explicitEnds = getPeriodEndDates(data)
    .map(fromISO)
    .filter((end) => end >= start && end < nextStart)
    .sort((a, b) => a.getTime() - b.getTime());
  if (explicitEnds.length) return explicitEnds[0];

  let lastFlowDay: Date | null = null;
  for (let d = new Date(start); d < nextStart; d = addDays(d, 1)) {
    const log = data.logs[toISO(d)];
    if (log?.periodFlow && log.periodFlow !== "none") lastFlowDay = new Date(d);
    else if (lastFlowDay) break;
  }
  return lastFlowDay;
}

function getPeriodDays(data: EggOracleData): string[] {
  return Object.entries(data.logs)
    .filter(([, log]) => log?.periodFlow && log.periodFlow !== "none")
    .map(([iso]) => iso)
    .sort();
}

function getCycleLengths(periodStarts: string[]): number[] {
  const lengths: number[] = [];
  for (let i = 1; i < periodStarts.length; i++) {
    const length = diffDays(fromISO(periodStarts[i - 1]), fromISO(periodStarts[i]));
    if (length >= 15 && length <= 60) lengths.push(length);
  }
  return lengths;
}

function avg(nums: number[], fallback = 0): number {
  if (!nums.length) return fallback;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function getCycleStats(data: EggOracleData): CycleStats {
  const periodStarts = getPeriodStartDates(data);
  const periodEnds = getPeriodEndDates(data);
  const cycleLengths = getCycleLengths(periodStarts);
  const fallbackCycle = clampNumber(data.cycleLengthFallback, 44, 15, 60);
  const fallbackPeriod = clampNumber(data.periodLengthFallback, 5, 1, 14);
  const averageCycleLength = avg(cycleLengths, fallbackCycle);
  const periodLengths = periodStarts.map((startISO, index) => {
    const end = getPeriodEndForStart(data, startISO, periodStarts[index + 1]);
    if (end) return Math.max(1, diffDays(fromISO(startISO), end) + 1);
    return fallbackPeriod;
  });
  const averagePeriodLength = avg(periodLengths, fallbackPeriod);
  const logs = Object.values(data.logs);
  return {
    periodStarts, periodEnds, cycleLengths, periodLengths, averageCycleLength,
    shortestCycle: cycleLengths.length ? Math.min(...cycleLengths) : 0,
    longestCycle: cycleLengths.length ? Math.max(...cycleLengths) : 0,
    medianCycle: median(cycleLengths),
    averagePeriodLength,
    shortestPeriod: periodLengths.length ? Math.min(...periodLengths) : 0,
    longestPeriod: periodLengths.length ? Math.max(...periodLengths) : 0,
    periodDayCount: getPeriodDays(data).length,
    loggedDays: Object.keys(data.logs).filter((iso) => Object.values(data.logs[iso] || {}).some(Boolean)).length,
    intercourseDays: logs.filter((log) => log?.intercourse).length,
    spottingDays: logs.filter((log) => log?.spotting).length,
    fertileMucusDays: logs.filter((log) => ["watery", "egg-white"].includes(log?.cervicalMucus || "")).length,
    positiveOPKDays: logs.filter((log) => ["positive", "peak"].includes(log?.opk || "")).length,
  };
}

function getOPKAdjustedOvulation(data: EggOracleData, calendarOvulationDate: Date, cycleStart: Date, nextStart: Date) {
  const opkEntries = Object.entries(data.logs)
    .map(([iso, log]) => ({ iso, date: fromISO(iso), opk: log?.opk || "" }))
    .filter((e) => e.date >= cycleStart && e.date < nextStart && ["positive", "peak"].includes(e.opk))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (!opkEntries.length) return { ovulationDate: calendarOvulationDate, source: "calendar", opkDate: null };
  const strongest = opkEntries.find((e) => e.opk === "peak") || opkEntries[opkEntries.length - 1];
  return { ovulationDate: addDays(strongest.date, 1), source: strongest.opk, opkDate: strongest.date };
}

function getMucusAdjustedFertileStart(data: EggOracleData, baseFertileStart: Date, cycleStart: Date, ovulationDate: Date) {
  const mucusEntries = Object.entries(data.logs)
    .map(([iso, log]) => ({ date: fromISO(iso), mucus: log?.cervicalMucus || "" }))
    .filter((e) => e.date >= cycleStart && e.date <= ovulationDate && ["watery", "egg-white"].includes(e.mucus))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (!mucusEntries.length) return { fertileStart: baseFertileStart, mucusDate: null, source: "ovulation" };
  const earliest = mucusEntries[0].date;
  if (earliest < baseFertileStart) return { fertileStart: earliest, mucusDate: earliest, source: "mucus" };
  return { fertileStart: baseFertileStart, mucusDate: earliest, source: "ovulation" };
}

function findCycleForDate(data: EggOracleData, date: Date): CycleInfo {
  const stats = getCycleStats(data);
  const starts = stats.periodStarts;
  let currentStartISO = starts.filter((iso) => fromISO(iso) <= date).at(-1);
  if (!currentStartISO) {
    const anchor = starts[0] ? fromISO(starts[0]) : new Date(date.getFullYear(), date.getMonth(), date.getDate());
    while (anchor > date) anchor.setDate(anchor.getDate() - stats.averageCycleLength);
    currentStartISO = toISO(anchor);
  }
  const currentStart = fromISO(currentStartISO);
  const nextKnownStartISO = starts.find((iso) => fromISO(iso) > currentStart);
  const nextStart = nextKnownStartISO ? fromISO(nextKnownStartISO) : addDays(currentStart, stats.averageCycleLength);
  const cycleDay = diffDays(currentStart, date) + 1;
  const calendarOvulationDate = addDays(nextStart, -14);
  const { ovulationDate, source: ovulationSource, opkDate } = getOPKAdjustedOvulation(data, calendarOvulationDate, currentStart, nextStart);
  const baseFertileStart = addDays(ovulationDate, -5);
  const { fertileStart, source: fertileStartSource, mucusDate: fertileMucusStartDate } = getMucusAdjustedFertileStart(data, baseFertileStart, currentStart, ovulationDate);
  const fertileEnd = ovulationDate;
  const actualCurrentEnd = getPeriodEndForStart(data, toISO(currentStart), nextKnownStartISO);
  const periodEnd = actualCurrentEnd || addDays(currentStart, stats.averagePeriodLength - 1);
  const nextPeriodEnd = addDays(nextStart, stats.averagePeriodLength - 1);
  return { ...stats, currentStart, nextStart, cycleDay, calendarOvulationDate, ovulationDate, ovulationSource, opkDate, fertileStart, fertileStartSource, fertileMucusStartDate, fertileEnd, periodEnd, nextPeriodEnd };
}

function getDayInfo(data: EggOracleData, date: Date): DayInfo {
  const iso = toISO(date);
  const log = cleanLog(data.logs[iso]);
  const cycle = findCycleForDate(data, date);
  const explicitPeriodFlow = !!log.periodFlow && log.periodFlow !== "none";
  const knownPeriod = cycle.periodStarts.includes(toISO(cycle.currentStart)) && isBetween(date, cycle.currentStart, cycle.periodEnd);
  const actualPeriod = explicitPeriodFlow || knownPeriod;
  const predictedPeriod = !actualPeriod && isBetween(date, cycle.nextStart, cycle.nextPeriodEnd);
  const fertile = isBetween(date, cycle.fertileStart, cycle.fertileEnd);
  const ovulation = toISO(date) === toISO(cycle.ovulationDate);
  const fertileMucus = ["watery", "egg-white"].includes(log.cervicalMucus);
  const positiveOPK = ["positive", "peak"].includes(log.opk);
  const hasLog = Object.values(log).some(Boolean);
  return { iso, log, cycle, explicitPeriodFlow, knownPeriod, actualPeriod, predictedPeriod, fertile, ovulation, fertileMucus, positiveOPK, hasLog };
}

// ─── Logic tests (run once on load in dev) ────────────────────────────────────

function runLogicTests() {
  const data: EggOracleData = {
    cycleLengthFallback: 28, periodLengthFallback: 5,
    logs: {
      "2026-01-01": { periodStart: true, periodFlow: "medium" },
      "2026-01-02": { periodFlow: "light" },
      "2026-01-29": { periodStart: true, periodFlow: "medium" },
      "2026-02-26": { periodStart: true, periodFlow: "medium" },
    },
  };
  const stats = getCycleStats(data);
  console.assert(stats.averageCycleLength === 28, "Average cycle should be 28 days");
  console.assert(stats.shortestCycle === 28, "Shortest cycle should be 28 days");
  console.assert(toISO(findCycleForDate(data, fromISO("2026-02-10")).ovulationDate) === "2026-02-12", "Ovulation estimate");
  console.assert(getDayInfo(data, fromISO("2026-02-10")).fertile === true, "Feb 10 fertile");
  console.assert(getDayInfo(data, fromISO("2026-02-12")).ovulation === true, "Feb 12 ovulation");

  const dataWithEnds: EggOracleData = {
    cycleLengthFallback: 28, periodLengthFallback: 5,
    logs: {
      "2026-01-01": { periodStart: true, periodFlow: "medium" },
      "2026-01-04": { periodEnd: true, periodFlow: "light" },
      "2026-01-30": { periodStart: true, periodFlow: "medium" },
      "2026-02-02": { periodEnd: true, periodFlow: "light" },
    },
  };
  const endStats = getCycleStats(dataWithEnds);
  console.assert(endStats.averageCycleLength === 29, "Cycle length from ends");
  console.assert(endStats.averagePeriodLength === 4, "Period length from ends");
  console.assert(getDayInfo(dataWithEnds, fromISO("2026-01-02")).actualPeriod === true, "In-range period day");
  console.assert(getDayInfo(dataWithEnds, fromISO("2026-01-03")).knownPeriod === true, "Known period day");

  const dataWithOPK: EggOracleData = {
    cycleLengthFallback: 44, periodLengthFallback: 5,
    logs: {
      "2026-01-01": { periodStart: true, periodFlow: "medium" },
      "2026-02-14": { periodStart: true, periodFlow: "medium" },
      "2026-03-01": { opk: "positive" },
    },
  };
  const opkCycle = findCycleForDate(dataWithOPK, fromISO("2026-03-01"));
  console.assert(toISO(opkCycle.ovulationDate) === "2026-03-02", "OPK shifts ovulation");
  console.assert(toISO(opkCycle.fertileStart) === "2026-02-25", "OPK shifts fertile window");

  const dataWithMucus: EggOracleData = {
    cycleLengthFallback: 44, periodLengthFallback: 5,
    logs: {
      "2026-05-01": { periodStart: true, periodFlow: "medium" },
      "2026-05-23": { cervicalMucus: "egg-white" },
    },
  };
  const mucusCycle = findCycleForDate(dataWithMucus, fromISO("2026-05-23"));
  console.assert(toISO(mucusCycle.ovulationDate) === "2026-05-31", "Mucus doesn't move ovulation");
  console.assert(toISO(mucusCycle.fertileStart) === "2026-05-23", "Mucus extends fertile window");
  console.assert(mucusCycle.fertileStartSource === "mucus", "Fertile source is mucus");

  const messyImport = normalizeImportedData({ cycleLengthFallback: "44", periodLengthFallback: "5", logs: { "2026-04-01": { periodStart: true, periodFlow: "medium", nonsense: true }, nope: { periodStart: true } } });
  console.assert(messyImport.cycleLengthFallback === 44, "Import normalizes cycle length");
  console.assert(Object.keys(messyImport.logs).length === 1, "Import filters bad keys");
}

if (typeof window !== "undefined") runLogicTests();

// ─── UI Components ────────────────────────────────────────────────────────────

type EoToggleProps = {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
};

function EoToggle({ active, onClick, children }: EoToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`eo-toggle-btn${active ? " selected" : ""}`}
    >
      {children}
    </button>
  );
}

type CalendarCellProps = {
  date: Date;
  monthDate: Date;
  data: EggOracleData;
  onOpenDay: (iso: string) => void;
};

function CalendarCell({ date, monthDate, data, onOpenDay }: CalendarCellProps) {
  const info = getDayInfo(data, date);
  const outside = !sameMonth(date, monthDate);

  let cellClass = "eo-cell";
  if (outside) cellClass += " eo-cell--outside";
  else if (info.actualPeriod) cellClass += " eo-cell--period";
  else if (info.predictedPeriod) cellClass += " eo-cell--predicted";
  else if (info.ovulation) cellClass += " eo-cell--ovulation";
  else if (info.fertile) cellClass += " eo-cell--fertile";

  return (
    <button
      type="button"
      onClick={() => onOpenDay(toISO(date))}
      className={cellClass}
      aria-label={`Open log for ${toISO(date)}`}
    >
      <span className="eo-cell-num">{date.getDate()}</span>
      <div className="eo-cell-dots">
        {info.log.periodStart && <span className="eo-badge eo-badge--start">S</span>}
        {info.log.periodEnd && <span className="eo-badge eo-badge--end">E</span>}
        {info.positiveOPK && <span className="eo-badge eo-badge--lh">LH</span>}
        {info.ovulation && <span className="eo-dot eo-dot--ovulation" />}
        {info.actualPeriod && !info.log.periodStart && <span className="eo-dot eo-dot--period" />}
        {info.fertile && !info.actualPeriod && !info.ovulation && <span className="eo-dot eo-dot--fertile" />}
        {info.log.intercourse && <span className="eo-dot eo-dot--intercourse" />}
        {info.fertileMucus && <span className="eo-dot eo-dot--mucus" />}
        {info.hasLog && !info.actualPeriod && !info.log.intercourse && !info.fertileMucus && !info.positiveOPK && (
          <span className="eo-dot eo-dot--note" />
        )}
      </div>
    </button>
  );
}

type DayModalProps = {
  iso: string;
  data: EggOracleData;
  setData: React.Dispatch<React.SetStateAction<EggOracleData>>;
  onClose: () => void;
};

function DayModal({ iso, data, setData, onClose }: DayModalProps) {
  const log = cleanLog(data.logs[iso]);
  const date = fromISO(iso);
  const info = getDayInfo(data, date);

  function setLog(patch: Partial<EggOracleLog>) {
    setData((prev) => ({
      ...prev,
      logs: { ...prev.logs, [iso]: cleanLog({ ...(prev.logs[iso] || {}), ...patch }) },
    }));
  }

  function clearDay() {
    setData((prev) => {
      const logs = { ...prev.logs };
      delete logs[iso];
      return { ...prev, logs };
    });
    onClose();
  }

  function togglePeriodStart() {
    const next = !log.periodStart;
    setLog({ periodStart: next, periodFlow: next && log.periodFlow === "none" ? "medium" : log.periodFlow });
  }

  function togglePeriodEnd() {
    const next = !log.periodEnd;
    setLog({ periodEnd: next, periodFlow: next && log.periodFlow === "none" ? "light" : log.periodFlow });
  }

  function setFlow(flow: FlowLevel) {
    setLog({ periodFlow: flow, periodStart: flow === "none" ? false : log.periodStart, periodEnd: flow === "none" ? false : log.periodEnd });
  }

  const dateLabel = date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const cycleDayLabel = `Cycle day ${Math.max(1, info.cycle.cycleDay)}`;
  const ovLabel = `Ovulation est. ${formatDateLong(info.cycle.ovulationDate)}${info.cycle.ovulationSource !== "calendar" ? ` (from LH ${formatDate(info.cycle.opkDate)})` : ""}`;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal aria-label={`Log for ${dateLabel}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal eo-modal">
        <div className="eo-modal-head">
          <div>
            <div className="eo-modal-date">{dateLabel}</div>
            <div className="eo-modal-sub">{cycleDayLabel} · {ovLabel}</div>
          </div>
          <button type="button" className="eo-close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="eo-modal-body">
          <section className="eo-log-section">
            <h3 className="eo-section-title">Period</h3>
            <div className="eo-toggle-grid two">
              <EoToggle active={log.periodStart} onClick={togglePeriodStart}>Period start</EoToggle>
              <EoToggle active={log.periodEnd} onClick={togglePeriodEnd}>Period end</EoToggle>
              <EoToggle active={log.spotting} onClick={() => setLog({ spotting: !log.spotting })}>Spotting</EoToggle>
            </div>
            <div className="eo-toggle-grid four" style={{ marginTop: "0.5rem" }}>
              {(["none", "light", "medium", "heavy"] as FlowLevel[]).map((flow) => (
                <EoToggle key={flow} active={log.periodFlow === flow} onClick={() => setFlow(flow)}>
                  {flow[0].toUpperCase() + flow.slice(1)}
                </EoToggle>
              ))}
            </div>
          </section>

          <section className="eo-log-section">
            <h3 className="eo-section-title">Cervical mucus</h3>
            <div className="eo-toggle-grid two">
              {(["dry", "sticky", "creamy", "watery", "egg-white"] as MucusType[]).filter(Boolean).map((mucus) => (
                <EoToggle key={mucus} active={log.cervicalMucus === mucus} onClick={() => setLog({ cervicalMucus: log.cervicalMucus === mucus ? "" : mucus })}>
                  {mucus === "egg-white" ? "Egg-white" : mucus[0].toUpperCase() + mucus.slice(1)}
                </EoToggle>
              ))}
            </div>
          </section>

          <section className="eo-log-section">
            <h3 className="eo-section-title">LH / OPK test</h3>
            <div className="eo-toggle-grid three">
              {([
                { value: "negative", label: "Negative", hint: "Fainter than control" },
                { value: "positive", label: "Positive", hint: "Same as control" },
                { value: "peak", label: "Peak", hint: "Darker than control" },
              ] as const).map((opk) => (
                <EoToggle key={opk.value} active={log.opk === opk.value} onClick={() => setLog({ opk: log.opk === opk.value ? "" : opk.value })}>
                  <span className="eo-toggle-main">{opk.label}</span>
                  <span className="eo-toggle-hint">{opk.hint}</span>
                </EoToggle>
              ))}
            </div>
          </section>

          <section className="eo-log-section">
            <h3 className="eo-section-title">Intercourse</h3>
            <EoToggle active={log.intercourse} onClick={() => setLog({ intercourse: !log.intercourse })}>
              Logged
            </EoToggle>
          </section>

          <section className="eo-log-section">
            <h3 className="eo-section-title">Notes</h3>
            <textarea
              className="eo-notes"
              value={log.notes}
              onChange={(e) => setLog({ notes: e.target.value })}
              placeholder="Symptoms, mood, cramps, timing..."
              rows={3}
            />
          </section>
        </div>

        <div className="eo-modal-foot">
          <button type="button" className="primary-button" onClick={onClose}>Save</button>
          <button type="button" className="secondary-button" onClick={clearDay}>Clear day</button>
        </div>
      </div>
    </div>
  );
}

type CalendarPageProps = {
  data: EggOracleData;
  monthDate: Date;
  setMonthDate: React.Dispatch<React.SetStateAction<Date>>;
  onOpenDay: (iso: string) => void;
};

function CalendarPage({ data, monthDate, setMonthDate, onOpenDay }: CalendarPageProps) {
  const days = useMemo(() => buildMonthDays(monthDate), [monthDate]);
  const cycle = findCycleForDate(data, new Date());

  const fertileLabel = `${formatDateLong(cycle.fertileStart)} – ${formatDateLong(cycle.fertileEnd)}${cycle.fertileStartSource === "mucus" ? " (extended by mucus)" : ""}`;
  const ovLabel = `${formatDateLong(cycle.ovulationDate)}${cycle.ovulationSource !== "calendar" ? " (from LH)" : ""}`;

  return (
    <div className="eo-page">
      <section className="panel eo-hero">
        <p className="panel-eyebrow">Current estimates</p>
        <div className="eo-hero-row"><span className="eo-hero-lbl">Next period</span><span className="eo-hero-val">{formatDateLong(cycle.nextStart)}</span></div>
        <div className="eo-hero-row"><span className="eo-hero-lbl">Fertile window</span><span className="eo-hero-val">{fertileLabel}</span></div>
        <div className="eo-hero-row"><span className="eo-hero-lbl">Ovulation</span><span className="eo-hero-val">{ovLabel}</span></div>
      </section>

      <section className="panel eo-calendar-panel">
        <div className="eo-cal-nav">
          <button type="button" className="eo-cal-arrow" onClick={() => setMonthDate((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Previous month">‹</button>
          <span className="eo-cal-month">{monthTitle(monthDate)}</span>
          <button type="button" className="eo-cal-arrow" onClick={() => setMonthDate((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Next month">›</button>
        </div>
        <div className="eo-cal-weekdays">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="eo-cal-grid">
          {days.map((date) => (
            <CalendarCell key={toISO(date)} date={date} monthDate={monthDate} data={data} onOpenDay={onOpenDay} />
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="panel-eyebrow">Legend</p>
        <div className="eo-legend">
          <div className="eo-legend-item eo-legend--period"><span className="eo-dot eo-dot--period" /> Period</div>
          <div className="eo-legend-item eo-legend--fertile"><span className="eo-dot eo-dot--fertile" /> Fertile</div>
          <div className="eo-legend-item"><span className="eo-dot eo-dot--ovulation" /> Ovulation</div>
          <div className="eo-legend-item"><span className="eo-dot eo-dot--intercourse" /> Intercourse</div>
          <div className="eo-legend-item"><span className="eo-badge eo-badge--lh">LH</span> Positive OPK</div>
          <div className="eo-legend-item"><span className="eo-dot eo-dot--mucus" /> Fertile mucus</div>
        </div>
      </section>
    </div>
  );
}

type StatsPageProps = {
  data: EggOracleData;
  setData: React.Dispatch<React.SetStateAction<EggOracleData>>;
};

function StatsPage({ data }: StatsPageProps) {
  const stats = getCycleStats(data);
  const cycle = findCycleForDate(data, new Date());

  const statCards: [string, string | number][] = [
    ["Average cycle", `${stats.averageCycleLength} days`],
    ["Average period", `${stats.averagePeriodLength} days`],
    ["Shortest cycle", stats.shortestCycle ? `${stats.shortestCycle} days` : "Need 2 cycles"],
    ["Longest cycle", stats.longestCycle ? `${stats.longestCycle} days` : "Need 2 cycles"],
    ["Median cycle", stats.medianCycle ? `${stats.medianCycle} days` : "Need 2 cycles"],
    ["Logged days", stats.loggedDays],
    ["Intercourse days", stats.intercourseDays],
    ["Fertile mucus days", stats.fertileMucusDays],
    ["Positive LH days", stats.positiveOPKDays],
  ];

  return (
    <div className="eo-page">
      <section className="panel eo-hero">
        <p className="panel-eyebrow">Current estimates</p>
        <div className="eo-hero-row"><span className="eo-hero-lbl">Next period</span><span className="eo-hero-val">{formatDateLong(cycle.nextStart)}</span></div>
        <div className="eo-hero-row">
          <span className="eo-hero-lbl">Fertile window</span>
          <span className="eo-hero-val">{formatDateLong(cycle.fertileStart)} – {formatDateLong(cycle.fertileEnd)}</span>
        </div>
        <div className="eo-hero-row">
          <span className="eo-hero-lbl">Ovulation</span>
          <span className="eo-hero-val">{formatDateLong(cycle.ovulationDate)}{cycle.ovulationSource !== "calendar" ? ` (LH ${formatDate(cycle.opkDate)})` : ""}</span>
        </div>
      </section>

      <section className="panel">
        <p className="panel-eyebrow">Cycle stats</p>
        <div className="eo-stat-grid">
          {statCards.map(([label, value]) => (
            <div key={label} className="eo-stat-card">
              <div className="eo-stat-lbl">{label}</div>
              <div className="eo-stat-val">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="panel-eyebrow">Cycle history</p>
        {stats.periodStarts.length ? (
          <ul className="pf-kv-list">
            {stats.periodStarts.map((start, i) => (
              <li key={start} className="pf-kv">
                <span className="pf-k">{formatDateLong(fromISO(start))}</span>
                <span className="pf-v">
                  {i > 0 ? `${diffDays(fromISO(stats.periodStarts[i - 1]), fromISO(start))}d cycle` : "First"} · {stats.periodLengths[i] || data.periodLengthFallback}d period
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: "var(--fg-2)", fontSize: "0.875rem", margin: 0 }}>Log period start dates on the calendar to build stats.</p>
        )}
      </section>
    </div>
  );
}

type SettingsPageProps = {
  data: EggOracleData;
  setData: React.Dispatch<React.SetStateAction<EggOracleData>>;
};

function SettingsPage({ data, setData }: SettingsPageProps) {
  const [importError, setImportError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [exportText, setExportText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function exportData() {
    const text = JSON.stringify(makeExportPayload(data), null, 2);
    setExportText(text);
    setImportError("");
    setStatusMsg("Export ready — copy the text below or download the JSON file.");
  }

  function downloadExport() {
    const text = exportText || JSON.stringify(makeExportPayload(data), null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `egg-oracle-${toISO(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importFromFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setImportError("");
    setStatusMsg("");
    setConfirmDelete(false);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        setData(normalizeImportedData(parsed.data || parsed));
        setStatusMsg("Import complete — your data has been replaced.");
      } catch (err) {
        setImportError((err as Error).message || "Could not import that file.");
      }
    };
    reader.onerror = () => setImportError("Could not read that file.");
    reader.readAsText(file);
  }

  function importFromText() {
    setImportError("");
    setStatusMsg("");
    setConfirmDelete(false);
    try {
      const parsed = JSON.parse(exportText || "{}");
      setData(normalizeImportedData(parsed.data || parsed));
      setStatusMsg("Import complete from pasted text.");
    } catch (err) {
      setImportError((err as Error).message || "Could not import that pasted text.");
    }
  }

  function deleteAllData() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setStatusMsg("Tap again to confirm permanent deletion.");
      return;
    }
    const fresh = defaultData();
    setData(fresh);
    saveData(fresh);
    setExportText("");
    setConfirmDelete(false);
    setStatusMsg("All data deleted.");
  }

  return (
    <div className="eo-page">
      <section className="panel">
        <p className="panel-eyebrow">Data</p>
        <ul className="pf-kv-list">
          <li className="pf-row" role="button" tabIndex={0} onClick={exportData} onKeyDown={(e) => e.key === "Enter" && exportData()}>
            <span>Export data (JSON)</span><span className="pf-chev">›</span>
          </li>
          <li className="pf-row" role="button" tabIndex={0}>
            <label style={{ display: "contents", cursor: "pointer" }}>
              <span>Import from file</span><span className="pf-chev">›</span>
              <input type="file" accept="application/json,.json" onChange={importFromFile} style={{ display: "none" }} />
            </label>
          </li>
          <li className="pf-row pf-row-danger" role="button" tabIndex={0} onClick={deleteAllData} onKeyDown={(e) => e.key === "Enter" && deleteAllData()}>
            <span>{confirmDelete ? "Confirm — delete everything" : "Delete all data"}</span><span className="pf-chev">›</span>
          </li>
        </ul>

        {exportText && (
          <div className="eo-export-box">
            <div className="eo-export-actions">
              <button type="button" className="secondary-button" onClick={downloadExport}>Download JSON</button>
              <button type="button" className="secondary-button" onClick={() => navigator.clipboard?.writeText(exportText)}>Copy</button>
              <button type="button" className="secondary-button" onClick={importFromText}>Import text</button>
            </div>
            <textarea
              className="eo-export-text"
              value={exportText}
              onChange={(e) => setExportText(e.target.value)}
              aria-label="Exported data"
              rows={6}
            />
          </div>
        )}

        {importError && <p className="profile-warning" style={{ marginTop: "0.75rem" }}>{importError}</p>}
        {statusMsg && <p className="profile-toast" style={{ position: "static", marginTop: "0.75rem" }}>{statusMsg}</p>}
      </section>

      <section className="panel">
        <p className="panel-eyebrow">Manual defaults</p>
        <p style={{ color: "var(--fg-2)", fontSize: "0.82rem", margin: "0 0 1rem" }}>
          Used until you have enough real cycle data.
        </p>
        <div className="profile-form-grid">
          <label>
            Default cycle length (days)
            <div className="goals-input-row">
              <input
                type="number"
                min="15"
                max="60"
                value={data.cycleLengthFallback}
                onChange={(e) => setData((prev) => ({ ...prev, cycleLengthFallback: clampNumber(e.target.value, 44, 15, 60) }))}
              />
              <span>days</span>
            </div>
          </label>
          <label>
            Default period length (days)
            <div className="goals-input-row">
              <input
                type="number"
                min="1"
                max="14"
                value={data.periodLengthFallback}
                onChange={(e) => setData((prev) => ({ ...prev, periodLengthFallback: clampNumber(e.target.value, 5, 1, 14) }))}
              />
              <span>days</span>
            </div>
          </label>
        </div>
      </section>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

type EggOracleProps = {
  bottomNav: ReactNode;
};

export default function EggOracle({ bottomNav }: EggOracleProps) {
  const [data, setData] = useState<EggOracleData>(defaultData);
  const [tab, setTab] = useState<"calendar" | "stats" | "settings">("calendar");
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedISO, setSelectedISO] = useState<string | null>(null);

  useEffect(() => setData(loadData()), []);
  useEffect(() => saveData(data), [data]);

  return (
    <main className="app eo-app">
      <div className="top-bar">
        <div>
          <h1>Cycle</h1>
          <p className="week-range">Egg Oracle</p>
        </div>
        <button
          type="button"
          className="primary-button"
          style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
          onClick={() => setSelectedISO(toISO(new Date()))}
        >
          + Today
        </button>
      </div>

      <div className="tab-row eo-tabs">
        <button type="button" className={tab === "calendar" ? "active" : ""} onClick={() => setTab("calendar")}>Calendar</button>
        <button type="button" className={tab === "stats" ? "active" : ""} onClick={() => setTab("stats")}>Stats</button>
        <button type="button" className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>Settings</button>
      </div>

      {tab === "calendar" && <CalendarPage data={data} monthDate={monthDate} setMonthDate={setMonthDate} onOpenDay={setSelectedISO} />}
      {tab === "stats" && <StatsPage data={data} setData={setData} />}
      {tab === "settings" && <SettingsPage data={data} setData={setData} />}

      {selectedISO && <DayModal iso={selectedISO} data={data} setData={setData} onClose={() => setSelectedISO(null)} />}

      {bottomNav}
    </main>
  );
}
