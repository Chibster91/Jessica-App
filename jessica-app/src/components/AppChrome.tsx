import { getDayLetter, getWeekDates, type AppView } from "../appSupport";

type AppChromeProps = {
  appView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenLibrary: () => void;
  onOpenDebugPanel: () => void;
  isDebugPanelOpen: boolean;
  debugLogText: string;
  debugCopyStatus: string;
  onCloseDebugPanel: () => void;
  onCopyDebugLog: () => void;
  onClearDebugLog: () => void;
  showStreakPopup: boolean;
  streakPopupDate: string;
  completedDays: string[];
  getCompletedStreak: (referenceDate?: string, days?: string[]) => number;
  onCloseStreakPopup: () => void;
};

export function AppChrome({
  appView,
  onNavigate,
  onOpenLibrary,
  onOpenDebugPanel,
  isDebugPanelOpen,
  debugLogText,
  debugCopyStatus,
  onCloseDebugPanel,
  onCopyDebugLog,
  onClearDebugLog,
  showStreakPopup,
  streakPopupDate,
  completedDays,
  getCompletedStreak,
  onCloseStreakPopup,
}: AppChromeProps) {
  const popupWeekDates = getWeekDates(streakPopupDate);
  const popupCompletedDays = completedDays.includes(streakPopupDate)
    ? completedDays
    : [...completedDays, streakPopupDate];
  const completedSet = new Set(popupCompletedDays);

  return (
    <>
      <button type="button" className="debug-fab" onClick={onOpenDebugPanel}>
        Debug
      </button>
      <nav className="bottom-nav" aria-label="Main navigation">
        <button type="button" className={appView === "home" ? "active" : ""} onClick={() => onNavigate("home")}>
          <span className="nav-icon">⌂</span>
          <span>Home</span>
        </button>
        <button type="button" className={appView === "day" ? "active" : ""} onClick={() => onNavigate("day")}>
          <span className="nav-icon">≡</span>
          <span>Log</span>
        </button>
        <button type="button" className={appView === "weight" ? "active" : ""} onClick={() => onNavigate("weight")}>
          <span className="nav-icon">↕</span>
          <span>Weight</span>
        </button>
        <button type="button" className={appView === "library" ? "active" : ""} onClick={onOpenLibrary}>
          <span className="nav-icon">⊞</span>
          <span>Library</span>
        </button>
        <button type="button" className={appView === "profile" ? "active" : ""} onClick={() => onNavigate("profile")}>
          <span className="nav-icon">◉</span>
          <span>Profile</span>
        </button>
      </nav>
      {isDebugPanelOpen && (
        <div className="modal-backdrop debug-backdrop" role="presentation">
          <div className="modal debug-panel" role="dialog" aria-modal="true" aria-labelledby="debug-panel-title">
            <div className="debug-panel-header">
              <h2 id="debug-panel-title">Debug Log</h2>
              <button type="button" className="secondary-button" onClick={onCloseDebugPanel}>
                Close
              </button>
            </div>
            <textarea readOnly value={debugLogText} />
            {debugCopyStatus && <p className="scan-status">{debugCopyStatus}</p>}
            <div className="form-actions">
              <button type="button" onClick={onCopyDebugLog}>
                Copy Log
              </button>
              <button type="button" className="danger-button" onClick={onClearDebugLog}>
                Clear Log
              </button>
            </div>
          </div>
        </div>
      )}
      {showStreakPopup && (
        <div className="floating-overlay" role="presentation" onClick={onCloseStreakPopup}>
          <div
            className="floating-popover streak-popup"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="streak-popup-title">Day Logged!</h2>
            <div className="streak-popup-num">{getCompletedStreak(streakPopupDate, popupCompletedDays)}</div>
            <p className="streak-popup-label">day streak</p>
            <div className="streak-week-grid">
              {popupWeekDates.map((date) => {
                const done = completedSet.has(date);
                const letter = getDayLetter(date);
                return (
                  <div key={date} className={`streak-day-cell${done ? " done" : ""}`}>
                    <span className="streak-day-check">{done ? "✓" : ""}</span>
                    <span className="streak-day-letter">{letter}</span>
                  </div>
                );
              })}
            </div>
            <button type="button" className="primary-button" onClick={onCloseStreakPopup}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
