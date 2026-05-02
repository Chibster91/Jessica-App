import { useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  formatEntryDate,
  formatHeightValue,
  formatProfileNumber,
  formatWeightValue,
  getLocalDateString,
  getSavedCustomFoods,
  getSavedRecipes,
  getSavedWeightEntries,
  kgToLb,
  macroPresets,
  profileActivityLabels,
  profileActivityMultipliers,
  profileActivityOptions,
  profilePaceOptions,
  profileToForm,
  profileToGoals,
  profileWizardSteps,
  poundsPerKilogram,
  shiftDate,
  toProfileActivityLevel,
  type GoalType,
  type MacroPreset,
  type Profile,
  type ProfileCalculation,
  type ProfileForm,
  type ProfileUnits,
  type Sex
} from "../appSupport";

type ProfileViewProps = {
  bottomNav: ReactNode;
  profile: Profile | null;
  profileForm: ProfileForm;
  setProfileForm: Dispatch<SetStateAction<ProfileForm>>;
  updateProfileForm: (updates: Partial<ProfileForm>) => void;
  profileCalculation: ProfileCalculation | null;
  profileErrors: Record<string, string>;
  profileHasBlockingErrors: boolean;
  profileLowCalorieWarning: string;
  profileWizardStep: number;
  setProfileWizardStep: Dispatch<SetStateAction<number>>;
  isProfileWizardOpen: boolean;
  setIsProfileWizardOpen: Dispatch<SetStateAction<boolean>>;
  profileSaveStatus: string;
  setProfileSaveStatus: Dispatch<SetStateAction<string>>;
  cancelProfileChanges: () => void;
  saveProfile: () => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onConnectDrive: () => void;
  onDeleteAllData: () => void;
};

type DeleteStats = {
  logDays: number;
  weightEntries: number;
  customFoods: number;
  recipes: number;
};

function computeBmr(profile: Profile): number {
  return Math.round(
    10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age +
    (profile.sex === "female" ? -161 : 5)
  );
}

function computeTdee(profile: Profile): number {
  return Math.round(computeBmr(profile) * profileActivityMultipliers[profile.activityLevel]);
}

function computeGoalDate(profile: Profile): string | null {
  if (profile.goal === "maintain" || profile.weeklyRateKg <= 0 || !profile.goalWeightKg) return null;
  if (profile.goal === "lose" && profile.weightKg <= profile.goalWeightKg) return null;
  if (profile.goal === "gain" && profile.weightKg >= profile.goalWeightKg) return null;
  const diff = Math.abs(profile.weightKg - profile.goalWeightKg);
  return shiftDate(getLocalDateString(), Math.ceil((diff / profile.weeklyRateKg) * 7));
}

const stepSubtitles: Record<number, string> = {
  0: "Name, age & height",
  1: "Current weight",
  2: "Activity level",
  3: "Goal & pace",
  4: "Macro targets",
};

const goalOptions: { goal: GoalType; label: string; sub: string }[] = [
  { goal: "lose", label: "Lose", sub: "(-lb)" },
  { goal: "maintain", label: "Maintain", sub: "(±0)" },
  { goal: "gain", label: "Gain", sub: "(+lb)" },
];

const wizardPaceOptions: { key: string; label: string; sub: string; kg: number }[] = [
  { key: "slow", label: "Slow", sub: "0.5 lb/wk", kg: 0.5 / poundsPerKilogram },
  { key: "moderate", label: "Moderate", sub: "1.0 lb/wk", kg: 1.0 / poundsPerKilogram },
  { key: "aggressive", label: "Aggressive", sub: "2.0 lb/wk", kg: 2.0 / poundsPerKilogram },
];

export function ProfileView({
  bottomNav,
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
  cancelProfileChanges,
  saveProfile,
  onOpenExport,
  onOpenImport,
  onConnectDrive,
  onDeleteAllData,
}: ProfileViewProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteStats, setDeleteStats] = useState<DeleteStats | null>(null);

  function openDeleteModal() {
    let logDays = 0;
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith("log-")) logDays++;
    }
    setDeleteStats({
      logDays,
      weightEntries: getSavedWeightEntries().length,
      customFoods: getSavedCustomFoods().length,
      recipes: getSavedRecipes().length,
    });
    setDeleteConfirmText("");
    setIsDeleteModalOpen(true);
  }

  function handleDeleteConfirm() {
    setIsDeleteModalOpen(false);
    setDeleteConfirmText("");
    onDeleteAllData();
  }

  const isSetupMode = !profile;
  const saveButtonLabel = isSetupMode ? "Get Started" : "Save Changes";
  const currentStepName = profileWizardSteps[profileWizardStep];
  const macroPresetOptions: MacroPreset[] = ["balanced", "high_protein", "custom"];
  const requiredStepError =
    profileWizardStep === 0
      ? profileErrors.age || profileErrors.height
      : profileWizardStep === 1
        ? profileErrors.weight
        : profileWizardStep === 3
          ? profileErrors.goalWeight
          : profileWizardStep === 4
            ? profileErrors.macros
            : "";
  const canMoveNext =
    !requiredStepError &&
    (profileWizardStep !== 4 || !profileHasBlockingErrors);
  const planGoalDate = (() => {
    if (profileForm.goal === "maintain") return null;
    const isMetric = profileForm.units === "metric";
    const wKg = isMetric ? Number(profileForm.weight) : Number(profileForm.weight) / poundsPerKilogram;
    const gKg = isMetric ? Number(profileForm.goalWeight) : Number(profileForm.goalWeight) / poundsPerKilogram;
    const rate = Number(profileForm.weeklyRateKg) || 0;
    if (!gKg || rate <= 0) return null;
    if (profileForm.goal === "lose" && wKg <= gKg) return null;
    if (profileForm.goal === "gain" && wKg >= gKg) return null;
    return shiftDate(getLocalDateString(), Math.ceil((Math.abs(wKg - gKg) / rate) * 7));
  })();
  const proteinG = profileCalculation ? Math.round((profileCalculation.activeCalories * Number(profileForm.proteinPct)) / 100 / 4) : 0;
  const carbsG = profileCalculation ? Math.round((profileCalculation.activeCalories * Number(profileForm.carbPct)) / 100 / 4) : 0;
  const fatG = profileCalculation ? Math.round((profileCalculation.activeCalories * Number(profileForm.fatPct)) / 100 / 9) : 0;
  const moveProfileStep = (direction: 1 | -1) => {
    setProfileWizardStep((step) =>
      Math.min(profileWizardSteps.length - 1, Math.max(0, step + direction))
    );
  };
  const handleProfileSave = () => {
    saveProfile();
    if (!profileHasBlockingErrors) setProfileWizardStep(0);
  };

  // ─── READ-ONLY VIEW ────────────────────────────────────────────
  if (profile && !isProfileWizardOpen) {
    const savedProfileGoals = profileToGoals(profile);
    const displayUnit = profile.units === "metric" ? "kg" : "lb";
    const weightDisplay = formatWeightValue(
      profile.units === "metric" ? profile.weightKg : kgToLb(profile.weightKg),
      displayUnit
    );
    const goalWeightDisplay = profile.goalWeightKg
      ? formatWeightValue(
          profile.units === "metric" ? profile.goalWeightKg : kgToLb(profile.goalWeightKg),
          displayUnit
        )
      : null;
    const bmr = computeBmr(profile);
    const tdee = computeTdee(profile);
    const activeCalories = profile.useManualCalories && profile.manualCalorieOverride
      ? profile.manualCalorieOverride
      : profile.calculatedCalories;
    const goalDateStr = computeGoalDate(profile);
    const goalDateDisplay = goalDateStr ? formatEntryDate(goalDateStr) : null;
    const avatarInitial = (profile.name || "?").charAt(0).toUpperCase();
    const sexDisplay = profile.sex === "female" ? "Female" : "Male";
    const heightDisplay = formatHeightValue(profile.heightCm, profile.units);
    const paceLabel = (() => {
      if (profile.goal === "maintain") return "Maintain";
      const lbPerWeek = kgToLb(profile.weeklyRateKg);
      const match = profilePaceOptions.find(
        (p) => p.goal === profile.goal && Math.abs(kgToLb(p.weeklyRateKg) - lbPerWeek) < 0.05
      );
      return match?.label ?? `Lose ${formatProfileNumber(lbPerWeek, 1)} lb/wk`;
    })();

    return (
      <main className="app">
        <div className="top-bar">
          <div>
            <h1>Profile</h1>
            <p className="week-range">Stored on this device</p>
          </div>
        </div>

        {profileSaveStatus && <p className="profile-toast">{profileSaveStatus}</p>}

        <section className="panel">
          <div className="pf-hero">
            <div className="pf-avatar" aria-hidden>{avatarInitial}</div>
            <div className="pf-id">
              <div className="pf-name">{profile.name || "Your Profile"}</div>
              <div className="pf-meta">{profile.age} · {sexDisplay} · {heightDisplay}</div>
            </div>
            <button
              type="button"
              className="pf-edit-btn"
              onClick={() => {
                setProfileForm(profileToForm(profile));
                setProfileWizardStep(0);
                setIsProfileWizardOpen(true);
                setProfileSaveStatus("");
              }}
            >
              Edit
            </button>
          </div>
        </section>

        <section className="panel">
          <p className="panel-eyebrow">Targets</p>
          <div className="pf-derived-grid">
            <div className="pf-derived">
              <div className="pf-stat-lbl">BMR</div>
              <div className="pf-stat-val">{bmr.toLocaleString()}<small>kcal</small></div>
            </div>
            <div className="pf-derived">
              <div className="pf-stat-lbl">TDEE</div>
              <div className="pf-stat-val">{tdee.toLocaleString()}<small>kcal</small></div>
            </div>
            <div className="pf-derived">
              <div className="pf-stat-lbl">Target</div>
              <div className="pf-stat-val">{activeCalories.toLocaleString()}<small>kcal</small></div>
            </div>
          </div>
          <div className="pf-macros-row">
            <div className="pf-macro" style={{ "--macro-c": "var(--macro-protein)" } as CSSProperties}>
              <div className="pf-stat-lbl">Protein</div>
              <div className="pf-macro-val">{savedProfileGoals.protein}<small>g</small></div>
            </div>
            <div className="pf-macro" style={{ "--macro-c": "var(--macro-carbs)" } as CSSProperties}>
              <div className="pf-stat-lbl">Carbs</div>
              <div className="pf-macro-val">{savedProfileGoals.carbs}<small>g</small></div>
            </div>
            <div className="pf-macro" style={{ "--macro-c": "var(--macro-fat)" } as CSSProperties}>
              <div className="pf-stat-lbl">Fat</div>
              <div className="pf-macro-val">{savedProfileGoals.fat}<small>g</small></div>
            </div>
          </div>
        </section>

        <section className="panel">
          <p className="panel-eyebrow">Body</p>
          <ul className="pf-kv-list">
            <li className="pf-kv">
              <span className="pf-k">Current weight</span>
              <span className="pf-v">{weightDisplay}</span>
            </li>
            {goalWeightDisplay && (
              <li className="pf-kv">
                <span className="pf-k">Goal weight</span>
                <span className="pf-v">{goalWeightDisplay}</span>
              </li>
            )}
            {goalDateDisplay && (
              <li className="pf-kv">
                <span className="pf-k">Est. goal date</span>
                <span className="pf-v">{goalDateDisplay}</span>
              </li>
            )}
            <li className="pf-kv">
              <span className="pf-k">Activity level</span>
              <span className="pf-v">{profileActivityLabels[toProfileActivityLevel(profile.activityLevel)].title}</span>
            </li>
          </ul>
        </section>

        <section className="panel">
          <p className="panel-eyebrow">Plan</p>
          <ul className="pf-kv-list">
            <li className="pf-kv">
              <span className="pf-k">Goal</span>
              <span className="pf-v">
                {profile.goal === "maintain" ? "Maintain" : profile.goal === "lose" ? "Lose" : "Gain"}
              </span>
            </li>
            <li className="pf-kv">
              <span className="pf-k">Pace</span>
              <span className="pf-v">{paceLabel}</span>
            </li>
          </ul>
        </section>

        <section className="panel">
          <p className="panel-eyebrow">Data</p>
          <ul className="pf-kv-list">
            <li
              className="pf-row"
              onClick={onOpenExport}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onOpenExport()}
            >
              <span>Export all data (JSON)</span>
              <span className="pf-chev">›</span>
            </li>
            <li
              className="pf-row"
              onClick={onOpenImport}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onOpenImport()}
            >
              <span>Import JSON</span>
              <span className="pf-chev">›</span>
            </li>
            <li
              className="pf-row"
              onClick={onConnectDrive}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onConnectDrive()}
            >
              <span>Connect Google Drive</span>
              <span className="pf-chev">›</span>
            </li>
            <li
              className="pf-row pf-row-danger"
              onClick={openDeleteModal}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openDeleteModal()}
            >
              <span>Delete all data</span>
              <span className="pf-chev">›</span>
            </li>
          </ul>
        </section>

        {isDeleteModalOpen && (
          <div className="modal-backdrop" role="dialog" aria-modal aria-labelledby="pf-dlg-title">
            <div className="modal pf-delete-modal">
              <div className="pf-dlg-body">
                <div className="pf-dlg-glyph" aria-hidden>!</div>
                <h2 id="pf-dlg-title">Delete all data?</h2>
                <p>This wipes everything Jessica has stored on this device. This cannot be undone.</p>
                {deleteStats && (
                  <div className="pf-dlg-summary">
                    <div><strong>{deleteStats.logDays}</strong> log days · <strong>{deleteStats.weightEntries}</strong> weight entries</div>
                    <div><strong>{deleteStats.customFoods}</strong> custom foods · <strong>{deleteStats.recipes}</strong> recipes</div>
                    <div>Profile, goals, streak history</div>
                  </div>
                )}
                <p className="pf-dlg-instruction">
                  Type <strong>DELETE</strong> to confirm.
                </p>
                <input
                  className="pf-dlg-input"
                  type="text"
                  placeholder="DELETE"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>
              <div className="pf-dlg-foot">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsDeleteModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={handleDeleteConfirm}
                  disabled={deleteConfirmText !== "DELETE"}
                >
                  Delete everything
                </button>
              </div>
            </div>
          </div>
        )}

        {bottomNav}
      </main>
    );
  }

  // ─── WIZARD VIEW ───────────────────────────────────────────────
  return (
    <main className="app">
      <div className="wz-topbar">
        <span className="wz-topbar-label">EDIT PROFILE WIZARD</span>
        <span className="wz-topbar-step">step {profileWizardStep + 1} of {profileWizardSteps.length} shown</span>
      </div>
      <div className="wz-header">
        <h1 className="wz-title">{isSetupMode ? "Set Up Profile" : "Edit Profile"}</h1>
        <span className="wz-step-badge">Step {profileWizardStep + 1} of {profileWizardSteps.length}</span>
      </div>

      {profileSaveStatus && <p className="profile-toast">{profileSaveStatus}</p>}

      <div className="wz-progress-bars" aria-label="Profile setup progress">
        {profileWizardSteps.map((step, index) => (
          <span
            key={step}
            className={`wz-bar${index < profileWizardStep ? " wz-bar-done" : index === profileWizardStep ? " wz-bar-cur" : ""}`}
          />
        ))}
      </div>
      <div className="wz-section-meta">
        <span className="wz-section-name">
          {currentStepName}{stepSubtitles[profileWizardStep] ? ` · ${stepSubtitles[profileWizardStep]}` : ""}
        </span>
        {profileWizardStep === 3 && (
          <button type="button" className="wz-skip-btn" onClick={() => moveProfileStep(1)}>
            Skip
          </button>
        )}
      </div>

      {/* Step 0: Basics */}
      {profileWizardStep === 0 && (
        <section className="panel">
          <div className="wizard-card profile-form-grid">
            <label>
              Display Name
              <input
                type="text"
                maxLength={40}
                value={profileForm.name}
                onChange={(e) => updateProfileForm({ name: e.target.value })}
                placeholder="Optional"
              />
              {profileErrors.name && <span className="profile-field-error">{profileErrors.name}</span>}
            </label>

            <label>
              Age
              <input
                type="number"
                min="13"
                max="100"
                step="1"
                value={profileForm.age}
                onChange={(e) => updateProfileForm({ age: e.target.value })}
              />
              {profileErrors.age && <span className="profile-field-error">{profileErrors.age}</span>}
            </label>

            <div className="profile-field">
              <span>Biological Sex</span>
              <div className="segmented-control">
                {(["female", "male"] as Sex[]).map((sex) => (
                  <button
                    key={sex}
                    type="button"
                    className={profileForm.sex === sex ? "selected" : ""}
                    onClick={() => updateProfileForm({ sex })}
                  >
                    {sex === "female" ? "Female" : "Male"}
                  </button>
                ))}
              </div>
            </div>

            <div className="profile-field">
              <span>Units</span>
              <div className="segmented-control">
                {(["imperial", "metric"] as ProfileUnits[]).map((units) => (
                  <button
                    key={units}
                    type="button"
                    className={profileForm.units === units ? "selected" : ""}
                    onClick={() => updateProfileForm({ units })}
                  >
                    {units === "imperial" ? "Imperial" : "Metric"}
                  </button>
                ))}
              </div>
            </div>

            <label>
              Height
              {profileForm.units === "metric" ? (
                <div className="goals-input-row">
                  <input
                    type="number"
                    min="100"
                    max="250"
                    step="0.1"
                    value={profileForm.heightCm}
                    onChange={(e) => updateProfileForm({ heightCm: e.target.value })}
                  />
                  <span>cm</span>
                </div>
              ) : (
                <div className="height-input-row">
                  <input
                    aria-label="Height feet"
                    type="number"
                    min="3"
                    max="8"
                    step="1"
                    value={profileForm.heightFeet}
                    onChange={(e) => updateProfileForm({ heightFeet: e.target.value })}
                  />
                  <input
                    aria-label="Height inches"
                    type="number"
                    min="0"
                    max="11"
                    step="0.1"
                    value={profileForm.heightInches}
                    onChange={(e) => updateProfileForm({ heightInches: e.target.value })}
                  />
                  <span>ft / in</span>
                </div>
              )}
              {profileErrors.height && <span className="profile-field-error">{profileErrors.height}</span>}
            </label>
          </div>
        </section>
      )}

      {/* Step 1: Body */}
      {profileWizardStep === 1 && (
        <section className="panel">
          <div className="wizard-card profile-form-grid">
            <label>
              Current Weight
              <div className="goals-input-row">
                <input
                  type="number"
                  min={profileForm.units === "metric" ? "30" : "66"}
                  max={profileForm.units === "metric" ? "300" : "661"}
                  step="0.1"
                  value={profileForm.weight}
                  onChange={(e) => updateProfileForm({ weight: e.target.value })}
                />
                <span>{profileForm.units === "metric" ? "kg" : "lb"}</span>
              </div>
              {profileErrors.weight && <span className="profile-field-error">{profileErrors.weight}</span>}
            </label>
          </div>
        </section>
      )}

      {/* Step 2: Activity */}
      {profileWizardStep === 2 && (
        <section className="panel">
          <div className="wizard-card">
            <p className="wizard-hint">How active are you on a typical week?</p>
            <div className="profile-option-grid">
              {profileActivityOptions.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`option-card profile-option${profileForm.activityLevel === level ? " selected" : ""}`}
                  onClick={() => updateProfileForm({ activityLevel: level })}
                >
                  <strong>{profileActivityLabels[level].title}</strong>
                  <span>{profileActivityLabels[level].detail}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Step 3: Plan */}
      {profileWizardStep === 3 && (
        <>
          <section className="panel">
            <p className="wz-card-title">Set your weight goal</p>

            <div className="wz-field-block">
              <p className="wz-field-lbl">Goal</p>
              <div className="wz-3btn">
                {goalOptions.map(({ goal, label, sub }) => (
                  <button
                    key={goal}
                    type="button"
                    className={`wz-3btn-item${profileForm.goal === goal ? " selected" : ""}`}
                    onClick={() => updateProfileForm({ goal })}
                  >
                    <span className="wz-3btn-main">{label}</span>
                    <span className="wz-3btn-sub">{sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {profileForm.goal !== "maintain" && (
              <div className="wz-field-block">
                <p className="wz-field-lbl">Desired pace</p>
                <div className="wz-3btn">
                  {wizardPaceOptions.map(({ key, label, sub, kg }) => (
                    <button
                      key={key}
                      type="button"
                      className={`wz-3btn-item${Math.abs(Number(profileForm.weeklyRateKg) - kg) < 0.01 ? " selected" : ""}`}
                      onClick={() => updateProfileForm({ weeklyRateKg: String(kg) })}
                    >
                      <span className="wz-3btn-main">{label}</span>
                      <span className="wz-3btn-sub">{profileForm.goal === "gain" ? "+" : "-"}{sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="wz-field-block">
              <label>
                <span className="wz-field-lbl">Goal weight</span>
                <div className="goals-input-row">
                  <input
                    type="number"
                    min={profileForm.units === "metric" ? "30" : "66"}
                    max={profileForm.units === "metric" ? "300" : "661"}
                    step="0.1"
                    value={profileForm.goalWeight}
                    onChange={(e) => updateProfileForm({ goalWeight: e.target.value })}
                  />
                  <span>{profileForm.units === "metric" ? "kg" : "lb"}</span>
                </div>
                {profileErrors.goalWeight && <span className="profile-field-error">{profileErrors.goalWeight}</span>}
              </label>
            </div>

            <div className="wz-field-block">
              <p className="wz-field-lbl">Estimated goal date</p>
              <input
                type="text"
                readOnly
                className="wz-readonly-input"
                value={planGoalDate ? formatEntryDate(planGoalDate) : "—"}
              />
            </div>
          </section>

          <section className="panel">
            <p className="wz-card-title">Live calculation</p>
            {profileCalculation ? (
              <div className="wz-live-grid">
                <div className="wz-live-tile">
                  <div className="wz-live-label">BMR</div>
                  <div className="wz-live-val">{profileCalculation.bmr.toLocaleString()}<small>kcal</small></div>
                </div>
                <div className="wz-live-tile">
                  <div className="wz-live-label">TDEE</div>
                  <div className="wz-live-val">{profileCalculation.tdee.toLocaleString()}<small>kcal</small></div>
                </div>
                <div className="wz-live-tile wz-live-accent">
                  <div className="wz-live-label">Recommended target</div>
                  <div className="wz-live-val">{profileCalculation.activeCalories.toLocaleString()}<small>kcal/day</small></div>
                </div>
                <div className="wz-live-tile">
                  <div className="wz-live-label">Protein</div>
                  <div className="wz-live-val">{proteinG}<small>g</small></div>
                </div>
                <div className="wz-live-tile">
                  <div className="wz-live-label">Carbs</div>
                  <div className="wz-live-val">{carbsG}<small>g</small></div>
                </div>
                <div className="wz-live-tile wz-live-fat">
                  <div className="wz-live-label">Fat</div>
                  <div className="wz-live-val">{fatG}<small>g</small></div>
                </div>
              </div>
            ) : (
              <p className="wz-live-empty">Complete earlier steps to see your targets.</p>
            )}
            {profileLowCalorieWarning && <p className="profile-warning">{profileLowCalorieWarning}</p>}
          </section>
        </>
      )}

      {/* Step 4: Macros */}
      {profileWizardStep === 4 && (
        <section className="panel">
          <div className="wizard-card profile-macro-section">
            <div className="profile-option-grid">
              {macroPresetOptions.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`option-card profile-option${profileForm.macroPreset === preset ? " selected" : ""}`}
                  onClick={() => updateProfileForm({ macroPreset: preset })}
                >
                  <strong>
                    {preset === "custom" ? "Custom" : macroPresets[preset].label}
                  </strong>
                  <span>
                    {preset === "balanced"
                      ? "30% protein, 40% carbs, 30% fat."
                      : preset === "high_protein"
                        ? "40% protein, 30% carbs, 30% fat."
                        : "Set your own macro percentages."}
                  </span>
                </button>
              ))}
            </div>

            {profileForm.macroPreset === "custom" && (
              <div className="profile-form-grid three">
                {[
                  ["proteinPct", "Protein %"],
                  ["carbPct", "Carbs %"],
                  ["fatPct", "Fat %"],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={profileForm[key as "proteinPct" | "carbPct" | "fatPct"]}
                      onChange={(e) =>
                        updateProfileForm({ [key]: e.target.value } as Partial<ProfileForm>)
                      }
                    />
                  </label>
                ))}
              </div>
            )}

            {profileCalculation && profileForm.macroMode === "percentages" && (
              <p className="profile-macro-total">
                Targets: {proteinG}g protein / {carbsG}g carbs / {fatG}g fat
              </p>
            )}

            {profileErrors.macros && <p className="profile-warning">{profileErrors.macros}</p>}
          </div>
        </section>
      )}

      <div className="wz-footer">
        {(profileWizardStep > 0 || !isSetupMode) && (
          <button
            type="button"
            className="wz-back-btn"
            onClick={profileWizardStep > 0 ? () => moveProfileStep(-1) : cancelProfileChanges}
          >
            {profileWizardStep > 0 ? "Back" : "Cancel"}
          </button>
        )}
        {profileWizardStep < profileWizardSteps.length - 1 ? (
          <button
            type="button"
            className="wz-next-btn"
            onClick={() => moveProfileStep(1)}
            disabled={!canMoveNext}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            className="wz-next-btn"
            onClick={handleProfileSave}
            disabled={profileHasBlockingErrors}
          >
            {saveButtonLabel}
          </button>
        )}
      </div>

      {bottomNav}
    </main>
  );
}
