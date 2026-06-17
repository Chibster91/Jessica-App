import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction, type SyntheticEvent } from "react";
import "../styles/weight.css";
import {
  convertWeightValue,
  formatDateRange,
  formatEntryDate,
  formatShortDate,
  formatWeightValue,
  formatWeightValueInUnit,
  getNiceWeightStep,
  getWeightRangeLabel,
  getWeightTickLabel,
  roundToIncrement,
  type Goals,
  type WeightEntry,
  type WeightRange,
  type WeightUnit,
  type Profile
} from "../appSupport";
import { useWeightTracking } from "../hooks/useWeightTracking";

type WeightViewProps = {
  bottomNav: ReactNode;
  healthTabs?: ReactNode;
  today: string;
  weightUnit: WeightUnit;
  profile: Profile | null;
  goals: Goals | null;
  weightEntries: WeightEntry[];
  setWeightEntries: Dispatch<SetStateAction<WeightEntry[]>>;
  currentWeightEntry: WeightEntry | null;
  startingWeightEntry: WeightEntry | null;
  tapProbeProps: (name: string) => React.HTMLAttributes<HTMLElement>;
  logTapProbe: (name: string, phase: string, event: SyntheticEvent<HTMLElement>) => void;
  sortedWeightEntriesOldest: WeightEntry[];
  sortedWeightEntriesNewest: WeightEntry[];
};

const chartWidth = 360;
const chartHeight = 240;
const chartLeft = 60;
const chartRight = 24;
const chartTop = 18;
const chartBottom = 48;
const chartPlotWidth = chartWidth - chartLeft - chartRight;
const chartPlotHeight = chartHeight - chartTop - chartBottom;

export function WeightView({
  bottomNav,
  healthTabs,
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
  sortedWeightEntriesNewest
}: WeightViewProps) {
    const {
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
    } = useWeightTracking({ today, goals, weightEntries, setWeightEntries, sortedWeightEntriesOldest });
    const displayUnit = weightUnit;
    const {
      chartPoints,
      chartLinePoints,
      goalPaceLinePoints,
      trendLinePoints,
      chartYAxisTicks,
      chartYAxisPositions,
      chartXAxisPositions,
      chartStep,
      goalWeight,
      chartFirstDate,
      chartMiddleDate,
      chartLastDate,
      chartRangeLabel,
    } = useMemo(() => {
    const chartEntries = chartWeightEntries.map((entry) => ({
      ...entry,
      displayWeight: convertWeightValue(entry.weight, entry.unit, displayUnit),
    }));
    const chartFirstTime = chartEntries[0] ? new Date(`${chartEntries[0].date}T00:00:00`).getTime() : null;
    const chartLastTime = chartEntries.length > 0 ? new Date(`${chartEntries[chartEntries.length - 1].date}T00:00:00`).getTime() : null;
    const chartTimeRange =
      chartFirstTime !== null && chartLastTime !== null
        ? Math.max(1, chartLastTime - chartFirstTime)
        : 1;
    const chartXForTime = (time: number) =>
      chartLeft + ((time - (chartFirstTime ?? time)) / chartTimeRange) * chartPlotWidth;
    const goalWeight = profile?.goalWeightKg ? convertWeightValue(profile.goalWeightKg, "kg", displayUnit) : null;
    const goalPaceLineData = (() => {
      if (!profile?.goalWeightKg || !startingWeightEntry || goalWeight === null || profile.goal === "maintain" || profile.weeklyRateKg <= 0 || chartFirstTime === null || chartLastTime === null) {
        return null;
      }

      const startTime = new Date(`${startingWeightEntry.date}T00:00:00`).getTime();
      if (!Number.isFinite(startTime)) return null;

      const startWeight = convertWeightValue(startingWeightEntry.weight, startingWeightEntry.unit, displayUnit);
      const startWeightKg = convertWeightValue(startingWeightEntry.weight, startingWeightEntry.unit, "kg");
      const goalRangeKg = Math.abs(startWeightKg - profile.goalWeightKg);
      if (!Number.isFinite(goalRangeKg) || goalRangeKg <= 0) return null;

      const plannedDays = (goalRangeKg / profile.weeklyRateKg) * 7;
      const goalTime = startTime + plannedDays * 86400000;
      if (!Number.isFinite(goalTime) || goalTime <= startTime) return null;

      const lineStartTime = Math.max(chartFirstTime, startTime);
      const lineEndTime = Math.min(chartLastTime, goalTime);
      if (lineEndTime <= lineStartTime) return null;

      const slope = (goalWeight - startWeight) / (goalTime - startTime);
      const startValue = startWeight + slope * (lineStartTime - startTime);
      const endValue = startWeight + slope * (lineEndTime - startTime);
      return { startTime: lineStartTime, endTime: lineEndTime, startValue, endValue, goalTime };
    })();
    const trendLineData = (() => {
      if (chartEntries.length < 2 || chartFirstTime === null || chartLastTime === null) return null;

      const points = chartEntries
        .map((entry) => ({
          time: new Date(`${entry.date}T00:00:00`).getTime(),
          value: entry.displayWeight,
        }))
        .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value));
      if (points.length < 2) return null;

      const meanTime = points.reduce((sum, point) => sum + point.time, 0) / points.length;
      const meanValue = points.reduce((sum, point) => sum + point.value, 0) / points.length;
      const denominator = points.reduce((sum, point) => sum + (point.time - meanTime) ** 2, 0);
      if (denominator === 0) return null;

      const slope = points.reduce((sum, point) => sum + (point.time - meanTime) * (point.value - meanValue), 0) / denominator;
      const valueAt = (time: number) => meanValue + slope * (time - meanTime);
      return {
        startTime: chartFirstTime,
        endTime: chartLastTime,
        startValue: valueAt(chartFirstTime),
        endValue: valueAt(chartLastTime),
      };
    })();
    const chartWeights = chartEntries.map((entry) => entry.displayWeight);
    const chartReferenceWeights = [
      goalPaceLineData?.startValue,
      goalPaceLineData?.endValue,
      trendLineData?.startValue,
      trendLineData?.endValue,
    ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const chartDomainWeights = [...chartWeights, ...chartReferenceWeights];
    const minDisplayWeight = chartDomainWeights.length ? Math.min(...chartDomainWeights) : 0;
    const maxDisplayWeight = chartDomainWeights.length ? Math.max(...chartDomainWeights) : 0;
    const chartRange = Math.max(1, maxDisplayWeight - minDisplayWeight);
    const chartStep = getNiceWeightStep(chartRange);
    const chartMin = roundToIncrement(minDisplayWeight, chartStep) - chartStep;
    const chartMax = roundToIncrement(maxDisplayWeight, chartStep) + chartStep;
    const chartDomainRange = Math.max(chartStep, chartMax - chartMin);
    const chartTickValues = [
      chartMin,
      chartMin + chartDomainRange * 0.25,
      chartMin + chartDomainRange * 0.5,
      chartMin + chartDomainRange * 0.75,
      chartMax,
    ].map((value) => roundToIncrement(value, chartStep));
    const chartExtraTickValues = [
      chartMin + chartDomainRange * 0.125,
      chartMin + chartDomainRange * 0.375,
      chartMin + chartDomainRange * 0.625,
      chartMin + chartDomainRange * 0.875,
    ].map((value) => roundToIncrement(value, chartStep));
    const chartXIndexMid = Math.round((chartEntries.length - 1) / 2);
    const chartPoints = chartEntries.map((entry, index) => {
      const x = chartLeft + (index / Math.max(1, chartEntries.length - 1)) * chartPlotWidth;
      const y = chartTop + ((chartMax - entry.displayWeight) / chartDomainRange) * chartPlotHeight;

      return { ...entry, x, y };
    });
    const chartYForWeight = (value: number) => chartTop + ((chartMax - value) / chartDomainRange) * chartPlotHeight;
    const goalPaceLinePoints = goalPaceLineData
      ? `${chartXForTime(goalPaceLineData.startTime)},${chartYForWeight(goalPaceLineData.startValue)} ${chartXForTime(goalPaceLineData.endTime)},${chartYForWeight(goalPaceLineData.endValue)}`
      : "";
    const trendLinePoints = trendLineData
      ? `${chartXForTime(trendLineData.startTime)},${chartYForWeight(trendLineData.startValue)} ${chartXForTime(trendLineData.endTime)},${chartYForWeight(trendLineData.endValue)}`
      : "";
    const chartLinePoints = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
    const chartYAxisTicks = [...new Set(chartTickValues)];
    for (const value of chartExtraTickValues) {
      if (chartYAxisTicks.length >= 5) break;
      if (!chartYAxisTicks.includes(value)) {
        chartYAxisTicks.push(value);
      }
    }
    chartYAxisTicks.sort((a, b) => a - b);
    const chartYAxisPositions = chartYAxisTicks.map((value) => chartTop + ((chartMax - value) / chartDomainRange) * chartPlotHeight);
    const chartXAxisPositions = [
      chartPoints[0]?.x ?? chartLeft,
      chartPoints[chartXIndexMid]?.x ?? chartLeft,
      chartPoints[chartPoints.length - 1]?.x ?? chartLeft,
    ];
    const chartFirstDate = chartEntries[0]?.date ?? "";
    const chartMiddleDate = chartEntries[chartXIndexMid]?.date ?? "";
    const chartLastDate = chartEntries[chartEntries.length - 1]?.date ?? "";
    return {
      chartPoints,
      chartLinePoints,
      goalPaceLinePoints,
      trendLinePoints,
      chartYAxisTicks,
      chartYAxisPositions,
      chartXAxisPositions,
      chartStep,
      goalWeight,
      chartFirstDate,
      chartMiddleDate,
      chartLastDate,
      chartRangeLabel:
        chartEntries.length > 0 ? formatDateRange(chartFirstDate, chartLastDate) : "No entries",
    };
    }, [chartWeightEntries, profile, startingWeightEntry, displayUnit]);
    const selectedChartPoint =
      chartPoints.find((point) => point.id === weightChartPointId) ?? chartPoints[chartPoints.length - 1] ?? null;
    const summaryCurrentWeight = currentWeightEntry
      ? convertWeightValue(currentWeightEntry.weight, currentWeightEntry.unit, displayUnit)
      : null;
    const summaryStartingWeight = startingWeightEntry
      ? convertWeightValue(startingWeightEntry.weight, startingWeightEntry.unit, displayUnit)
      : null;
    const summaryChange =
      summaryCurrentWeight !== null && summaryStartingWeight !== null
        ? summaryCurrentWeight - summaryStartingWeight
        : null;
    const summaryChangeLabel =
      summaryChange === null
        ? "No entry"
        : summaryChange === 0
        ? "No change"
        : summaryChange < 0
        ? `Lost ${formatWeightValue(Math.abs(summaryChange), displayUnit)}`
        : `Gained ${formatWeightValue(summaryChange, displayUnit)}`;
    const [activeWeightTab, setActiveWeightTab] = useState<"current" | "graph" | "history">("current");
    const [isWeightFormOpen, setIsWeightFormOpen] = useState(false);
    const currentWeightKg = currentWeightEntry ? convertWeightValue(currentWeightEntry.weight, currentWeightEntry.unit, "kg") : null;
    const bmi = profile && currentWeightKg ? currentWeightKg / ((profile.heightCm / 100) ** 2) : null;
    const goalBmi = profile?.goalWeightKg ? profile.goalWeightKg / ((profile.heightCm / 100) ** 2) : null;
    const getBmiClass = (value: number | null) => {
      if (value === null) return "Not set";
      if (value < 18.5) return "Underweight";
      if (value < 25) return "Normal";
      if (value < 30) return "Overweight";
      if (value < 35) return "Obese Class I";
      if (value < 40) return "Obese Class II";
      return "Obese Class III";
    };
    const progressPct =
      summaryStartingWeight !== null && summaryCurrentWeight !== null && goalWeight !== null && summaryStartingWeight !== goalWeight
        ? Math.min(100, Math.max(0, Math.abs((summaryStartingWeight - summaryCurrentWeight) / (summaryStartingWeight - goalWeight)) * 100))
        : 0;
    const lostAmount = summaryChange !== null && summaryChange < 0 ? Math.abs(summaryChange) : 0;
    const remainingAmount = summaryCurrentWeight !== null && goalWeight !== null ? Math.abs(summaryCurrentWeight - goalWeight) : null;
    const firstEntryTime = startingWeightEntry ? new Date(`${startingWeightEntry.date}T00:00:00`).getTime() : null;
    const todayTime = new Date(`${today}T00:00:00`).getTime();
    const plannedGoalTime = (() => {
      if (!profile || !startingWeightEntry || !profile.goalWeightKg || profile.goal === "maintain" || profile.weeklyRateKg <= 0) {
        return null;
      }

      const startTime = new Date(`${startingWeightEntry.date}T00:00:00`).getTime();
      if (!Number.isFinite(startTime)) return null;

      const startWeightKg = convertWeightValue(startingWeightEntry.weight, startingWeightEntry.unit, "kg");
      const goalRangeKg = Math.abs(startWeightKg - profile.goalWeightKg);
      if (!Number.isFinite(goalRangeKg) || goalRangeKg <= 0) return null;

      const plannedDays = (goalRangeKg / profile.weeklyRateKg) * 7;
      const goalTime = startTime + plannedDays * 86400000;

      return Number.isFinite(goalTime) && goalTime > startTime ? goalTime : null;
    })();
    const timePct =
      firstEntryTime !== null &&
      Number.isFinite(firstEntryTime) &&
      Number.isFinite(todayTime) &&
      plannedGoalTime !== null
        ? Math.min(100, Math.max(0, ((todayTime - firstEntryTime) / (plannedGoalTime - firstEntryTime)) * 100))
        : 0;
    const elapsedDays = firstEntryTime ? Math.max(1, Math.round((todayTime - firstEntryTime) / 86400000)) : 0;
    const avgDailyChange = summaryChange !== null && elapsedDays > 0 ? summaryChange / elapsedDays : null;
    const avgWeeklyChange = avgDailyChange !== null ? avgDailyChange * 7 : null;
    const projectedGoalDays =
      avgDailyChange !== null &&
      avgDailyChange !== 0 &&
      summaryCurrentWeight !== null &&
      goalWeight !== null &&
      Math.sign(goalWeight - summaryCurrentWeight) === Math.sign(avgDailyChange)
        ? Math.abs((goalWeight - summaryCurrentWeight) / avgDailyChange)
        : null;
    const expectedGoalDate = projectedGoalDays !== null
      ? new Date(todayTime + projectedGoalDays * 86400000).toISOString().slice(0, 10)
      : null;
    const ringSegmentsOn = Math.round(progressPct / 20);
    const selectedChartBmi = selectedChartPoint && profile
      ? convertWeightValue(selectedChartPoint.weight, selectedChartPoint.unit, "kg") / ((profile.heightCm / 100) ** 2)
      : null;
    const openWeightForm = () => {
      setWeightSaveError("");
      setWeightForm((current) => {
        if (current.weight.trim() || !currentWeightEntry) return current;
        return {
          ...current,
          weight: convertWeightValue(currentWeightEntry.weight, currentWeightEntry.unit, displayUnit).toFixed(1),
        };
      });
      setIsWeightFormOpen(true);
    };
    const closeWeightForm = () => {
      setIsWeightFormOpen(false);
      setEditingWeightEntryId(null);
      setWeightForm({ date: today, weight: "", note: "" });
    };
    const handleSaveWeight = (event: SyntheticEvent<HTMLElement>) => {
      logTapProbe("weight-save-button", "click", event);
      saveWeightEntry();
      if (isWeightFormValid) setIsWeightFormOpen(false);
    };
    const handleEditWeightEntry = (entry: WeightEntry) => {
      startEditWeightEntry(entry);
      setIsWeightFormOpen(true);
      setActiveWeightTab("current");
    };
    const formatDelta = (delta: number | null) => {
      if (delta === null) return `0.0 ${displayUnit}`;
      const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
      return `${sign}${Number(Math.abs(delta).toFixed(1))} ${displayUnit}`;
    };
    const getHistoryDelta = (entry: WeightEntry) => {
      const chronologicalIndex = sortedWeightEntriesOldest.findIndex((item) => item.id === entry.id);
      const previous = chronologicalIndex > 0 ? sortedWeightEntriesOldest[chronologicalIndex - 1] : null;
      if (!previous) return null;
      return convertWeightValue(entry.weight, entry.unit, displayUnit) - convertWeightValue(previous.weight, previous.unit, displayUnit);
    };
    const getSegmentClass = (index: number, delta: number | null) => {
      if (delta === null || delta === 0) return index < 2 ? "amber" : "";
      if (delta > 0) return index === 0 ? "red" : "";
      return "green";
    };
    const weightPickerMin = displayUnit === "kg" ? 30 : 70;
    const weightPickerMax = displayUnit === "kg" ? 250 : 550;
    const parsedPickerWeight = Number(weightForm.weight);
    const normalizedPickerWeight = Number.isFinite(parsedPickerWeight) ? Math.max(0, parsedPickerWeight) : null;
    const selectedWholeWeight = normalizedPickerWeight !== null
      ? Math.floor(Math.round(normalizedPickerWeight * 10) / 10)
      : currentWeightEntry
        ? Math.floor(convertWeightValue(currentWeightEntry.weight, currentWeightEntry.unit, displayUnit))
        : Math.round((weightPickerMin + weightPickerMax) / 2);
    const selectedDecimalWeight = normalizedPickerWeight !== null
      ? Math.round((Math.round(normalizedPickerWeight * 10) / 10 - selectedWholeWeight) * 10)
      : currentWeightEntry
        ? Math.round((convertWeightValue(currentWeightEntry.weight, currentWeightEntry.unit, displayUnit) % 1) * 10)
        : 0;
    const wholeWeightValues = useMemo(() => {
      const values = Array.from(
        { length: weightPickerMax - weightPickerMin + 1 },
        (_, index) => weightPickerMin + index
      );
      return values.includes(selectedWholeWeight)
        ? values
        : [...values, selectedWholeWeight].sort((a, b) => a - b);
    }, [selectedWholeWeight, weightPickerMax, weightPickerMin]);
    const decimalWeightValues = Array.from({ length: 10 }, (_, index) => index);
    const wholeWheelRef = useRef<HTMLSelectElement | null>(null);
    const decimalWheelRef = useRef<HTMLSelectElement | null>(null);
    useEffect(() => {
      const centerSelectedOption = (select: HTMLSelectElement | null) => {
        const option = select?.selectedOptions.item(0);
        if (!select || !option) return;
        select.scrollTop = option.offsetTop - select.clientHeight / 2 + option.clientHeight / 2;
      };
      centerSelectedOption(wholeWheelRef.current);
      centerSelectedOption(decimalWheelRef.current);
    }, [selectedDecimalWeight, selectedWholeWeight, isWeightFormOpen]);
    const updateWeightPicker = (whole: number, decimal: number) => {
      setWeightSaveError("");
      setWeightForm({ ...weightForm, weight: `${whole}.${decimal}` });
    };
    const renderWeightForm = () => (
      <div className="floating-overlay" role="presentation" onClick={closeWeightForm}>
        <div
          className="floating-popover weight-form-popover"
          role="dialog"
          aria-modal="true"
          aria-labelledby="weight-form-title"
          onClick={(e) => e.stopPropagation()}
          {...tapProbeProps("weight-entry-panel")}
        >
          <h2 id="weight-form-title">{editingWeightEntryId ? "Edit Weight" : "Enter Weight"}</h2>
          <div className="weight-form" {...tapProbeProps("weight-form")}>
            <div className="weight-date-row">
              <label className="weight-date-field">
                Date
                <input
                  type="date"
                  value={weightForm.date}
                  onChange={(e) => {
                    setWeightSaveError("");
                    setWeightForm({ ...weightForm, date: e.target.value });
                  }}
                />
              </label>
            </div>
            <div className="weight-picker-field">
              <label>
                Weight ({weightUnit})
                <div className="weight-dual-wheel-wrap">
                <div className="weight-wheel-wrap">
                  <select
                    ref={wholeWheelRef}
                    className="weight-wheel-picker"
                    size={7}
                    value={String(selectedWholeWeight)}
                    onChange={(e) => {
                      updateWeightPicker(Number(e.target.value), selectedDecimalWeight);
                    }}
                    aria-label={`Whole ${weightUnit}`}
                  >
                    {wholeWeightValues.map((value) => (
                      <option key={value} value={String(value)}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="weight-wheel-decimal">.</div>
                <div className="weight-wheel-wrap weight-wheel-wrap-decimal">
                  <select
                    ref={decimalWheelRef}
                    className="weight-wheel-picker weight-wheel-picker-decimal"
                    size={7}
                    value={String(Math.max(0, Math.min(9, selectedDecimalWeight)))}
                    onChange={(e) => {
                      updateWeightPicker(selectedWholeWeight, Number(e.target.value));
                    }}
                    aria-label={`Tenths of ${weightUnit}`}
                  >
                    {decimalWeightValues.map((value) => (
                      <option key={value} value={String(value)}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="weight-wheel-unit">{weightUnit}</span>
                </div>
              </label>
            </div>
            <label>
              Note
              <input
                value={weightForm.note}
                placeholder="Optional"
                onChange={(e) => {
                  setWeightSaveError("");
                  setWeightForm({ ...weightForm, note: e.target.value });
                }}
              />
            </label>
            {weightSaveError && <p className="form-error">{weightSaveError}</p>}
            <div className="weight-form-actions">
              <button
                type="button"
                className="primary-button"
                onPointerDown={(event) => logTapProbe("weight-save-button", "pointerdown", event)}
                onTouchStart={(event) => logTapProbe("weight-save-button", "touchstart", event)}
                onClick={handleSaveWeight}
                disabled={!isWeightFormValid}
              >
                {editingWeightEntryId ? "Update" : "Save"}
              </button>
              <button type="button" className="secondary-button" onClick={closeWeightForm}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <main className="app">
        <div className="w-screen-head"></div>
        {healthTabs}

        <div className="w-subtabs" role="tablist" aria-label="Weight views">
          {(["current", "graph"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`w-subtab${activeWeightTab === tab ? " is-active" : ""}`}
              onClick={() => setActiveWeightTab(tab)}
              role="tab"
              aria-selected={activeWeightTab === tab}
            >
              {tab === "current" ? "Details" : "Graph"}
            </button>
          ))}
        </div>

        {activeWeightTab === "current" && (
          <>
            <section className="w-panel">
              <div className="w-hero">
                <div className="w-hero-side">
                  <span className="lbl">Start</span>
                  <span className="val">
                    {startingWeightEntry ? formatWeightValueInUnit(startingWeightEntry.weight, startingWeightEntry.unit, displayUnit) : "No entry"}
                  </span>
                  <span className="bmi">
                    BMI {profile && startingWeightEntry
                      ? Number((convertWeightValue(startingWeightEntry.weight, startingWeightEntry.unit, "kg") / ((profile.heightCm / 100) ** 2)).toFixed(1))
                      : "--"}
                  </span>
                  <span className="date">{startingWeightEntry ? formatShortDate(startingWeightEntry.date) : "--"}</span>
                </div>

                <div className="w-ring-wrap" style={{ "--pct": progressPct } as CSSProperties}>
                  <div className="w-ring-inner">
                    <div>
                      <div className="w-ring-num">
                        {summaryCurrentWeight !== null ? Number(summaryCurrentWeight.toFixed(1)) : "--"}
                        <small>{displayUnit}</small>
                      </div>
                      <div className="w-ring-segments" aria-hidden="true">
                        {Array.from({ length: 5 }, (_, index) => (
                          <span key={index} className={index < ringSegmentsOn ? (progressPct >= 100 ? "green" : "on") : ""} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-hero-side right">
                  <span className="lbl">Goal</span>
                  <span className="val">{goalWeight !== null ? formatWeightValue(goalWeight, displayUnit) : "Not set"}</span>
                  <span className="bmi">BMI {goalBmi !== null ? Number(goalBmi.toFixed(1)) : "--"}</span>
                  <span className="date">{expectedGoalDate ? formatShortDate(expectedGoalDate) : "Goal date --"}</span>
                </div>
              </div>

              <div className="w-progress-block">
                <div className="w-progress-row">
                  <span className="lbl">Progress</span>
                  <div className="w-progress-track"><div className="w-progress-fill" style={{ width: `${progressPct}%` }} /></div>
                  <span className="pct">{Number(progressPct.toFixed(1))}%</span>
                </div>
                <div className="w-progress-row">
                  <span className="lbl">Time</span>
                  <div className="w-progress-track"><div className="w-progress-fill time" style={{ width: `${timePct}%` }} /></div>
                  <span className="pct">{Number(timePct.toFixed(1))}%</span>
                </div>
              </div>

              <div className="w-stats-eyebrow">Current Statistics</div>

              <div className="w-stats-grid">
                <div className="w-stat"><div className="lbl">Entries</div><div className="val">{sortedWeightEntriesNewest.length}</div></div>
                <div className="w-stat"><div className="lbl">You lost</div><div className="val">{Number(lostAmount.toFixed(1))}<small>{displayUnit}</small></div></div>
                <div className="w-stat"><div className="lbl">Remaining</div><div className="val">{remainingAmount !== null ? Number(remainingAmount.toFixed(1)) : "--"}<small>{displayUnit}</small></div></div>
              </div>

            </section>

            <button type="button" className="w-cta" onClick={openWeightForm}>Enter Weight</button>
            <h2 className="w-section-title">History</h2>
            <section className="w-panel w-history-panel">
              {sortedWeightEntriesNewest.length === 0 && <p className="empty-meal">Add your first weigh-in to start tracking progress.</p>}
              <div className="w-hist-list">
                {sortedWeightEntriesNewest.map((entry) => {
                  const delta = getHistoryDelta(entry);
                  const entryDate = new Date(`${entry.date}T12:00:00`);
                  return (
                    <div className="w-hist-row" key={entry.id}>
                      <div className="w-hist-main">
                        <span className="val">{Number(convertWeightValue(entry.weight, entry.unit, displayUnit).toFixed(1))}<small> {displayUnit}</small></span>
                        <span className="sep">·</span>
                        <span className={`delta${delta !== null && delta > 0 ? " gain" : delta !== null && delta < 0 ? " loss" : ""}`}>{formatDelta(delta)}</span>
                        <span className="sep">·</span>
                        <span className="date-str">{entryDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                        {entry.note ? <span className="note-str">{entry.note}</span> : null}
                      </div>
                      <span className="w-hist-actions">
                        <button type="button" onClick={() => handleEditWeightEntry(entry)}>Edit</button>
                        <button type="button" onClick={() => setWeightEntryToDelete(entry)}>Delete</button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {activeWeightTab === "graph" && (
          <>
            <div className="w-range-row">
              <div className="w-range-pills" role="tablist" aria-label="Weight chart range">
                {(["1M", "3M", "6M", "1Y", "All"] as WeightRange[]).map((range) => (
                  <button key={range} type="button" className={weightRange === range ? "is-active" : ""} onClick={() => setWeightRange(range)}>
                    {getWeightRangeLabel(range)}
                  </button>
                ))}
              </div>
              <div className="w-zoom"><span>{chartRangeLabel}</span><span className="w-zoom-knob" aria-hidden="true" /></div>
            </div>

            <section className="w-panel w-chart-panel">
              <div className="w-chart-callout">
                <div className="name">{selectedChartPoint ? formatEntryDate(selectedChartPoint.date) : "No entries"}</div>
                <div className="main">
                  {selectedChartPoint ? (
                    <>
                      <b>{formatWeightValue(selectedChartPoint.displayWeight, displayUnit)}</b>
                      {selectedChartBmi !== null && <> · BMI {Number(selectedChartBmi.toFixed(1))}</>}
                    </>
                  ) : "Add your first weigh-in"}
                </div>
                <div className="exp">{expectedGoalDate ? `Expected goal date · ${formatEntryDate(expectedGoalDate)}` : "Goal date unavailable"}</div>
              </div>

              {sortedWeightEntriesOldest.length === 0 && <p className="empty-meal">Add your first weigh-in to start tracking progress.</p>}
              {sortedWeightEntriesOldest.length === 1 && <p className="empty-meal">Add at least two weight entries to see your trend.</p>}

              {sortedWeightEntriesOldest.length >= 2 && (
                <div className="weight-chart-shell">
                  <div className="weight-chart" aria-label="Weight trend graph">
                    <svg className="w-chart-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" preserveAspectRatio="none">
                      {chartYAxisPositions.map((y, index) => (
                        <line key={`h-${index}`} className="weight-chart-grid" x1={chartLeft} y1={y} x2={chartWidth - chartRight} y2={y} />
                      ))}
                      {chartXAxisPositions.map((x, index) => (
                        <line key={`v-${index}`} className="weight-chart-grid" x1={x} y1={chartTop} x2={x} y2={chartHeight - chartBottom} />
                      ))}
                      {goalPaceLinePoints && <polyline className="weight-chart-goal-line" points={goalPaceLinePoints} />}
                      {trendLinePoints && <polyline className="weight-chart-trend-line" points={trendLinePoints} />}
                      <polyline className="weight-chart-line" points={chartLinePoints} />
                      {selectedChartPoint && (
                        <line x1={selectedChartPoint.x} y1={chartTop} x2={selectedChartPoint.x} y2={chartHeight - chartBottom} stroke="#B46CFF" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
                      )}
                      {chartPoints.map((point) => (
                        <circle
                          key={point.id}
                          className="weight-chart-dot"
                          cx={point.x}
                          cy={point.y}
                          r={selectedChartPoint?.id === point.id ? "5" : "3"}
                          tabIndex={0}
                          aria-label={`${formatShortDate(point.date)} ${formatWeightValue(point.displayWeight, displayUnit)}`}
                          onMouseEnter={() => setWeightChartPointId(point.id)}
                          onFocus={() => setWeightChartPointId(point.id)}
                          onClick={() => setWeightChartPointId(point.id)}
                        />
                      ))}
                      {chartYAxisTicks.map((value, index) => (
                        <text key={`y-label-${index}`} className="weight-chart-label" x={chartLeft - 10} y={chartYAxisPositions[index] + 4} textAnchor="end">
                          {getWeightTickLabel(value, chartStep, displayUnit)}
                        </text>
                      ))}
                      {[
                        { value: chartFirstDate, x: chartXAxisPositions[0], anchor: "start" as const },
                        { value: chartMiddleDate, x: chartXAxisPositions[1], anchor: "middle" as const },
                        { value: chartLastDate, x: chartXAxisPositions[2], anchor: "end" as const },
                      ].map((label, index) => (
                        <text key={`x-label-${index}`} className="weight-chart-label" x={label.x} y={chartHeight - 10} textAnchor={label.anchor}>
                          {formatShortDate(label.value)}
                        </text>
                      ))}
                    </svg>
                  </div>
                  <div className="w-chart-legend">
                    <span><i className="weight-line" /> Weight</span>
                    <span><i className="goal-line" /> Goal pace</span>
                    <span><i className="trend-line" /> Trend</span>
                  </div>
                </div>
              )}
            </section>
            <section className="w-panel w-history-panel">
              {sortedWeightEntriesNewest.length === 0 && <p className="empty-meal">Add your first weigh-in to start tracking progress.</p>}
              <div className="w-hist-list">
                {sortedWeightEntriesNewest.map((entry) => {
                  const delta = getHistoryDelta(entry);
                  const entryDate = new Date(`${entry.date}T12:00:00`);
                  return (
                    <div className="w-hist-row" key={entry.id}>
                      <div className="w-hist-main">
                        <span className="val">{Number(convertWeightValue(entry.weight, entry.unit, displayUnit).toFixed(1))}<small> {displayUnit}</small></span>
                        <span className="sep">·</span>
                        <span className={`delta${delta !== null && delta > 0 ? " gain" : delta !== null && delta < 0 ? " loss" : ""}`}>{formatDelta(delta)}</span>
                        <span className="sep">·</span>
                        <span className="date-str">{entryDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                        {entry.note ? <span className="note-str">{entry.note}</span> : null}
                      </div>
                      <span className="w-hist-actions">
                        <button type="button" onClick={() => handleEditWeightEntry(entry)}>Edit</button>
                        <button type="button" onClick={() => setWeightEntryToDelete(entry)}>Delete</button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <button type="button" className="w-cta" onClick={openWeightForm}>Enter Weight</button>
          </>
        )}

        {activeWeightTab === "history" && (
          <>
            <div className="w-history-head">
              <button className="month-btn" type="button" onClick={() => setWeightRange("1M")}>Month View</button>
              <span className="name">Jessica</span>
              <span aria-hidden="true" />
            </div>
            <section className="w-panel w-history-panel">
              {sortedWeightEntriesNewest.length === 0 && <p className="empty-meal">Add your first weigh-in to start tracking progress.</p>}
              <div className="w-hist-list">
                {sortedWeightEntriesNewest.map((entry) => {
                  const delta = getHistoryDelta(entry);
                  const entryDate = new Date(`${entry.date}T12:00:00`);
                  return (
                    <div className="w-hist-row" key={entry.id}>
                      <div className="w-hist-main">
                        <span className="val">{Number(convertWeightValue(entry.weight, entry.unit, displayUnit).toFixed(1))}<small> {displayUnit}</small></span>
                        <span className="sep">·</span>
                        <span className={`delta${delta !== null && delta > 0 ? " gain" : delta !== null && delta < 0 ? " loss" : ""}`}>{formatDelta(delta)}</span>
                        <span className="sep">·</span>
                        <span className="date-str">{entryDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                        {entry.note ? <span className="note-str">{entry.note}</span> : null}
                      </div>
                      <span className="w-hist-actions">
                        <button type="button" onClick={() => handleEditWeightEntry(entry)}>Edit</button>
                        <button type="button" onClick={() => setWeightEntryToDelete(entry)}>Delete</button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
            <button type="button" className="w-cta" onClick={openWeightForm}>Enter Weight</button>
          </>
        )}

        {isWeightFormOpen && renderWeightForm()}

        {weightEntryToDelete && (
          <div className="floating-overlay" role="presentation">
            <div className="floating-popover confirm-modal" role="dialog" aria-modal="true" aria-labelledby="remove-weight-title">
              <h2 id="remove-weight-title">Delete weight entry?</h2>
              <p>{formatWeightValue(weightEntryToDelete.weight, weightEntryToDelete.unit)} from {formatShortDate(weightEntryToDelete.date)} will be deleted.</p>
              <button className="danger-button" onClick={confirmDeleteWeightEntry}>Delete</button>
              <button className="secondary-button" onClick={() => setWeightEntryToDelete(null)}>Cancel</button>
            </div>
          </div>
        )}

        {bottomNav}
      </main>
    );

}
