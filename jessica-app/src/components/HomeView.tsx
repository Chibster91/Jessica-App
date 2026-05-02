import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  convertWeightValue,
  formatShortDate,
  formatWeekOf,
  formatWeightValue,
  formatWeightValueInUnit,
  getSavedLog,
  getShortDayName,
  getWeekDates,
  shiftDate,
  type Goals,
  type LogItem,
  type WeightEntry,
  type WeightUnit
} from "../appSupport";

type HomeViewProps = {
  bottomNav: ReactNode;
  selectedDate: string;
  log: LogItem[];
  goals: Goals | null;
  homeSelectedDate: string | null;
  setHomeSelectedDate: Dispatch<SetStateAction<string | null>>;
  changeSelectedDate: (date: string) => void;
  toggleHomeDate: (date: string) => void;
  today: string;
  getCompletedStreak: (referenceDate?: string, days?: string[]) => number;
  goalsView: "daily" | "weekly";
  setGoalsView: Dispatch<SetStateAction<"daily" | "weekly">>;
  currentWeightEntry: WeightEntry | null;
  startingWeightEntry: WeightEntry | null;
  weightUnit: WeightUnit;
};

export function HomeView({
  bottomNav,
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
  weightUnit
}: HomeViewProps) {
    const weekDates = getWeekDates(selectedDate);
    const weekStats = weekDates.map((date) => {
      const dayLog = date === selectedDate ? log : getSavedLog(date);
      return {
        date,
        calories: dayLog.reduce((s, item) => s + Math.round(item.calories * (item.quantity ?? 1)), 0),
        protein: dayLog.reduce((s, item) => s + item.protein * (item.quantity ?? 1), 0),
        carbs: dayLog.reduce((s, item) => s + item.carbs * (item.quantity ?? 1), 0),
        fat: dayLog.reduce((s, item) => s + item.fat * (item.quantity ?? 1), 0),
      };
    });

    const goalCal = goals?.calories ?? 0;
    const maxDayCalories = Math.max(...weekStats.map((d) => d.calories), 1);
    const weekCalorieGoal = goalCal * 7;
    const weekTotalCalories = weekStats.reduce((s, d) => s + d.calories, 0);
    const weekTotalProtein = weekStats.reduce((s, d) => s + d.protein, 0);
    const weekTotalCarbs = weekStats.reduce((s, d) => s + d.carbs, 0);
    const weekTotalFat = weekStats.reduce((s, d) => s + d.fat, 0);
    const selectedHomeStats = homeSelectedDate
      ? weekStats.find((day) => day.date === homeSelectedDate) ?? null
      : null;
    const displayStats = selectedHomeStats ?? {
      date: weekDates[0],
      calories: weekTotalCalories,
      protein: weekTotalProtein,
      carbs: weekTotalCarbs,
      fat: weekTotalFat,
    };
    const displayGoalCal = selectedHomeStats ? goalCal : weekCalorieGoal;
    const remaining = displayGoalCal - displayStats.calories;

    const totalMacroGrams = displayStats.fat + displayStats.carbs + displayStats.protein;
    const macroPieSlices = [
      { label: "Protein", value: displayStats.protein, color: "var(--macro-protein)" },
      { label: "Carbs", value: displayStats.carbs, color: "var(--macro-carbs)" },
      { label: "Fat", value: displayStats.fat, color: "var(--macro-fat)" },
    ].reduce(
      (slices, macro) => {
        if (totalMacroGrams <= 0 || macro.value <= 0) return slices;

        const startAngle = slices.at(-1)?.endAngle ?? -90;
        const angle = (macro.value / totalMacroGrams) * 360;
        const endAngle = startAngle + angle;
        const midAngle = startAngle + angle / 2;
        const startRad = (Math.PI / 180) * startAngle;
        const endRad = (Math.PI / 180) * endAngle;
        const midRad = (Math.PI / 180) * midAngle;
        const largeArc = angle > 180 ? 1 : 0;
        const startX = 50 + 48 * Math.cos(startRad);
        const startY = 50 + 48 * Math.sin(startRad);
        const endX = 50 + 48 * Math.cos(endRad);
        const endY = 50 + 48 * Math.sin(endRad);
        const labelX = 50 + 27 * Math.cos(midRad);
        const labelY = 50 + 27 * Math.sin(midRad);

        return [
          ...slices,
          {
            ...macro,
            endAngle,
            percentage: Math.round((macro.value / totalMacroGrams) * 100),
            path: `M 50 50 L ${startX} ${startY} A 48 48 0 ${largeArc} 1 ${endX} ${endY} Z`,
            labelX,
            labelY,
          },
        ];
      },
      [] as {
        label: string;
        value: number;
        color: string;
        endAngle: number;
        percentage: number;
        path: string;
        labelX: number;
        labelY: number;
      }[]
    );

    const completedStreak = getCompletedStreak();
    const weekLabel = formatWeekOf(weekDates[0], weekDates[6]);
    const calPct = displayGoalCal > 0
      ? Math.min(100, Math.round((displayStats.calories / displayGoalCal) * 100))
      : 0;
    const calorieBudgetMarkerPct = 75;
    const calorieOverflowCapacity = goalCal * 0.35;
    const todayStats = weekStats.find((d) => d.date === today);
    const todayCalories = todayStats?.calories ?? 0;
    const todayRemaining = goalCal > 0 ? goalCal - todayCalories : null;

    return (
      <main className="app">
        {/* Week navigation */}
        <div className="dash-week-nav">
          <button type="button" className="dash-week-arrow" onClick={() => { setHomeSelectedDate(null); changeSelectedDate(shiftDate(selectedDate, -7)); }} aria-label="Previous week">‹</button>
          <span className="dash-week-label">Week of: {weekLabel}</span>
          <button type="button" className="dash-week-arrow" onClick={() => { setHomeSelectedDate(null); changeSelectedDate(shiftDate(selectedDate, 7)); }} aria-label="Next week">›</button>
        </div>

        {/* CALORIES CARD */}
        <section className="dash-card">
          <p className="dash-card-label">CALORIES</p>
          <div className="dash-cal-hero">
            <div className="dash-cal-bar-bg">
              <div className="dash-cal-bar-fill" style={{ width: `${calPct}%` }} />
            </div>
            <span className="dash-cal-number" style={{ color: remaining < 0 ? "#f87171" : "#f3f4f6" }}>
              {displayStats.calories.toLocaleString()}
            </span>
            <span className="dash-cal-sub">
              {displayGoalCal > 0
                ? (remaining >= 0 ? `${remaining.toLocaleString()} remaining` : `${Math.abs(remaining).toLocaleString()} over`)
                : "calories eaten"}
            </span>
          </div>
          <div className="dash-day-bars" aria-label="Weekly calorie bars">
            {weekStats.map(({ date, calories }) => {
              const isSel = date === homeSelectedDate;
              const isToday = date === today;
              const greenPct = goalCal > 0
                ? Math.min(calorieBudgetMarkerPct, (calories / goalCal) * calorieBudgetMarkerPct)
                : Math.min(100, (calories / maxDayCalories) * 100);
              const redPct = goalCal > 0 && calories > goalCal
                ? Math.min(100 - calorieBudgetMarkerPct, ((calories - goalCal) / calorieOverflowCapacity) * (100 - calorieBudgetMarkerPct))
                : 0;
              const dayLabel = getShortDayName(date);
              return (
                <button key={date} type="button"
                  className={`dash-day-col${isSel ? " selected" : ""}`}
                  aria-pressed={isSel}
                  onClick={() => toggleHomeDate(date)}>
                  <div className={`dash-bar-wrap dash-budget-wrap${isSel ? " sel" : ""}`}>
                    <div className="dash-budget-marker" style={{ bottom: `${calorieBudgetMarkerPct}%` }} />
                    <div className={`dash-cal-budget-fill${isToday ? " today" : ""}`} style={{ height: `${greenPct}%` }} />
                  {redPct > 0 && (
                      <div className="dash-cal-over-fill" style={{ bottom: `${calorieBudgetMarkerPct}%`, height: `${redPct}%` }} />
                    )}
                  </div>
                  <span className={`dash-bar-day${isSel ? " sel" : ""}${isToday ? " today" : ""}`}>{dayLabel}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* MACROS CARD */}
        <section className="dash-card dash-macro-card">
          <p className="dash-card-label">MACROS</p>
          <div className="dash-macro-layout">
            <div className="dash-pie-wrap">
              <svg viewBox="0 0 100 100" className="dash-pie-chart" role="img" aria-label="Macro split">
                {macroPieSlices.length > 0 ? (
                  macroPieSlices.map((slice) => (
                    <g key={slice.label}>
                      <path d={slice.path} fill={slice.color} />
                    </g>
                  ))
                ) : (
                  <circle cx="50" cy="50" r="48" fill="#3E505B" />
                )}
              </svg>
            </div>
            <div className="dash-macro-side">
              <div className="dash-macro-meter-col" aria-label="Weekly macro composition bars">
                {weekStats.map(({ date, protein, carbs, fat }) => {
                  const isSel = date === homeSelectedDate;
                  const isToday = date === today;
                  const total = protein + carbs + fat;

                  return (
                    <button
                      key={date}
                      type="button"
                      className="dash-day-col"
                      aria-pressed={isSel}
                      aria-label={getShortDayName(date)}
                      onClick={() => toggleHomeDate(date)}
                    >
                      <div className={`dash-macro-meter${isSel ? " sel" : ""}${isToday ? " today" : ""}${total > 0 ? " logged" : ""}`}>
                        {total > 0 ? (
                          <div className="dash-macro-meter-fill">
                            {protein > 0 && <div style={{ flex: protein, background: "var(--macro-protein)" }} />}
                            {carbs > 0 && <div style={{ flex: carbs, background: "var(--macro-carbs)" }} />}
                            {fat > 0 && <div style={{ flex: fat, background: "var(--macro-fat)" }} />}
                          </div>
                        ) : (
                          <div className="dash-macro-meter-empty" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="dash-macro-summary-line" aria-label="Macro breakdown">
                <span><b style={{ color: "var(--macro-protein)" }}>Protein</b> {Math.round(displayStats.protein)}g</span>
                <span><b style={{ color: "var(--macro-carbs)" }}>Carbs</b> {Math.round(displayStats.carbs)}g</span>
                <span><b style={{ color: "var(--macro-fat)" }}>Fat</b> {Math.round(displayStats.fat)}g</span>
              </p>
            </div>
          </div>
        </section>

        {/* BOTTOM CARDS */}
        <section className="dash-bottom-grid">
          {/* Top Left: Streak */}
          <div className="dash-card dash-mini-card dash-streak-card">
            <p className="dash-quad-label">Streak</p>
            <strong className="dash-streak-num">{completedStreak > 0 ? completedStreak : "—"}</strong>
            <span className="dash-quad-sub">days completed</span>
          </div>

          {/* Top Right: Weekly Macro Goals */}
          <div className="dash-card dash-mini-card">
            <div className="dash-card-title-row">
              <p className="dash-quad-label">Goals</p>
              <div className="dash-goals-toggle" aria-label="Goal range">
                <button
                  type="button"
                  className={goalsView === "daily" ? "active" : ""}
                  onClick={() => setGoalsView("daily")}
                >
                  Daily
                </button>
                <button
                  type="button"
                  className={goalsView === "weekly" ? "active" : ""}
                  onClick={() => setGoalsView("weekly")}
                >
                  Weekly
                </button>
              </div>
            </div>
            {goals ? (
              <div className="dash-macro-progress-list">
                {[
                  { label: "Protein", total: goalsView === "weekly" ? weekTotalProtein : displayStats.protein, goal: goals.protein * (goalsView === "weekly" ? 7 : 1), color: "var(--macro-protein)", overflowColor: "#22c55e" },
                  { label: "Carbs", total: goalsView === "weekly" ? weekTotalCarbs : displayStats.carbs, goal: goals.carbs * (goalsView === "weekly" ? 7 : 1), color: "var(--macro-carbs)", overflowColor: "#38bdf8" },
                  { label: "Fat", total: goalsView === "weekly" ? weekTotalFat : displayStats.fat, goal: goals.fat * (goalsView === "weekly" ? 7 : 1), color: "var(--macro-fat)", overflowColor: "#fb923c" },
                ].map(({ label, total, goal, color, overflowColor }) => {
                  const markerPct = 80;
                  const goalFillPct = goal > 0 ? Math.min(markerPct, (total / goal) * markerPct) : 0;
                  const overflowPct = goal > 0 && total > goal
                    ? Math.min(100 - markerPct, ((total - goal) / (goal * 0.25 || 1)) * (100 - markerPct))
                    : 0;
                  return (
                    <div key={label} className="dash-macro-prog-row">
                      <div className="dash-macro-prog-head">
                        <span className="dash-macro-prog-label">{label}</span>
                        <span className="dash-macro-prog-pct">
                          {goal > 0 ? `${Math.round((total / goal) * 100)}% / ${Math.round(total)}g` : `${Math.round(total)}g`}
                        </span>
                      </div>
                      <div className="dash-macro-prog-track">
                        <div className="dash-goal-marker" style={{ left: `${markerPct}%` }} />
                        <div className="dash-macro-prog-fill" style={{ width: `${goalFillPct}%`, background: color }} />
                        {overflowPct > 0 && (
                          <div
                            className="dash-macro-prog-over"
                            style={{ left: `${markerPct}%`, width: `${overflowPct}%`, background: overflowColor }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="dash-quad-sub">Set goals in Profile</p>
            )}
          </div>

          {/* Bottom Left: Weight */}
          <div className="dash-card dash-mini-card dash-weight-card">
            <p className="dash-quad-label">Weight</p>
            {currentWeightEntry ? (
              <>
                <strong className="dash-weight-num">
                  {formatWeightValueInUnit(currentWeightEntry.weight, currentWeightEntry.unit, weightUnit)}
                </strong>
                {startingWeightEntry && startingWeightEntry.id !== currentWeightEntry.id && (() => {
                  const cur = convertWeightValue(currentWeightEntry.weight, currentWeightEntry.unit, weightUnit);
                  const start = convertWeightValue(startingWeightEntry.weight, startingWeightEntry.unit, weightUnit);
                  const diff = cur - start;
                  return (
                    <span className={`dash-quad-sub ${diff <= 0 ? "weight-lost" : "weight-gained"}`}>
                      {diff < 0 ? `↓ ${formatWeightValue(Math.abs(diff), weightUnit)} lost` : `↑ ${formatWeightValue(diff, weightUnit)} gained`}
                    </span>
                  );
                })()}
                {goals?.goalWeight && (() => {
                  const cur = convertWeightValue(currentWeightEntry.weight, currentWeightEntry.unit, weightUnit);
                  const goal = goals.goalWeightUnit
                    ? convertWeightValue(goals.goalWeight, goals.goalWeightUnit, weightUnit)
                    : goals.goalWeight;
                  const remaining = Math.abs(cur - goal);
                  const pct = startingWeightEntry
                    ? Math.min(100, Math.max(0, Math.round(
                        Math.abs(cur - convertWeightValue(startingWeightEntry.weight, startingWeightEntry.unit, weightUnit)) /
                        Math.abs(goal - convertWeightValue(startingWeightEntry.weight, startingWeightEntry.unit, weightUnit)) * 100
                      )))
                    : 0;
                  return (
                    <>
                      <span className="dash-quad-sub">Goal: {formatWeightValue(goal, weightUnit)}</span>
                      <div className="dash-macro-prog-track" style={{ marginTop: "0.3rem" }}>
                        <div className="dash-macro-prog-fill" style={{ width: `${pct}%`, background: "#8AB0AB" }} />
                      </div>
                      <span className="dash-quad-sub">{formatWeightValue(remaining, weightUnit)} remaining</span>
                    </>
                  );
                })()}
                {!goals?.goalWeight && (
                  <span className="dash-quad-sub">Last: {formatShortDate(currentWeightEntry.date)}</span>
                )}
              </>
            ) : (
              <span className="dash-quad-sub">No entries yet</span>
            )}
          </div>

          {/* Bottom Right: Today */}
          <div className="dash-card dash-mini-card">
            <p className="dash-quad-label">Today</p>
            <strong className="dash-streak-num" style={{ color: "var(--fg)" }}>
              {todayCalories.toLocaleString()}
            </strong>
            <span className="dash-quad-sub">
              {todayRemaining !== null
                ? `cal · ${todayRemaining >= 0 ? todayRemaining.toLocaleString() : `${Math.abs(todayRemaining).toLocaleString()} over`} ${todayRemaining >= 0 ? "left" : ""}`
                : "cal today"}
            </span>
          </div>
        </section>

        {bottomNav}
      </main>
    );
}
