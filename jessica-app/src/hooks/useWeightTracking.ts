import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  appendDebugLog,
  createClientId,
  getPreferredWeightUnit,
  getWeightRangeStartDate,
  parseDecimalInput,
  setStorageJson,
  verifyStorageCount,
  type Goals,
  type WeightEntry,
  type WeightForm,
  type WeightRange,
} from "../appSupport";

type UseWeightTrackingArgs = {
  today: string;
  goals: Goals | null;
  weightEntries: WeightEntry[];
  setWeightEntries: Dispatch<SetStateAction<WeightEntry[]>>;
  sortedWeightEntriesOldest: WeightEntry[];
};

export function useWeightTracking({
  today,
  goals,
  weightEntries,
  setWeightEntries,
  sortedWeightEntriesOldest,
}: UseWeightTrackingArgs) {
  const [weightForm, setWeightForm] = useState<WeightForm>({
    date: today,
    weight: "",
    note: "",
  });
  const [weightSaveError, setWeightSaveError] = useState("");
  const [weightRange, setWeightRange] = useState<WeightRange>("All");
  const [weightChartPointId, setWeightChartPointId] = useState<string | null>(null);
  const [weightEntryToDelete, setWeightEntryToDelete] = useState<WeightEntry | null>(null);
  const [editingWeightEntryId, setEditingWeightEntryId] = useState<string | null>(null);

  const parsedWeightFormValue = parseDecimalInput(weightForm.weight);
  const isWeightFormValid = parsedWeightFormValue > 0 && Number.isFinite(parsedWeightFormValue);
  const weightRangeStartDate = getWeightRangeStartDate(weightRange, today);
  const chartWeightEntries = useMemo(
    () =>
      weightRange === "All"
        ? sortedWeightEntriesOldest
        : sortedWeightEntriesOldest.filter((entry) => entry.date >= weightRangeStartDate),
    [weightRange, sortedWeightEntriesOldest, weightRangeStartDate]
  );

  function saveWeightEntry(weightOverride?: string) {
    setWeightSaveError("");
    const weight = parseDecimalInput(weightOverride ?? weightForm.weight);
    appendDebugLog("weight-save-click", {
      rawWeight: weightForm.weight,
      parsedWeight: weight,
      date: weightForm.date,
      editingWeightEntryId,
      disabledState: !isWeightFormValid,
    });

    if (!Number.isFinite(weight) || weight <= 0) {
      const message = "Enter a valid weight before saving.";
      setWeightSaveError(message);
      appendDebugLog("weight-save-invalid", { rawWeight: weightForm.weight, parsedWeight: weight });
      return;
    }

    const entry: WeightEntry = {
      id: editingWeightEntryId ?? createClientId(),
      date: weightForm.date || today,
      weight,
      unit: getPreferredWeightUnit(goals),
      note: weightForm.note.trim() || undefined,
    };

    const nextWeightEntries = editingWeightEntryId
      ? weightEntries.map((item) => (item.id === editingWeightEntryId ? entry : item))
      : [entry, ...weightEntries];
    const storageOk = setStorageJson("weightEntries", nextWeightEntries);
    const verified = verifyStorageCount("weightEntries", nextWeightEntries.length);

    setWeightEntries(nextWeightEntries);

    if (!storageOk || !verified) {
      const message = "Weight was created in memory, but this browser did not confirm it was saved.";
      setWeightSaveError(message);
      appendDebugLog("weight-save-not-persisted", { storageOk, verified });
      return;
    }

    setEditingWeightEntryId(null);
    setWeightForm({
      date: today,
      weight: "",
      note: "",
    });
    appendDebugLog("weight-save-success", {
      id: entry.id,
      count: nextWeightEntries.length,
      persisted: true,
    });
  }

  function startEditWeightEntry(entry: WeightEntry) {
    setEditingWeightEntryId(entry.id);

    setWeightForm({
      date: entry.date,
      weight: String(entry.weight),
      note: entry.note ?? "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function confirmDeleteWeightEntry() {
    if (!weightEntryToDelete) return;

    setWeightEntries(weightEntries.filter((entry) => entry.id !== weightEntryToDelete.id));
    setWeightEntryToDelete(null);
  }

  return {
    weightForm,
    setWeightForm,
    weightSaveError,
    setWeightSaveError,
    weightRange,
    setWeightRange,
    weightChartPointId,
    setWeightChartPointId,
    weightEntryToDelete,
    setWeightEntryToDelete,
    editingWeightEntryId,
    setEditingWeightEntryId,
    isWeightFormValid,
    chartWeightEntries,
    saveWeightEntry,
    startEditWeightEntry,
    confirmDeleteWeightEntry,
  };
}
