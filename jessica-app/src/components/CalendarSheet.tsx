import { useMemo, useState, type CSSProperties } from "react";
import { Sheet } from "./Overlays";
import {
  addMonths,
  formatEntryDate,
  getItemCalories,
  getLocalDateString,
  getMonthGridWeeks,
  getMonthLabel,
  getSavedLog,
  type Goals,
} from "../appSupport";
import "../styles/calendar.css";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CalendarSheetProps = {
  selectedDate: string;
  completedDays: string[];
  goals: Goals | null;
  onPick: (date: string) => void;
  onClose: () => void;
};

export function CalendarSheet({ selectedDate, completedDays, goals, onPick, onClose }: CalendarSheetProps) {
  const [viewMonth, setViewMonth] = useState(selectedDate);
  const today = getLocalDateString();
  const goalCal = goals?.calories ?? 0;
  const displayedMonth = Number(viewMonth.split("-")[1]);

  const weeks = useMemo(() => getMonthGridWeeks(viewMonth), [viewMonth]);

  // Calorie total for every cell in the visible grid (cheap localStorage reads).
  const dayCalories = useMemo(() => {
    const map = new Map<string, number>();
    for (const week of weeks) {
      for (const date of week) {
        map.set(date, getSavedLog(date).reduce((sum, item) => sum + getItemCalories(item), 0));
      }
    }
    return map;
  }, [weeks]);

  return (
    <Sheet title={formatEntryDate(selectedDate)} onClose={onClose}>
      <div className="cal-month-head">
        <span className="cal-month-label">{getMonthLabel(viewMonth)}</span>
        <div className="cal-month-nav">
          <button type="button" onClick={() => setViewMonth((m) => addMonths(m, -1))} aria-label="Previous month">‹</button>
          <button type="button" onClick={() => setViewMonth((m) => addMonths(m, 1))} aria-label="Next month">›</button>
        </div>
      </div>

      <div className="cal-grid cal-weekday-row" aria-hidden>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="cal-weekday">{label}</span>
        ))}
        <span className="cal-weekday">Week</span>
      </div>

      <div className="cal-weeks">
        {weeks.map((week) => {
          // Weekly over/under: only days that were actually logged contribute,
          // so empty/future weeks read "UNDER 0" rather than a full deficit.
          const weekDelta = week.reduce((sum, date) => {
            const cal = dayCalories.get(date) ?? 0;
            const hasLog = cal > 0 || completedDays.includes(date);
            return hasLog && goalCal > 0 ? sum + (cal - goalCal) : sum;
          }, 0);
          const isOverWeek = weekDelta > 0;

          return (
            <div key={week[0]} className="cal-grid cal-week-row">
              {week.map((date) => {
                const cal = dayCalories.get(date) ?? 0;
                const inMonth = Number(date.split("-")[1]) === displayedMonth;
                const isToday = date === today;
                const isSelected = date === selectedDate;
                const isCompleted = completedDays.includes(date);
                const isOver = goalCal > 0 && cal > goalCal;
                const pct = goalCal > 0 ? Math.min(100, Math.round((cal / goalCal) * 100)) : 0;
                const dayNum = Number(date.split("-")[2]);

                return (
                  <button
                    key={date}
                    type="button"
                    className={`cal-day${isSelected ? " is-selected" : ""}${inMonth ? "" : " is-outside"}`}
                    onClick={() => onPick(date)}
                    aria-label={formatEntryDate(date)}
                    aria-current={isToday ? "date" : undefined}
                  >
                    <span className={`cal-day-num${isToday ? " is-today" : ""}`}>{dayNum}</span>
                    <span
                      className={`cal-day-ring${isOver ? " is-over" : ""}`}
                      style={{ "--p": pct } as CSSProperties}
                    >
                      {isCompleted && <span className="cal-day-check">✓</span>}
                    </span>
                  </button>
                );
              })}
              <div className={`cal-week-cell${isOverWeek ? " over" : " under"}`}>
                <span className="cal-week-state">{isOverWeek ? "OVER" : "UNDER"}</span>
                <span className="cal-week-num">{Math.abs(Math.round(weekDelta)).toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
