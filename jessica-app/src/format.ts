import type { Goals, Profile, ProfileUnits, WeightEntry, WeightRange, WeightUnit } from "./types";

export const mealCategories = ["Breakfast", "Lunch", "Dinner", "Snacks"];

export const poundsPerKilogram = 2.2046226218;

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readStringField(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}

export function readOptionalNumberField(source: Record<string, unknown>, keys: string[]) {
  const value = readStringField(source, keys);
  return value ? value : "0";
}

export function kgToLb(value: number) {
  return value * poundsPerKilogram;
}

export function lbToKg(value: number) {
  return value / poundsPerKilogram;
}

export function cmToTotalInches(value: number) {
  return value / 2.54;
}

export function formatProfileNumber(value: number, decimals = 1) {
  if (!Number.isFinite(value)) return "";
  const rounded = Number(value.toFixed(decimals));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function shiftDate(date: string, dayOffset: number) {
  const [year, month, day] = date.split("-").map(Number);
  const nextDate = new Date(year, month - 1, day + dayOffset);
  const nextYear = nextDate.getFullYear();
  const nextMonth = String(nextDate.getMonth() + 1).padStart(2, "0");
  const nextDay = String(nextDate.getDate()).padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getDateRangeEnding(date: string, days: number) {
  return Array.from({ length: days }, (_, index) => shiftDate(date, -index));
}

export function createNegativeFoodId(): number {
  return -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
}

export function formatMacro(value: number) {
  return Number(value.toFixed(1));
}

export function getWeekDates(referenceDate: string) {
  const [year, month, day] = referenceDate.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const dow = d.getDay();
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  return Array.from({ length: 7 }, (_, i) => shiftDate(referenceDate, daysToMonday + i));
}

export function formatShortDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatEntryDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatWeekOf(start: string, end: string): string {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function getShortDayName(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow];
}

export function formatDateRange(startDate: string, endDate: string) {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const sameYear = start.getFullYear() === end.getFullYear();

  return sameYear
    ? `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export function formatWeightValue(weight: number, unit: WeightUnit) {
  return `${Number(weight.toFixed(1))} ${unit}`;
}

export function formatHeightValue(heightCm: number, units: ProfileUnits) {
  if (units === "metric") return `${Number(heightCm.toFixed(1))} cm`;

  const totalInches = cmToTotalInches(heightCm);
  const feet = Math.floor(totalInches / 12);
  const inches = Number((totalInches - feet * 12).toFixed(1));
  return `${feet} ft ${inches} in`;
}

export function convertWeightValue(weight: number, fromUnit: WeightUnit, toUnit: WeightUnit) {
  if (fromUnit === toUnit) return weight;
  if (fromUnit === "kg" && toUnit === "lb") return weight * poundsPerKilogram;
  if (fromUnit === "lb" && toUnit === "kg") return weight / poundsPerKilogram;
  return weight;
}

export function formatWeightValueInUnit(weight: number, fromUnit: WeightUnit, toUnit: WeightUnit) {
  return formatWeightValue(convertWeightValue(weight, fromUnit, toUnit), toUnit);
}

export function roundToIncrement(value: number, increment: number) {
  return Math.round(value / increment) * increment;
}

export function getNiceWeightStep(range: number) {
  return range <= 6 ? 0.5 : 1;
}

export function getWeightTickLabel(value: number, step: number, unit: WeightUnit) {
  const precision = step === 0.5 ? 1 : 0;
  return `${Number(value.toFixed(precision))} ${unit}`;
}

export function sortWeightEntriesNewestFirst(entries: WeightEntry[]) {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function sortWeightEntriesOldestFirst(entries: WeightEntry[]) {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function getPreferredWeightUnit(goals: Goals | null, profile?: Profile | null): WeightUnit {
  return profile?.weightUnit ?? goals?.calculatorInputs?.weightUnit ?? "lb";
}

export function getWeightRangeStartDate(range: WeightRange, referenceDate: string) {
  if (range === "All") return "";

  const [year, month, day] = referenceDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const monthOffsets: Record<Exclude<WeightRange, "All">, number> = {
    "1M": 1,
    "3M": 3,
    "6M": 6,
    "1Y": 12,
  };

  date.setMonth(date.getMonth() - monthOffsets[range]);
  return getLocalDateString(date);
}

export function getWeightRangeLabel(range: WeightRange) {
  return range;
}

export function parseDecimalInput(value: string) {
  return Number(value.trim().replace(",", "."));
}

export function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
      ? Array.from(crypto.getRandomValues(new Uint32Array(2)), (value) => value.toString(36)).join("")
      : Math.random().toString(36).slice(2);

  return `${Date.now().toString(36)}-${randomPart}`;
}
