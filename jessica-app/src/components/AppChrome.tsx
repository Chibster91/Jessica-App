import { type AppView } from "../appSupport";
import { StreakCelebration } from "./Overlays";

type AppChromeProps = {
  appView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenLibrary: () => void;
  isDebugMode: boolean;
  isDebugPanelOpen: boolean;
  debugLogText: string;
  debugCopyStatus: string;
  onOpenDebugPanel: () => void;
  onCloseDebugPanel: () => void;
  onCopyDebugLog: () => void;
  onClearDebugLog: () => void;
  streakCelebration: { from: number; to: number } | null;
  onCloseStreakCelebration: () => void;
};

export function AppChrome({
  appView,
  onNavigate,
  onOpenLibrary,
  isDebugMode,
  isDebugPanelOpen,
  debugLogText,
  debugCopyStatus,
  onOpenDebugPanel,
  onCloseDebugPanel,
  onCopyDebugLog,
  onClearDebugLog,
  streakCelebration,
  onCloseStreakCelebration,
}: AppChromeProps) {
  return (
    <>
     <nav className="bottom-nav" aria-label="Main navigation">
  <button
    type="button"
    className={appView === "home" ? "active" : ""}
    onClick={() => onNavigate("home")}
  >
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V9.5" />
    </svg>
    <span>Home</span>
  </button>

  <button
    type="button"
    className={appView === "day" ? "active" : ""}
    onClick={() => onNavigate("day")}
  >
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
    <span>Log</span>
  </button>

  <button
    type="button"
    className={appView === "weight" || appView === "egg-oracle" ? "active" : ""}
    onClick={() => onNavigate("weight")}
  >
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
    <span>Health</span>
  </button>

  <button
    type="button"
    className={appView === "library" ? "active" : ""}
    onClick={onOpenLibrary}
  >
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
    </svg>
    <span>Library</span>
  </button>

  <button
    type="button"
    className={appView === "profile" ? "active" : ""}
    onClick={() => onNavigate("profile")}
  >
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 21a7 7 0 0 1 14 0" />
    </svg>
    <span>Profile</span>
  </button>
</nav>
      {isDebugMode && !isDebugPanelOpen && (
        <button
          type="button"
          onClick={onOpenDebugPanel}
          aria-label="Open debug log"
          style={{
            position: "fixed",
            right: "0.75rem",
            bottom: "4.5rem",
            zIndex: 50,
            opacity: 0.65,
            borderRadius: "50%",
            width: "2.5rem",
            height: "2.5rem",
            padding: 0,
          }}
        >
          🐞
        </button>
      )}
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
      {streakCelebration && (
        <StreakCelebration
          from={streakCelebration.from}
          to={streakCelebration.to}
          onClose={onCloseStreakCelebration}
        />
      )}
    </>
  );
}
