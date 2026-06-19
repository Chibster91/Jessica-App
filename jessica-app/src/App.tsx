import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { AppChrome } from "./components/AppChrome";
import { AppViewRouter } from "./components/AppViewRouter";
import { useImportFlow } from "./hooks/useImportFlow";
import { useDriveBackup } from "./hooks/useDriveBackup";
import { useProfileForm } from "./hooks/useProfileForm";
import {
  debugLogKey,
  oauthPendingActionKey,
  appendDebugLog,
  isDebugEnabled,
  setStorageJson,
  getSavedLog,
  getSavedCustomFoods,
  saveCustomFoods,
  getSavedRecipes,
  getSavedWeightEntries,
  saveWeightEntries,
  getSavedCompletedDays,
  saveCompletedDays,
  getSavedTopFoods,
  saveTopFoods,
  getMealCategoriesForLog,
  getSavedGoals,
  getSavedProfile,
  profileFormFromLegacyGoals,
  profileToGoals,
  saveRecipes,
  shiftDate,
  getLocalDateString,
  getItemCalories,
  getLogCategoryTotals,
  getRecentFoods,
  getFoodDisplayName,
  getBrandDisplayName,
  sortWeightEntriesNewestFirst,
  sortWeightEntriesOldestFirst,
  getPreferredWeightUnit,
  type Food,
  type Recipe,
  type AppView,
  type TopFoodEntry,
  type Goals,
  type Profile,
  type WeightEntry,
  type OAuthPendingAction,
  type LogItem
} from "./appSupport";
import { importCandidateCache, importUsdaCandidateCache } from "./importMatching";

type ThemeMode = "dark" | "light";

const themeStorageKey = "theme-mode";

function getSavedThemeMode(): ThemeMode {
  return localStorage.getItem(themeStorageKey) === "light" ? "light" : "dark";
}


/**
 * Returns the pending OAuth action if the app is loading after a PWA OAuth redirect,
 * otherwise null. Used in useState initializers so state is correct before the first render,
 * avoiding both a "home" flash and stale-closure issues in Drive actions.
 */
function getOAuthReturnPending(): OAuthPendingAction | null {
  if (!window.location.hash.includes("access_token=")) return null;
  const raw = localStorage.getItem(oauthPendingActionKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OAuthPendingAction;
    return Date.now() - parsed.timestamp < 10 * 60 * 1000 ? parsed : null;
  } catch {
    return null;
  }
}

function hasSavedLocalAppData() {
  if (
    getSavedProfile() ||
    getSavedGoals() ||
    getSavedCustomFoods().length > 0 ||
    getSavedRecipes().length > 0 ||
    getSavedWeightEntries().length > 0 ||
    getSavedCompletedDays().length > 0 ||
    getSavedTopFoods().length > 0
  ) {
    return true;
  }

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("log-")) return true;
  }

  return false;
}

function App() {
  const today = getLocalDateString();

  const [appView, setAppView] = useState<AppView>(() => {
    const pending = getOAuthReturnPending();
    if (pending?.returnView) return pending.returnView;
    return hasSavedLocalAppData() ? "day" : "profile";
  });
  const [selectedDate, setSelectedDate] = useState<string>(() => getOAuthReturnPending()?.returnDate ?? today);
  const [log, setLog] = useState<LogItem[]>(() => getSavedLog(getOAuthReturnPending()?.returnDate ?? today));
  const [customFoods, setCustomFoods] = useState<Food[]>(() => getSavedCustomFoods());
  const [recipes, setRecipes] = useState<Recipe[]>(() => getSavedRecipes());
  const [profile, setProfile] = useState<Profile | null>(() => getSavedProfile());
  const [goals, setGoals] = useState<Goals | null>(() => {
    const savedProfile = getSavedProfile();
    return savedProfile ? profileToGoals(savedProfile) : getSavedGoals();
  });
  const {
    profileForm,
    setProfileForm,
    profileSaveStatus,
    setProfileSaveStatus,
    profileWizardStep,
    setProfileWizardStep,
    isProfileWizardOpen,
    setIsProfileWizardOpen,
    updateProfileForm,
    cancelProfileChanges,
    saveProfile,
    patchProfile,
    setCycleTrackingPreference,
    profileCalculation,
    profileErrors,
    profileHasBlockingErrors,
    profileLowCalorieWarning,
  } = useProfileForm({ profile, setProfile, setGoals, setAppView, hasSavedLocalAppData });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getSavedThemeMode());
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>(() => getSavedWeightEntries());
  const [completedDays, setCompletedDays] = useState<string[]>(() => getSavedCompletedDays());
  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const [streakPopupDate, setStreakPopupDate] = useState(today);
  const [topFoods, setTopFoods] = useState<TopFoodEntry[]>(() => getSavedTopFoods());
  const [homeSelectedDate, setHomeSelectedDate] = useState<string | null>(null);
  const [goalsView, setGoalsView] = useState<"daily" | "weekly">("weekly");
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const [debugLogText, setDebugLogText] = useState("");
  const [debugCopyStatus, setDebugCopyStatus] = useState("");
  const {
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
    openImportReviewManualSearch,
    closeImportReviewManualSearch,
    searchImportReviewManualFoods,
    selectImportReviewManualFood,
    resetImportStateForDebugClear,
  } = useImportFlow({
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
  });

  const {
    isExportPanelOpen,
    setIsExportPanelOpen,
    exportStatus,
    setExportStatus,
    exportDriveLink,
    setExportDriveLink,
    isUploadingToDrive,
    googleDriveClientId,
    setGoogleDriveClientId,
    driveImportFiles,
    driveImportStatus,
    isDriveImportOpen,
    setIsDriveImportOpen,
    isLoadingDriveImport,
    openDriveImport,
    importGoogleDriveFile,
    uploadDayExportToDrive,
  } = useDriveBackup({
    appView,
    selectedDate,
    getDayExportFile,
    loadFoodLogImportText,
  });

  useEffect(() => {
    setStorageJson(`log-${selectedDate}`, log);
  }, [log, selectedDate]);

  useEffect(() => {
    appendDebugLog("app-mounted", {
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      serviceWorkerSupported: "serviceWorker" in navigator,
      cacheStorageSupported: "caches" in window,
      localStorageSupported: (() => {
        try {
          const key = "jessicaStorageProbe";
          localStorage.setItem(key, "1");
          localStorage.removeItem(key);
          return true;
        } catch {
          return false;
        }
      })(),
    });

    const handleError = (event: ErrorEvent) => {
      appendDebugLog("window-error", {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      appendDebugLog("unhandled-rejection", {
        reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  useEffect(() => {
    saveCustomFoods(customFoods);
  }, [customFoods]);

  useEffect(() => {
    saveRecipes(recipes);
  }, [recipes]);

  useEffect(() => {
    saveWeightEntries(weightEntries);
  }, [weightEntries]);

  useEffect(() => { saveCompletedDays(completedDays); }, [completedDays]);
  useEffect(() => { saveTopFoods(topFoods); }, [topFoods]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem(themeStorageKey, themeMode);
  }, [themeMode]);

  function changeSelectedDate(date: string) {
    setSelectedDate(date);
    setLog(getSavedLog(date));
  }

  function toggleHomeDate(date: string) {
    if (homeSelectedDate === date) {
      setHomeSelectedDate(null);
      return;
    }

    setHomeSelectedDate(date);
    changeSelectedDate(date);
  }

  function moveSelectedDate(dayOffset: number) {
    changeSelectedDate(shiftDate(selectedDate, dayOffset));
  }

  function markDayComplete() {
    if (completedDays.includes(selectedDate)) return;
    setCompletedDays((prev) => [...prev, selectedDate]);
    setStreakPopupDate(selectedDate);
    setShowStreakPopup(true);
  }

  function handleFinishToggle() {
    if (completedDays.includes(selectedDate)) {
      reopenDayLogging();
    } else {
      markDayComplete();
    }
  }

  function reopenDayLogging() {
    setCompletedDays((prev) => prev.filter((date) => date !== selectedDate));
    setShowStreakPopup(false);
  }

  function getCompletedStreak(referenceDate = today, days = completedDays): number {
    const set = new Set(days);
    let streak = 0;
    let d = referenceDate;
    for (let i = 0; i < 365; i++) {
      if (!set.has(d)) break;
      streak++;
      d = shiftDate(d, -1);
    }
    return streak;
  }

  const dailyTotals = useMemo(
    () =>
      log.reduce(
        (totals, item) => ({
          calories: totals.calories + getItemCalories(item),
          protein: totals.protein + item.protein * item.quantity,
          carbs: totals.carbs + item.carbs * item.quantity,
          fat: totals.fat + item.fat * item.quantity,
        }),
        {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        }
      ),
    [log]
  );
  const totalCalories = dailyTotals.calories;

  function getDayExportData() {
    const meals = getMealCategoriesForLog(log).map((category) => {
      const mealItems = log.filter((item) => item.category === category);
      const totals = getLogCategoryTotals(log, category);

      return {
        name: category,
        calories: totals.calories,
        macros: {
          protein: Number(totals.protein.toFixed(1)),
          carbs: Number(totals.carbs.toFixed(1)),
          fat: Number(totals.fat.toFixed(1)),
        },
        foods: mealItems.map((item) => ({
          name: getFoodDisplayName(item),
          brand: item.brand ? getBrandDisplayName(item.brand) : null,
          servingSize: item.servingSize,
          serving: item.servingSize,
          servings: item.quantity,
          calories: getItemCalories(item),
          macros: {
            protein: Number((item.protein * item.quantity).toFixed(1)),
            carbs: Number((item.carbs * item.quantity).toFixed(1)),
            fat: Number((item.fat * item.quantity).toFixed(1)),
            ...(item.fiber !== undefined ? { fiber: Number((item.fiber * item.quantity).toFixed(1)) } : {}),
            ...(item.sugar !== undefined ? { sugar: Number((item.sugar * item.quantity).toFixed(1)) } : {}),
            ...(item.sodium !== undefined ? { sodium: Number((item.sodium * item.quantity).toFixed(1)) } : {}),
          },
          ...(item.notes ? { notes: item.notes } : {}),
          ...(item.source ? { source: item.source } : {}),
        })),
      };
    });
    const dayWeightEntry = weightEntries.find((entry) => entry.date === selectedDate) ?? null;

    return {
      date: selectedDate,
      calorieBudget: goals?.calories ?? null,
      totals: {
        calories: totalCalories,
        macros: {
          protein: Number(dailyTotals.protein.toFixed(1)),
          carbs: Number(dailyTotals.carbs.toFixed(1)),
          fat: Number(dailyTotals.fat.toFixed(1)),
        },
      },
      meals,
      weightEntry: dayWeightEntry
        ? {
            weight: dayWeightEntry.weight,
            unit: dayWeightEntry.unit,
            ...(dayWeightEntry.note ? { notes: dayWeightEntry.note } : {}),
          }
        : null,
      completed: completedDays.includes(selectedDate),
    };
  }

  function getDayExportFile() {
    const json = JSON.stringify(getDayExportData(), null, 2);
    return new File([json], `food-log-${selectedDate}.json`, { type: "application/json" });
  }

  function downloadDayExport() {
    setExportDriveLink("");
    const file = getDayExportFile();
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportStatus("Downloaded JSON file.");
  }

  function exportAllData() {
    const logs: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("log-")) {
        try {
          const val = localStorage.getItem(key);
          if (val) logs[key.slice(4)] = JSON.parse(val);
        } catch (error) {
          appendDebugLog("export-log-parse-skipped", {
            key,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    const data = {
      exportedAt: new Date().toISOString(),
      profile: getSavedProfile(),
      customFoods: getSavedCustomFoods(),
      recipes: getSavedRecipes(),
      weightEntries: getSavedWeightEntries(),
      foodLogs: logs,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jessica-data-${getLocalDateString()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function clearAllData() {
    localStorage.clear();
    setLog([]);
    setCustomFoods([]);
    setRecipes([]);
    setWeightEntries([]);
    setCompletedDays([]);
    setTopFoods([]);
    setProfile(null);
    setGoals(null);
    setProfileForm(profileFormFromLegacyGoals(null));
    setProfileSaveStatus("");
    setIsProfileWizardOpen(true);
    setAppView("profile");
  }

  function clearFoodDebugData() {
    const logKeysToDelete: string[] = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("log-")) logKeysToDelete.push(key);
    }

    logKeysToDelete.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem("customFoods");
    localStorage.removeItem("recipes");
    localStorage.removeItem("completedDays");
    localStorage.removeItem("topFoods");
    importCandidateCache.clear();
    importUsdaCandidateCache.clear();

    setLog([]);
    setCustomFoods([]);
    setRecipes([]);
    setCompletedDays([]);
    setTopFoods([]);
    resetImportStateForDebugClear();
    appendDebugLog("debug-food-data-cleared", {
      logKeysDeleted: logKeysToDelete.length,
    });
  }

  function logTapProbe(name: string, phase: string, event: SyntheticEvent<HTMLElement>) {
    if (!isDebugEnabled()) return;
    const nativeEvent = event.nativeEvent as Event & {
      pointerType?: string;
      clientX?: number;
      clientY?: number;
      touches?: TouchList;
      changedTouches?: TouchList;
    };
    const firstTouch = nativeEvent.touches?.[0] ?? nativeEvent.changedTouches?.[0] ?? null;
    const clientX = typeof nativeEvent.clientX === "number" ? nativeEvent.clientX : firstTouch?.clientX;
    const clientY = typeof nativeEvent.clientY === "number" ? nativeEvent.clientY : firstTouch?.clientY;
    const currentTarget = event.currentTarget;
    const rect = currentTarget.getBoundingClientRect();
    const elementAtPoint =
      typeof clientX === "number" && typeof clientY === "number"
        ? document.elementFromPoint(clientX, clientY)
        : null;

    appendDebugLog("tap-probe", {
      name,
      phase,
      eventType: event.type,
      nativeType: nativeEvent.type,
      pointerType: nativeEvent.pointerType ?? "unknown",
      defaultPrevented: event.defaultPrevented || nativeEvent.defaultPrevented,
      target: event.target instanceof Element
        ? `${event.target.tagName.toLowerCase()}${event.target.id ? `#${event.target.id}` : ""}${event.target.className ? `.${String(event.target.className).replace(/\s+/g, ".")}` : ""}`
        : String(event.target),
      currentTarget: `${currentTarget.tagName.toLowerCase()}${currentTarget.className ? `.${String(currentTarget.className).replace(/\s+/g, ".")}` : ""}`,
      elementAtPoint: elementAtPoint
        ? `${elementAtPoint.tagName.toLowerCase()}${elementAtPoint.id ? `#${elementAtPoint.id}` : ""}${elementAtPoint.className ? `.${String(elementAtPoint.className).replace(/\s+/g, ".")}` : ""}`
        : null,
      clientX,
      clientY,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
      },
      scrollY: Math.round(window.scrollY),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    });
  }

  function tapProbeProps(name: string) {
    if (!isDebugEnabled()) return {};
    return {
      onPointerDownCapture: (event: SyntheticEvent<HTMLElement>) => logTapProbe(name, "pointerdown-capture", event),
      onTouchStartCapture: (event: SyntheticEvent<HTMLElement>) => logTapProbe(name, "touchstart-capture", event),
      onClickCapture: (event: SyntheticEvent<HTMLElement>) => logTapProbe(name, "click-capture", event),
    };
  }

  function getDebugLogText() {
    try {
      const saved = localStorage.getItem(debugLogKey);
      return saved ? JSON.stringify(JSON.parse(saved), null, 2) : "[]";
    } catch (error) {
      return `Could not read debug log: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async function copyDebugLog() {
    const text = getDebugLogText();
    setDebugLogText(text);

    try {
      await navigator.clipboard.writeText(text);
      setDebugCopyStatus("Copied");
    } catch {
      setDebugCopyStatus("Copy failed. Select and copy the text.");
    }
  }

  function clearDebugLog() {
    localStorage.removeItem(debugLogKey);
    setDebugLogText("[]");
    setDebugCopyStatus("Cleared");
  }

  function openFoodLibrary() {
    setAppView("library");
  }

  // `log` and `importConfirmedDates` invalidate the recent-foods cache: edits to the
  // selected day flow through `log`; import writes to other days bump `importConfirmedDates`.
  const recentFoods = useMemo(
    () => getRecentFoods(selectedDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, log, importConfirmedDates]
  );
  const weightUnit = getPreferredWeightUnit(goals);
  const sortedWeightEntriesNewest = useMemo(
    () => sortWeightEntriesNewestFirst(weightEntries),
    [weightEntries]
  );
  const sortedWeightEntriesOldest = useMemo(
    () => sortWeightEntriesOldestFirst(weightEntries),
    [weightEntries]
  );
  const currentWeightEntry = sortedWeightEntriesNewest[0] ?? null;
  const startingWeightEntry = sortedWeightEntriesOldest[0] ?? null;

  function navigateAppView(view: AppView) {
    setAppView(view);
  }

  const bottomNav = (
    <AppChrome
      appView={appView}
      onNavigate={navigateAppView}
      onOpenLibrary={openFoodLibrary}
      isDebugMode={isDebugEnabled()}
      isDebugPanelOpen={isDebugPanelOpen}
      debugLogText={debugLogText}
      debugCopyStatus={debugCopyStatus}
      onOpenDebugPanel={() => {
        setDebugLogText(getDebugLogText());
        setDebugCopyStatus("");
        setIsDebugPanelOpen(true);
      }}
      onCloseDebugPanel={() => setIsDebugPanelOpen(false)}
      onCopyDebugLog={copyDebugLog}
      onClearDebugLog={clearDebugLog}
      showStreakPopup={showStreakPopup}
      streakPopupDate={streakPopupDate}
      completedDays={completedDays}
      getCompletedStreak={getCompletedStreak}
      onCloseStreakPopup={() => setShowStreakPopup(false)}
    />
  );

  return (
    <AppViewRouter
      appView={appView}
      onNavigate={navigateAppView}
      bottomNav={bottomNav}
      homeProps={{
        selectedDate,
        log,
        goals,
        homeSelectedDate,
        setHomeSelectedDate,
        changeSelectedDate,
        toggleHomeDate,
        today,
        getCompletedStreak,
        goalsView,
        setGoalsView,
        currentWeightEntry,
        startingWeightEntry,
        weightUnit,
      }}
      profileProps={{
        profile,
        profileForm,
        setProfileForm,
        updateProfileForm,
        profileCalculation,
        profileErrors,
        profileHasBlockingErrors,
        profileLowCalorieWarning,
        profileWizardStep,
        setProfileWizardStep,
        isProfileWizardOpen,
        setIsProfileWizardOpen,
        profileSaveStatus,
        setProfileSaveStatus,
        themeMode,
        setThemeMode,
        setCycleTrackingPreference,
        cancelProfileChanges,
        saveProfile,
        patchProfile,
        onOpenExport: exportAllData,
        onOpenImport: openImportFilePicker,
        onConnectDrive: openDriveImport,
        onDeleteAllData: clearAllData,
      }}
      weightProps={{
        today,
        weightUnit,
        profile,
        goals,
        weightEntries,
        setWeightEntries,
        currentWeightEntry,
        startingWeightEntry,
        tapProbeProps,
        logTapProbe,
        sortedWeightEntriesOldest,
        sortedWeightEntriesNewest,
      }}
      libraryProps={{
        customFoods,
        setCustomFoods,
        recipes,
        setRecipes,
        recentFoods,
      }}
      logProps={{
        goals,
        totalCalories,
        dailyTotals,
        completedDays,
        selectedDate,
        moveSelectedDate,
        changeSelectedDate,
        importStatus,
        importErrors,
        importDrafts,
        setExportStatus,
        log,
        logTapProbe,
        handleFinishToggle,
        tapProbeProps,
        setLog,
        customFoods,
        setCustomFoods,
        recipes,
        setRecipes,
        recentFoods,
        setTopFoods,
        importSteps,
        importStepIndex,
        cancelImportStepper,
        confirmImportStep,
        skipImportStep,
        importStepResults,
        closeImportSummary,
        importFileName,
        importWeightEntries,
        updateImportDraft,
        removeImportDraft,
        removeImportWeightEntry,
        confirmFoodLogImport,
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
        updateImportReviewSelection,
        applyImportReviewToSimilar,
        applyAllImportReview,
        rejectImportReviewItem,
        expandImportReviewGroup,
        openImportReviewManualSearch,
        closeImportReviewManualSearch,
        searchImportReviewManualFoods,
        selectImportReviewManualFood,
        confirmImportReview,
        isResolvingImport,
        clearFoodDebugData,
        closeImportPreview,
        isExportPanelOpen,
        setIsExportPanelOpen,
        googleDriveClientId,
        isUploadingToDrive,
        setGoogleDriveClientId,
        exportStatus,
        exportDriveLink,
        downloadDayExport,
        uploadDayExportToDrive,
        isImportDayOpen,
        setIsImportDayOpen,
        openDriveImport,
        isLoadingDriveImport,
        openImportFilePicker,
        isDriveImportOpen,
        setIsDriveImportOpen,
        driveImportStatus,
        driveImportFiles,
        importGoogleDriveFile,
      }}
    />
  );
}

export default App;
