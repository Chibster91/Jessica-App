import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  appendDebugLog,
  setStorageJson,
  getSavedLog,
  validateImportDraft,
  parseFoodLogImportJson,
  normalizeMealName,
  getRecentFoods,
  searchFoodsGrouped,
  createClientId,
  createNegativeFoodId,
  type SearchResultGroup,
  type Food,
  type Recipe,
  type LogItem,
  type WeightEntry,
  type TopFoodEntry,
  type FoodLogImportDraft,
  type WeightImportEntry,
} from "../appSupport";
import {
  importCandidateCache,
  importUsdaCandidateCache,
  parseImportServingBasis,
  buildImportFoodFromDraft,
  normalizeImportMatchName,
  normalizeImportName,
  tokenSortSimilarityNormalized,
  getMeaningfulImportTokens,
  getImportSpecificityCoverage,
  isGenericImportCandidate,
  importFoodUnitRatio,
  getCalorieScaledImportQuantity,
  getImportFoodCandidate,
  getDefaultImportReviewSelection,
  buildImportFoodBatchResolver,
  dedupeCustomFoods,
  remapLogFoodIds,
  remapSavedLogFoodIds,
  type ImportFoodBatchResolver,
  type ImportResolutionProgress,
  type ImportReviewAction,
  type ImportMatchSource,
  type ImportReviewMode,
  type ImportFoodCandidate,
  type ImportReviewItem,
  type ImportDayStep,
} from "../importMatching";

type UseImportFlowArgs = {
  selectedDate: string;
  log: LogItem[];
  setLog: Dispatch<SetStateAction<LogItem[]>>;
  setSelectedDate: Dispatch<SetStateAction<string>>;
  customFoods: Food[];
  setCustomFoods: Dispatch<SetStateAction<Food[]>>;
  recipes: Recipe[];
  setWeightEntries: Dispatch<SetStateAction<WeightEntry[]>>;
  setTopFoods: Dispatch<SetStateAction<TopFoodEntry[]>>;
  setCompletedDays: Dispatch<SetStateAction<string[]>>;
};

export function useImportFlow({
  selectedDate,
  log,
  setLog,
  setSelectedDate,
  customFoods,
  setCustomFoods,
  recipes,
  setWeightEntries,
  setTopFoods,
  setCompletedDays,
}: UseImportFlowArgs) {
  const importFoodBatchResolverRef = useRef<ImportFoodBatchResolver | null>(null);
  const skipCustomFoodLibraryRef = useRef(false);
  const [importDrafts, setImportDrafts] = useState<FoodLogImportDraft[]>([]);
  const [importWeightEntries, setImportWeightEntries] = useState<WeightImportEntry[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importStatus, setImportStatus] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importSteps, setImportSteps] = useState<ImportDayStep[]>([]);
  const [importStepIndex, setImportStepIndex] = useState(0);
  const [importStepResults, setImportStepResults] = useState({ confirmed: 0, skipped: 0 });
  const [importDuplicatesSkipped, setImportDuplicatesSkipped] = useState(0);
  const [importConfirmedDates, setImportConfirmedDates] = useState<string[]>([]);
  const [importReviewItems, setImportReviewItems] = useState<ImportReviewItem[]>([]);
  const [importReviewSelections, setImportReviewSelections] = useState<Record<string, string>>({});
  const [importReviewAppliedSelections, setImportReviewAppliedSelections] = useState<Record<string, string>>({});
  const [importReviewActions, setImportReviewActions] = useState<Record<string, ImportReviewAction>>({});
  const [expandedImportReviewGroups, setExpandedImportReviewGroups] = useState<Record<string, boolean>>({});
  const [importReviewManualCandidates, setImportReviewManualCandidates] = useState<Record<string, ImportFoodCandidate>>({});
  const [rememberedImportMatches, setRememberedImportMatches] = useState<Record<string, ImportFoodCandidate>>({});
  const [importReviewRememberedRows, setImportReviewRememberedRows] = useState<Record<string, boolean>>({});
  const [importReviewManualTarget, setImportReviewManualTarget] = useState<FoodLogImportDraft | null>(null);
  const [importReviewManualQuery, setImportReviewManualQuery] = useState("");
  const [importReviewManualGroups, setImportReviewManualGroups] = useState<SearchResultGroup[]>([]);
  const [isImportReviewManualSearching, setIsImportReviewManualSearching] = useState(false);
  const [unresolvedImportReviewIds, setUnresolvedImportReviewIds] = useState<string[]>([]);
  const [importResolutionProgress, setImportResolutionProgress] = useState<ImportResolutionProgress | null>(null);
  const [importReviewMode, setImportReviewMode] = useState<ImportReviewMode | null>(null);
  const [isResolvingImport, setIsResolvingImport] = useState(false);
  const [isImportDayOpen, setIsImportDayOpen] = useState(false);

  async function readFoodLogImport(file: File | undefined) {
    setImportStatus("");
    setImportErrors([]);
    setImportFileName(file?.name ?? "");

    if (!file) return;

    try {
      await loadFoodLogImportText(await file.text(), file.name);
    } catch (error) {
      setImportDrafts([]);
      setImportErrors([`Could not read JSON: ${error instanceof Error ? error.message : String(error)}`]);
    }
  }

  function openImportFilePicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => readFoodLogImport(input.files?.[0]);
    input.click();
  }

  async function loadFoodLogImportText(text: string, fileName: string) {
    try {
      importCandidateCache.clear();
      importUsdaCandidateCache.clear();
      const parsed = JSON.parse(text) as unknown;
      const result = parseFoodLogImportJson(parsed);

      setImportFileName(fileName);
      setImportStatus("");
      setImportReviewItems([]);
      setImportReviewSelections({});
      setImportReviewAppliedSelections({});
      setImportReviewActions({});
      setExpandedImportReviewGroups({});
      setImportReviewManualCandidates({});
      setRememberedImportMatches({});
      setImportReviewRememberedRows({});
      setImportReviewManualTarget(null);
      setImportReviewManualQuery("");
      setImportReviewManualGroups([]);
      setUnresolvedImportReviewIds([]);
      setImportResolutionProgress(null);

      if (result.ok === false) {
        setImportDrafts([]);
        setImportErrors(result.errors);
        importFoodBatchResolverRef.current = null;
        return;
      }

      setImportErrors([]);
      importFoodBatchResolverRef.current = null;
      setImportSteps([]);
      setImportStepIndex(0);
      setImportStepResults({ confirmed: 0, skipped: 0 });
      setImportConfirmedDates([]);
      setImportDrafts(result.items);
      setImportWeightEntries(result.weightEntries);

      const validationErrors = result.items.flatMap((item, index) => validateImportDraft(item, index));
      if (validationErrors.length > 0) {
        setImportErrors(validationErrors);
        return;
      }

      if (result.items.length === 0) {
        setImportStatus("No food items were found in this import.");
        return;
      }

      setIsResolvingImport(true);
      setImportResolutionProgress({ resolved: 0, total: result.items.length });
      try {
        const batch = await buildImportFoodBatchResolver(result.items, customFoods, recipes, {}, {
          forceReviewAll: true,
          onProgress: setImportResolutionProgress,
        });
        primeImportReview(batch.reviewItems, "preview");
      } catch (error) {
        appendDebugLog("import-file-resolution-failed", {
          message: error instanceof Error ? error.message : String(error),
        });
        setImportErrors([`Could not resolve food matches: ${error instanceof Error ? error.message : String(error)}`]);
      } finally {
        setIsResolvingImport(false);
        setImportResolutionProgress(null);
      }
    } catch (error) {
      setImportDrafts([]);
      setImportErrors([`Could not read JSON: ${error instanceof Error ? error.message : String(error)}`]);
      setIsResolvingImport(false);
      setImportResolutionProgress(null);
    }
  }

  function updateImportDraft(id: string, updates: Partial<FoodLogImportDraft>) {
    setImportDrafts((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
    setImportErrors([]);
  }

  function removeImportDraft(id: string) {
    setImportDrafts((current) => current.filter((item) => item.id !== id));
    setImportErrors([]);
  }

  function removeImportWeightEntry(id: string) {
    setImportWeightEntries((current) => current.filter((entry) => entry.id !== id));
    setImportErrors([]);
  }

  function closeImportPreview() {
    setImportDrafts([]);
    setImportWeightEntries([]);
    setImportErrors([]);
    setImportFileName("");
    setImportReviewItems([]);
    setImportReviewSelections({});
    setImportReviewAppliedSelections({});
    setImportReviewActions({});
    setExpandedImportReviewGroups({});
    setImportReviewManualCandidates({});
    setRememberedImportMatches({});
    setImportReviewRememberedRows({});
    setImportReviewManualTarget(null);
    setImportReviewManualQuery("");
    setImportReviewManualGroups([]);
    setUnresolvedImportReviewIds([]);
    setImportResolutionProgress(null);
    setImportReviewMode(null);
    importFoodBatchResolverRef.current = null;
    skipCustomFoodLibraryRef.current = false;
  }

  function clearImportStepper() {
    setImportSteps([]);
    setImportStepIndex(0);
    setImportStepResults({ confirmed: 0, skipped: 0 });
    setImportDuplicatesSkipped(0);
    setImportConfirmedDates([]);
    setImportFileName("");
    setImportErrors([]);
    setImportReviewItems([]);
    setImportReviewSelections({});
    setImportReviewAppliedSelections({});
    setImportReviewActions({});
    setExpandedImportReviewGroups({});
    setImportReviewManualCandidates({});
    setRememberedImportMatches({});
    setImportReviewRememberedRows({});
    setImportReviewManualTarget(null);
    setImportReviewManualQuery("");
    setImportReviewManualGroups([]);
    setUnresolvedImportReviewIds([]);
    setImportResolutionProgress(null);
    setImportReviewMode(null);
    importFoodBatchResolverRef.current = null;
    skipCustomFoodLibraryRef.current = false;
  }

  function resetImportStateForDebugClear() {
    setImportStatus("Debug clear complete. Food logs, custom foods, and recipes were removed.");
    setImportErrors([]);
    setImportDrafts([]);
    setImportSteps([]);
    setImportStepResults({ confirmed: 0, skipped: 0 });
    setImportReviewItems([]);
    setImportReviewSelections({});
    setImportReviewAppliedSelections({});
    setImportReviewActions({});
    setExpandedImportReviewGroups({});
    setImportReviewManualCandidates({});
    setRememberedImportMatches({});
    setImportReviewRememberedRows({});
    setImportReviewManualTarget(null);
    setImportReviewManualQuery("");
    setImportReviewManualGroups([]);
    setUnresolvedImportReviewIds([]);
    setImportResolutionProgress(null);
    setIsResolvingImport(false);
  }

  function getResolvedImportedFoods(items: FoodLogImportDraft[], resolver: ImportFoodBatchResolver) {
    return items.map((item) => {
      const resolved = resolver.byDraftId.get(item.id) ?? buildImportFoodFromDraft(item, createNegativeFoodId());
      return {
        date: item.date,
        meal: normalizeMealName(item.meal),
        food: resolved.food,
        quantity: resolved.quantity,
        importAudit: resolved.importAudit,
      };
    });
  }

  function getImportFingerprint(item: Pick<LogItem, "category" | "name" | "quantity" | "calories">) {
    return [item.category, item.name.trim().toLowerCase(), String(item.quantity), String(Math.round(item.calories))].join("|");
  }

  function applyImportedFoods(importedFoods: ReturnType<typeof getResolvedImportedFoods>) {
    const newCustomFoods = Array.from(
      new Map(
        importedFoods
          .map((entry) => entry.food)
          .filter((food) =>
            food.id < 0 &&
            !customFoods.some((existing) => existing.id === food.id)
          )
          .map((food) => [food.id, food])
      ).values()
    );
    const { foods: dedupedCustomFoods, foodRemap } = dedupeCustomFoods([...newCustomFoods, ...customFoods]);
    const nextLogsByDate = new Map<string, LogItem[]>();
    // Counts of matching entries already in each day's log before this import; an
    // incoming entry consumes one count and is skipped, so re-importing the same
    // backup doesn't double a day while identical-by-design entries still import.
    const existingEntryCounts = new Map<string, Map<string, number>>();
    const appendedEntries: typeof importedFoods = [];
    let skippedDuplicates = 0;

    for (const entry of importedFoods) {
      const existingLog = nextLogsByDate.get(entry.date) ?? (entry.date === selectedDate ? log : getSavedLog(entry.date));
      if (!existingEntryCounts.has(entry.date)) {
        const counts = new Map<string, number>();
        for (const item of existingLog) {
          const key = getImportFingerprint(item);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        existingEntryCounts.set(entry.date, counts);
      }

      const nextItem: LogItem = {
        ...entry.food,
        logId: createClientId(),
        category: entry.meal,
        quantity: entry.quantity,
        importAudit: entry.importAudit,
      };
      const counts = existingEntryCounts.get(entry.date)!;
      const fingerprint = getImportFingerprint(nextItem);
      const remaining = counts.get(fingerprint) ?? 0;
      if (remaining > 0) {
        counts.set(fingerprint, remaining - 1);
        skippedDuplicates += 1;
        nextLogsByDate.set(entry.date, existingLog);
        continue;
      }

      appendedEntries.push(entry);
      nextLogsByDate.set(entry.date, [...existingLog, nextItem]);
    }

    for (const [date, nextLog] of nextLogsByDate) {
      setStorageJson(`log-${date}`, remapLogFoodIds(nextLog, foodRemap));
    }
    remapSavedLogFoodIds(foodRemap);
    if (!skipCustomFoodLibraryRef.current) {
      setCustomFoods(dedupedCustomFoods);
    }
    setTopFoods((current) => {
      const counts = new Map(current.map((food) => [food.name, food.count]));
      appendedEntries.forEach((entry) => {
        counts.set(entry.food.name, (counts.get(entry.food.name) ?? 0) + 1);
      });

      return Array.from(counts, ([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    });

    const importedDates = Array.from(new Set(appendedEntries.map((entry) => entry.date)));
    if (importedDates.length > 0) {
      setCompletedDays((current) => {
        const existing = new Set(current);
        const toAdd = importedDates.filter((date) => !existing.has(date));
        return toAdd.length > 0 ? [...current, ...toAdd] : current;
      });
    }

    return { nextLogsByDate, foodRemap, importedCount: appendedEntries.length, skippedDuplicates };
  }

  function primeImportReview(reviewItems: ImportReviewItem[], mode: ImportReviewMode) {
    const nextManualCandidates: Record<string, ImportFoodCandidate> = {};
    const nextRememberedRows: Record<string, boolean> = {};
    const nextReviewItems = reviewItems.map((review) => {
      const remembered = rememberedImportMatches[normalizeImportName(review.item.name)];
      if (!remembered) return review;

      const candidate = buildManualImportCandidate(review.item, remembered.food);
      nextManualCandidates[review.item.id] = candidate;
      nextRememberedRows[review.item.id] = true;
      return {
        ...review,
        candidates: [
          candidate,
          ...review.candidates.filter((existing) => existing.key !== candidate.key),
        ],
      };
    });

    setImportReviewItems(nextReviewItems);
    setImportReviewSelections(Object.fromEntries(
      nextReviewItems.map((review) => [review.item.id, nextManualCandidates[review.item.id]?.key ?? getDefaultImportReviewSelection(review)])
    ));
    setImportReviewAppliedSelections({});
    setImportReviewActions({});
    setExpandedImportReviewGroups({});
    setImportReviewManualCandidates(nextManualCandidates);
    setImportReviewRememberedRows(nextRememberedRows);
    setImportReviewManualTarget(null);
    setImportReviewManualQuery("");
    setImportReviewManualGroups([]);
    setUnresolvedImportReviewIds([]);
    setImportReviewMode(mode);
    setImportStatus(`${reviewItems.length} imported food${reviewItems.length === 1 ? "" : "s"} need match review.`);
  }

  async function confirmImportStep() {
    const step = importSteps[importStepIndex];
    if (!step) return;

    if (step.items.length > 0) {
      if (!importFoodBatchResolverRef.current) {
        setIsResolvingImport(true);
        try {
          const result = await buildImportFoodBatchResolver(importSteps.flatMap((s) => s.items), customFoods, recipes);
          if (result.reviewItems.length > 0) {
            primeImportReview(result.reviewItems, "step");
            return;
          }
          importFoodBatchResolverRef.current = result.resolver;
        } catch (error) {
          appendDebugLog("import-step-resolution-failed", {
            message: error instanceof Error ? error.message : String(error),
          });
          setImportErrors([`Could not resolve food matches: ${error instanceof Error ? error.message : String(error)}`]);
          return;
        } finally {
          setIsResolvingImport(false);
        }
      }

      const resolver = importFoodBatchResolverRef.current;
      const { nextLogsByDate, foodRemap, skippedDuplicates } = applyImportedFoods(getResolvedImportedFoods(step.items, resolver));
      if (skippedDuplicates > 0) setImportDuplicatesSkipped((prev) => prev + skippedDuplicates);
      if (step.date === selectedDate) setLog(remapLogFoodIds(nextLogsByDate.get(step.date) ?? getSavedLog(step.date), foodRemap));
    }

    if (step.weightEntry) {
      setWeightEntries((current) => [
        ...current,
        { id: createClientId(), date: step.weightEntry!.date, weight: step.weightEntry!.weightLb, unit: "lb" as const },
      ]);
    }

    setImportStepResults((prev) => ({ ...prev, confirmed: prev.confirmed + 1 }));
    setImportConfirmedDates((prev) => [...prev, step.date]);
    setImportStepIndex((prev) => prev + 1);
  }

  function skipImportStep() {
    setImportStepResults((prev) => ({ ...prev, skipped: prev.skipped + 1 }));
    setImportStepIndex((prev) => prev + 1);
  }

  function cancelImportStepper() {
    const { confirmed } = importStepResults;
    if (confirmed > 0) {
      const firstDate = importConfirmedDates[0];
      if (firstDate) {
        setSelectedDate(firstDate);
        setLog(getSavedLog(firstDate));
      }
      setImportStatus(`Imported ${confirmed} of ${importSteps.length} day${importSteps.length === 1 ? "" : "s"}.`);
    }
    clearImportStepper();
  }

  function closeImportSummary() {
    const firstDate = importConfirmedDates[0];
    if (firstDate) {
      setSelectedDate(firstDate);
      setLog(getSavedLog(firstDate));
    }
    const { confirmed, skipped } = importStepResults;
    const parts: string[] = [];
    if (confirmed > 0) parts.push(`${confirmed} day${confirmed === 1 ? "" : "s"} imported`);
    if (skipped > 0) parts.push(`${skipped} skipped`);
    if (importDuplicatesSkipped > 0) parts.push(`${importDuplicatesSkipped} duplicate item${importDuplicatesSkipped === 1 ? "" : "s"} already logged`);
    if (parts.length > 0) setImportStatus(parts.join(", ") + ".");
    clearImportStepper();
  }

  async function confirmFoodLogImport() {
    const validationErrors = importDrafts.flatMap((item, index) => validateImportDraft(item, index));
    if (validationErrors.length > 0) {
      setImportErrors(validationErrors);
      return;
    }

    setIsResolvingImport(true);
    try {
      const result = await buildImportFoodBatchResolver(importDrafts, customFoods, recipes);
      if (result.reviewItems.length > 0) {
        primeImportReview(result.reviewItems, "preview");
        return;
      }
      importFoodBatchResolverRef.current = result.resolver;
      finalizeFoodLogImport(result.resolver);
    } catch (error) {
      appendDebugLog("import-preview-resolution-failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      setImportErrors([`Could not resolve food matches: ${error instanceof Error ? error.message : String(error)}`]);
    } finally {
      setIsResolvingImport(false);
    }
  }

  function finalizeFoodLogImport(resolver: ImportFoodBatchResolver, items: FoodLogImportDraft[] = importDrafts) {
    const importedFoods = getResolvedImportedFoods(items, resolver);
    const { nextLogsByDate, foodRemap, importedCount, skippedDuplicates } = applyImportedFoods(importedFoods);

    const firstDate = importedFoods[0]?.date ?? selectedDate;
    if (nextLogsByDate.has(firstDate)) {
      setSelectedDate(firstDate);
      setLog(remapLogFoodIds(nextLogsByDate.get(firstDate) ?? getSavedLog(firstDate), foodRemap));
    }

    if (importWeightEntries.length > 0) {
      const newWeightEntries: WeightEntry[] = importWeightEntries.map((entry) => ({
        id: createClientId(),
        date: entry.date,
        weight: entry.weightLb,
        unit: "lb" as const,
      }));
      setWeightEntries((current) => [...current, ...newWeightEntries]);
    }

    const parts: string[] = [];
    if (importedCount > 0) parts.push(`${importedCount} food${importedCount === 1 ? "" : "s"}`);
    if (importWeightEntries.length > 0) parts.push(`${importWeightEntries.length} weight entr${importWeightEntries.length === 1 ? "y" : "ies"}`);
    const duplicateNote = skippedDuplicates > 0 ? ` Skipped ${skippedDuplicates} duplicate item${skippedDuplicates === 1 ? "" : "s"} already logged.` : "";
    setImportStatus(parts.length > 0 ? `Imported ${parts.join(" and ")}.${duplicateNote}` : `No new food items were imported.${duplicateNote}`);
    closeImportPreview();
  }

  async function confirmImportReview() {
    const items = importReviewMode === "step" ? importSteps.flatMap((step) => step.items) : importDrafts;
    const unresolvedIds = importReviewItems
      .map((review) => review.item.id)
      .filter((id) => !importReviewActions[id]);

    if (unresolvedIds.length > 0) {
      setUnresolvedImportReviewIds(unresolvedIds);
      setImportErrors([`Resolve all imported foods before confirming. ${unresolvedIds.length} row${unresolvedIds.length === 1 ? "" : "s"} still need Apply or Reject.`]);
      window.setTimeout(() => {
        document.querySelector(".import-review-row.is-unresolved")?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 0);
      return;
    }

    const rejectedIds = new Set(
      Object.entries(importReviewActions)
        .filter(([, action]) => action === "rejected")
        .map(([id]) => id)
    );
    const appliedItems = items.filter((item) => !rejectedIds.has(item.id));
    const appliedSelections = Object.fromEntries(
      appliedItems.map((item) => [item.id, importReviewAppliedSelections[item.id] ?? importReviewSelections[item.id] ?? "new"])
    );

    setIsResolvingImport(true);
    try {
      const result = await buildImportFoodBatchResolver(appliedItems, customFoods, recipes, appliedSelections, {
        manualCandidates: importReviewManualCandidates,
      });
      if (result.reviewItems.length > 0) {
        primeImportReview(result.reviewItems, importReviewMode ?? "preview");
        return;
      }
      importFoodBatchResolverRef.current = result.resolver;
      setImportReviewItems([]);
      setImportReviewSelections({});
      setImportReviewAppliedSelections({});
      setImportReviewActions({});
      setExpandedImportReviewGroups({});
      setImportReviewManualCandidates({});
      setRememberedImportMatches({});
      setImportReviewRememberedRows({});
      setImportReviewManualTarget(null);
      setImportReviewManualQuery("");
      setImportReviewManualGroups([]);
      setUnresolvedImportReviewIds([]);
      setImportReviewMode(null);
      finalizeFoodLogImport(result.resolver, appliedItems);
    } catch (error) {
      appendDebugLog("import-review-resolution-failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      setImportErrors([`Could not resolve reviewed matches: ${error instanceof Error ? error.message : String(error)}`]);
    } finally {
      setIsResolvingImport(false);
    }
  }

  function updateImportReviewSelection(itemId: string, value: string) {
    const item = importReviewItems.find((review) => review.item.id === itemId)?.item;
    const groupItems = item ? getImportReviewGroupItems(item) : [];
    const groupIds = groupItems.length > 0 ? groupItems.map((groupItem) => groupItem.id) : [itemId];
    const groupUpdates = Object.fromEntries(groupIds.map((id) => [id, value]));

    setImportReviewSelections((current) => ({ ...current, ...groupUpdates }));
    setImportReviewAppliedSelections((current) => {
      const next = { ...current };
      groupIds.forEach((id) => delete next[id]);
      return next;
    });
    setImportReviewActions((current) => {
      const next = { ...current };
      groupIds.forEach((id) => delete next[id]);
      return next;
    });
    setImportReviewRememberedRows((current) => {
      const next = { ...current };
      groupIds.forEach((id) => delete next[id]);
      return next;
    });
    if (item) setExpandedImportReviewGroups((current) => ({ ...current, [getImportReviewGroupKey(item)]: true }));
    setUnresolvedImportReviewIds((current) => current.filter((id) => !groupIds.includes(id)));
    setImportErrors([]);
  }

  function getImportReviewCandidateForSelection(item: FoodLogImportDraft, selected: string) {
    const review = importReviewItems.find((reviewItem) => reviewItem.item.id === item.id);
    return review?.candidates.find((candidate) => candidate.key === selected) ??
      (importReviewManualCandidates[item.id]?.key === selected ? importReviewManualCandidates[item.id] : null);
  }

  function getImportReviewGroupKey(item: FoodLogImportDraft) {
    return normalizeImportName(item.name);
  }

  function getImportReviewGroupItems(item: FoodLogImportDraft) {
    const groupKey = getImportReviewGroupKey(item);
    return importReviewItems
      .map((review) => review.item)
      .filter((reviewItem) => getImportReviewGroupKey(reviewItem) === groupKey);
  }

  function expandImportReviewGroup(item: FoodLogImportDraft) {
    setExpandedImportReviewGroups((current) => ({ ...current, [getImportReviewGroupKey(item)]: true }));
  }

  function applyImportReviewToSimilar(item: FoodLogImportDraft) {
    const selected = importReviewSelections[item.id] ?? "new";
    const selectedCandidate = selected === "new" ? null : getImportReviewCandidateForSelection(item, selected);
    const rememberedKey = normalizeImportName(item.name);
    const candidatesById: Record<string, ImportFoodCandidate> = {};
    const groupItems = getImportReviewGroupItems(item);
    const selectionById: Record<string, string> = {};
    const appliedById: Record<string, string> = {};
    const actionById: Record<string, ImportReviewAction> = {};
    const rememberedRowsById: Record<string, boolean> = {};

    for (const groupItem of groupItems) {
      actionById[groupItem.id] = "applied";

      if (selectedCandidate && groupItem.id !== item.id) {
        const candidate = buildManualImportCandidate(groupItem, selectedCandidate.food);
        candidatesById[groupItem.id] = candidate;
        selectionById[groupItem.id] = candidate.key;
        appliedById[groupItem.id] = candidate.key;
        rememberedRowsById[groupItem.id] = true;
      } else {
        selectionById[groupItem.id] = selected;
        appliedById[groupItem.id] = selected;
      }
    }

    if (selectedCandidate) {
      setRememberedImportMatches((current) => ({ ...current, [rememberedKey]: selectedCandidate }));
      setImportReviewManualCandidates((current) => ({ ...current, ...candidatesById }));
      setImportReviewItems((current) =>
        current.map((review) =>
          candidatesById[review.item.id]
            ? {
                ...review,
                candidates: [
                  candidatesById[review.item.id],
                  ...review.candidates.filter((existing) => existing.key !== candidatesById[review.item.id].key),
                ],
              }
            : review
        )
      );
    }

    setImportReviewSelections((current) => ({ ...current, ...selectionById }));
    setImportReviewAppliedSelections((current) => ({ ...current, ...appliedById }));
    setImportReviewActions((current) => ({ ...current, ...actionById }));
    setImportReviewRememberedRows((current) => {
      const next = { ...current };
      delete next[item.id];
      return { ...next, ...rememberedRowsById };
    });
    setExpandedImportReviewGroups((current) => ({ ...current, [rememberedKey]: false }));
    setUnresolvedImportReviewIds((current) => current.filter((id) => !(id in actionById)));
    setImportErrors([]);
  }

  function rejectImportReviewItem(item: FoodLogImportDraft) {
    const groupKey = getImportReviewGroupKey(item);
    const rejectedById = Object.fromEntries(getImportReviewGroupItems(item).map((groupItem) => [groupItem.id, "rejected" as const]));
    setImportReviewActions((current) => ({ ...current, ...rejectedById }));
    setImportReviewAppliedSelections((current) => {
      const next = { ...current };
      Object.keys(rejectedById).forEach((id) => delete next[id]);
      return next;
    });
    setImportReviewRememberedRows((current) => {
      const next = { ...current };
      Object.keys(rejectedById).forEach((id) => delete next[id]);
      return next;
    });
    setExpandedImportReviewGroups((current) => ({ ...current, [groupKey]: false }));
    setUnresolvedImportReviewIds((current) => current.filter((id) => !(id in rejectedById)));
    setImportErrors([]);
  }

  function getManualImportMatchSource(food: Food): ImportMatchSource {
    if (recipes.some((recipe) => recipe.id === food.id)) return "recipe";
    if (customFoods.some((customFood) => customFood.id === food.id)) return "custom";
    return food.dataType === "local" ? "local" : "usda";
  }

  function buildManualImportCandidate(item: FoodLogImportDraft, food: Food): ImportFoodCandidate {
    const source = getManualImportMatchSource(food);
    const imported = buildImportFoodFromDraft(item, createNegativeFoodId());
    const importedBasis = parseImportServingBasis(imported.food.servingSize);
    const candidateBasis = parseImportServingBasis(food.servingSize);
    const ratio = importFoodUnitRatio(importedBasis, candidateBasis, imported.food.name, food.name);
    const autoCandidate = getImportFoodCandidate(imported, food, source);
    const importedTokens = getMeaningfulImportTokens(imported.food.name);
    const candidateTokens = getMeaningfulImportTokens(food.name);
    const specificityCoverage = autoCandidate?.specificityCoverage ?? getImportSpecificityCoverage(importedTokens, candidateTokens);
    const isGenericMatch = autoCandidate?.isGenericMatch ?? isGenericImportCandidate(importedTokens, candidateTokens, specificityCoverage);
    const key = `manual:${source}:${food.id}`;

    return {
      key,
      source,
      sourceLabel: autoCandidate?.sourceLabel ?? (source === "local" ? "Local" : source === "custom" ? "Custom" : source === "recipe" ? "Recipe" : "USDA"),
      food,
      score: autoCandidate?.score ?? 0,
      confidence: autoCandidate?.confidence ?? "medium",
      quantity: getCalorieScaledImportQuantity(imported, food),
      nameSimilarity: autoCandidate?.nameSimilarity ?? tokenSortSimilarityNormalized(normalizeImportMatchName(imported.food.name), normalizeImportMatchName(food.name)),
      unitCompatible: autoCandidate?.unitCompatible ?? ratio !== null,
      nutritionEdge: autoCandidate?.nutritionEdge ?? false,
      specificityCoverage,
      genericPenalty: autoCandidate?.genericPenalty ?? (isGenericMatch ? 35 : 0),
      isGenericMatch,
    };
  }

  function openImportReviewManualSearch(item: FoodLogImportDraft) {
    setImportReviewManualTarget(item);
    setImportReviewManualQuery(item.name);
    setImportReviewManualGroups([]);
    setImportErrors([]);
  }

  function closeImportReviewManualSearch() {
    setImportReviewManualTarget(null);
    setImportReviewManualQuery("");
    setImportReviewManualGroups([]);
    setIsImportReviewManualSearching(false);
  }

  async function searchImportReviewManualFoods() {
    const query = importReviewManualQuery.trim();
    if (!query) return;

    setIsImportReviewManualSearching(true);
    try {
      setImportReviewManualGroups(await searchFoodsGrouped(query, customFoods, getRecentFoods(selectedDate), recipes));
    } catch (error) {
      appendDebugLog("import-review-manual-search-failed", {
        query,
        message: error instanceof Error ? error.message : String(error),
      });
      setImportErrors([`Manual search failed: ${error instanceof Error ? error.message : String(error)}`]);
    } finally {
      setIsImportReviewManualSearching(false);
    }
  }

  function selectImportReviewManualFood(food: Food) {
    if (!importReviewManualTarget) return;

    const item = importReviewManualTarget;
    const rememberedKey = normalizeImportName(item.name);
    const matchingReviews = importReviewItems.filter((review) => {
      if (normalizeImportName(review.item.name) !== rememberedKey) return false;
      return true;
    });
    const candidatesById = Object.fromEntries(
      matchingReviews.map((review) => [review.item.id, buildManualImportCandidate(review.item, food)])
    );
    const selectionById = Object.fromEntries(
      Object.entries(candidatesById).map(([id, candidate]) => [id, candidate.key])
    );
    const rememberedRowsById = Object.fromEntries(
      matchingReviews
        .filter((review) => review.item.id !== item.id)
        .map((review) => [review.item.id, true])
    );

    setRememberedImportMatches((current) => ({ ...current, [rememberedKey]: buildManualImportCandidate(item, food) }));
    setImportReviewManualCandidates((current) => ({ ...current, ...candidatesById }));
    setImportReviewItems((current) =>
      current.map((review) =>
        candidatesById[review.item.id]
          ? {
              ...review,
              candidates: [
                candidatesById[review.item.id],
                ...review.candidates.filter((existing) => existing.key !== candidatesById[review.item.id].key),
              ],
            }
          : review
      )
    );
    setImportReviewSelections((current) => ({ ...current, ...selectionById }));
    setImportReviewAppliedSelections((current) => {
      const next = { ...current };
      Object.keys(candidatesById).forEach((id) => delete next[id]);
      return next;
    });
    setImportReviewActions((current) => {
      const next = { ...current };
      Object.keys(candidatesById).forEach((id) => delete next[id]);
      return next;
    });
    setImportReviewRememberedRows((current) => {
      const next = { ...current };
      delete next[item.id];
      return { ...next, ...rememberedRowsById };
    });
    setExpandedImportReviewGroups((current) => ({ ...current, [rememberedKey]: true }));
    setUnresolvedImportReviewIds((current) => current.filter((id) => !(id in candidatesById)));
    setImportErrors([]);
    closeImportReviewManualSearch();
  }

  function importAllAsIs() {
    // Bulk migration path: trust the file's own name + nutrition for every item,
    // skip database matching entirely, and don't add anything to the custom food
    // library (each log entry carries its nutrition inline). Only valid for the
    // file-import review ("preview" mode), not the day-by-day stepper.
    if (importReviewMode !== "preview" || importDrafts.length === 0) return;

    const resolver: ImportFoodBatchResolver = {
      byDraftId: new Map(
        importDrafts.map((item) => [item.id, buildImportFoodFromDraft(item, createNegativeFoodId())])
      ),
      addedFoodIds: new Set<number>(),
    };

    skipCustomFoodLibraryRef.current = true;
    importFoodBatchResolverRef.current = resolver;
    setImportReviewItems([]);
    setImportReviewSelections({});
    setImportReviewAppliedSelections({});
    setImportReviewActions({});
    setExpandedImportReviewGroups({});
    setImportReviewManualCandidates({});
    setRememberedImportMatches({});
    setImportReviewRememberedRows({});
    setImportReviewManualTarget(null);
    setImportReviewManualQuery("");
    setImportReviewManualGroups([]);
    setUnresolvedImportReviewIds([]);
    setImportReviewMode(null);
    finalizeFoodLogImport(resolver, importDrafts);
  }

  function applyAllImportReview() {
    const pending = importReviewItems.filter((review) => !importReviewActions[review.item.id]);
    if (pending.length === 0) return;

    const nextActions: Record<string, ImportReviewAction> = {};
    const nextApplied: Record<string, string> = {};

    for (const review of pending) {
      nextActions[review.item.id] = "applied";
      nextApplied[review.item.id] = "new";
    }

    skipCustomFoodLibraryRef.current = true;
    setImportReviewActions((current) => ({ ...current, ...nextActions }));
    setImportReviewAppliedSelections((current) => ({ ...current, ...nextApplied }));
    setUnresolvedImportReviewIds([]);
    setImportErrors([]);
  }

  return {
    importDrafts,
    importWeightEntries,
    importErrors,
    importStatus,
    importFileName,
    importSteps,
    importStepIndex,
    importStepResults,
    importConfirmedDates,
    importReviewItems,
    importReviewSelections,
    importReviewAppliedSelections,
    importReviewActions,
    expandedImportReviewGroups,
    importReviewRememberedRows,
    importReviewManualTarget,
    importReviewManualQuery,
    setImportReviewManualQuery,
    importReviewManualGroups,
    isImportReviewManualSearching,
    unresolvedImportReviewIds,
    importResolutionProgress,
    isResolvingImport,
    isImportDayOpen,
    setIsImportDayOpen,
    openImportFilePicker,
    loadFoodLogImportText,
    updateImportDraft,
    removeImportDraft,
    removeImportWeightEntry,
    closeImportPreview,
    confirmImportStep,
    skipImportStep,
    cancelImportStepper,
    closeImportSummary,
    confirmFoodLogImport,
    confirmImportReview,
    updateImportReviewSelection,
    applyImportReviewToSimilar,
    applyAllImportReview,
    rejectImportReviewItem,
    expandImportReviewGroup,
    importAllAsIs,
    openImportReviewManualSearch,
    closeImportReviewManualSearch,
    searchImportReviewManualFoods,
    selectImportReviewManualFood,
    resetImportStateForDebugClear,
  };
}
