import { useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction, type SyntheticEvent } from "react";
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
  type WeightEntry,
  type WeightForm,
  type WeightRange,
  type WeightUnit,
  type Profile
} from "../appSupport";

type WeightViewProps = {
  bottomNav: ReactNode;
  today: string;
  weightUnit: WeightUnit;
  profile: Profile | null;
  chartWeightEntries: WeightEntry[];
  currentWeightEntry: WeightEntry | null;
  startingWeightEntry: WeightEntry | null;
  weightForm: WeightForm;
  setWeightForm: Dispatch<SetStateAction<WeightForm>>;
  weightSaveError: string;
  setWeightSaveError: Dispatch<SetStateAction<string>>;
  isWeightFormValid: boolean;
  editingWeightEntryId: string | null;
  setEditingWeightEntryId: Dispatch<SetStateAction<string | null>>;
  saveWeightEntry: () => void;
  tapProbeProps: (name: string) => React.HTMLAttributes<HTMLElement>;
  logTapProbe: (name: string, phase: string, event: SyntheticEvent<HTMLElement>) => void;
  weightRange: WeightRange;
  setWeightRange: Dispatch<SetStateAction<WeightRange>>;
  weightChartPointId: string | null;
  setWeightChartPointId: Dispatch<SetStateAction<string | null>>;
  sortedWeightEntriesOldest: WeightEntry[];
  sortedWeightEntriesNewest: WeightEntry[];
  startEditWeightEntry: (entry: WeightEntry) => void;
  weightEntryToDelete: WeightEntry | null;
  setWeightEntryToDelete: Dispatch<SetStateAction<WeightEntry | null>>;
  confirmDeleteWeightEntry: () => void;
};

export function WeightView({
  bottomNav,
  today,
  weightUnit,
  profile,
  chartWeightEntries,
  currentWeightEntry,
  startingWeightEntry,
  weightForm,
  setWeightForm,
  weightSaveError,
  setWeightSaveError,
  isWeightFormValid,
  editingWeightEntryId,
  setEditingWeightEntryId,
  saveWeightEntry,
  tapProbeProps,
  logTapProbe,
  weightRange,
  setWeightRange,
  weightChartPointId,
  setWeightChartPointId,
  sortedWeightEntriesOldest,
  sortedWeightEntriesNewest,
  startEditWeightEntry,
  weightEntryToDelete,
  setWeightEntryToDelete,
  confirmDeleteWeightEntry
}: WeightViewProps) {
    const displayUnit = weightUnit;
    const chartWidth = 360;
    const chartHeight = 240;
    const chartLeft = 60;
    const chartRight = 24;
    const chartTop = 18;
    const chartBottom = 48;
    const chartPlotWidth = chartWidth - chartLeft - chartRight;
    const chartPlotHeight = chartHeight - chartTop - chartBottom;
    const chartEntries = chartWeightEntries.map((entry) => ({
      ...entry,
      displayWeight: convertWeightValue(entry.weight, entry.unit, displayUnit),
    }));
    const chartWeights = chartEntries.map((entry) => entry.displayWeight);
    const minDisplayWeight = chartWeights.length ? Math.min(...chartWeights) : 0;
    const maxDisplayWeight = chartWeights.length ? Math.max(...chartWeights) : 0;
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
    const chartRangeLabel =
      chartEntries.length > 0 ? formatDateRange(chartFirstDate, chartLastDate) : "No entries";
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
    const goalWeight = profile?.goalWeightKg ? convertWeightValue(profile.goalWeightKg, "kg", displayUnit) : null;
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
    const timePct = projectedGoalDays !== null
      ? Math.min(100, Math.max(0, (elapsedDays / (elapsedDays + projectedGoalDays)) * 100))
      : chartEntries.length > 1
        ? 100
        : 0;
    const ringSegmentsOn = Math.round(progressPct / 20);
    const selectedChartBmi = selectedChartPoint && profile
      ? convertWeightValue(selectedChartPoint.weight, selectedChartPoint.unit, "kg") / ((profile.heightCm / 100) ** 2)
      : null;
    const openWeightForm = () => {
      setWeightSaveError("");
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
    const renderWeightForm = () => (
      <section className="w-panel weight-entry-panel" {...tapProbeProps("weight-entry-panel")}>
        <h2>{editingWeightEntryId ? "Edit Weight" : "Enter Weight"}</h2>
        <div className="weight-form" {...tapProbeProps("weight-form")}>
          <label>
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
          <label>
            Weight ({weightUnit})
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.]?[0-9]*"
              value={weightForm.weight}
              onChange={(e) => {
                setWeightSaveError("");
                setWeightForm({ ...weightForm, weight: e.target.value });
              }}
            />
          </label>
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
      </section>
    );

    return (
      <main className="app">
        <div className="w-screen-head"></div>

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

              <div className="w-bmi-row">
                <span className="lbl">BMI</span>
                <span className="val">{bmi !== null ? Number(bmi.toFixed(1)) : "--"}</span>
                <span className="cls">{getBmiClass(bmi)}</span>
              </div>

              <div className="w-avg-grid">
                <div className="w-avg"><div className="lbl">Avg daily loss</div><div className="val">{avgDailyChange !== null ? Number(Math.abs(avgDailyChange).toFixed(2)) : "--"}<small>{displayUnit}</small></div></div>
                <div className="w-avg"><div className="lbl">Total change</div><div className="val">{summaryChangeLabel}</div></div>
                <div className="w-avg"><div className="lbl">Avg weekly loss</div><div className="val">{avgWeeklyChange !== null ? Number(Math.abs(avgWeeklyChange).toFixed(2)) : "--"}<small>{displayUnit}</small></div></div>
              </div>
            </section>

            <button type="button" className="w-cta" onClick={openWeightForm}>Enter Weight</button>
            <h2 className="w-section-title">History</h2>
            {isWeightFormOpen && renderWeightForm()}
            <section className="w-panel w-history-panel">
              {sortedWeightEntriesNewest.length === 0 && <p className="empty-meal">Add your first weigh-in to start tracking progress.</p>}
              <div className="w-hist-list">
                {sortedWeightEntriesNewest.map((entry) => {
                  const delta = getHistoryDelta(entry);
                  const entryDate = new Date(`${entry.date}T12:00:00`);
                  return (
                    <div className="w-hist-row" key={entry.id}>
                      <div className="w-hist-weight">
                        <span className="val">{Number(convertWeightValue(entry.weight, entry.unit, displayUnit).toFixed(1))}<small>{displayUnit}</small></span>
                        <span className={`delta${delta !== null && delta > 0 ? " gain" : delta !== null && delta < 0 ? " loss" : ""}`}>{formatDelta(delta)}</span>
                      </div>
                      <div className="w-segs">{Array.from({ length: 3 }, (_, index) => <span key={index} className={getSegmentClass(index, delta)} />)}</div>
                      <div className="w-hist-date">
                        <div className="w-hist-date-top">
                          <span className="month">{entryDate.toLocaleDateString("en-US", { month: "short" })}</span>
                          <span className="day">{entryDate.toLocaleDateString("en-US", { day: "2-digit" })}</span>
                        </div>
                        <div className="year">{entryDate.getFullYear()}</div>
                      </div>
                      <div className="w-hist-time">
                        <span className="dow">{entryDate.toLocaleDateString("en-US", { weekday: "long" })}</span>
                        <span className="clock">{entry.note || ""}</span>
                        <span className="w-hist-actions">
                          <button type="button" onClick={() => handleEditWeightEntry(entry)}>Edit</button>
                          <button type="button" onClick={() => setWeightEntryToDelete(entry)}>Delete</button>
                        </span>
                      </div>
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

            <button type="button" className="w-cta" onClick={openWeightForm}>Enter Weight</button>
            {isWeightFormOpen && renderWeightForm()}
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
                      <div className="w-hist-weight">
                        <span className="val">{Number(convertWeightValue(entry.weight, entry.unit, displayUnit).toFixed(1))}<small>{displayUnit}</small></span>
                        <span className={`delta${delta !== null && delta > 0 ? " gain" : delta !== null && delta < 0 ? " loss" : ""}`}>{formatDelta(delta)}</span>
                      </div>
                      <div className="w-segs">{Array.from({ length: 3 }, (_, index) => <span key={index} className={getSegmentClass(index, delta)} />)}</div>
                      <div className="w-hist-date">
                        <div className="w-hist-date-top">
                          <span className="month">{entryDate.toLocaleDateString("en-US", { month: "short" })}</span>
                          <span className="day">{entryDate.toLocaleDateString("en-US", { day: "2-digit" })}</span>
                        </div>
                        <div className="year">{entryDate.getFullYear()}</div>
                      </div>
                      <div className="w-hist-time">
                        <span className="dow">{entryDate.toLocaleDateString("en-US", { weekday: "long" })}</span>
                        <span className="clock">{entry.note || ""}</span>
                        <span className="w-hist-actions">
                          <button type="button" onClick={() => handleEditWeightEntry(entry)}>Edit</button>
                          <button type="button" onClick={() => setWeightEntryToDelete(entry)}>Delete</button>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            <button type="button" className="w-cta" onClick={openWeightForm}>Enter Weight</button>
            {isWeightFormOpen && renderWeightForm()}
          </>
        )}

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
