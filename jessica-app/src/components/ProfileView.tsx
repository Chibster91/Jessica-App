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
  shiftDate,
  toProfileActivityLevel,
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
  if (profile.goal !== "lose" || profile.weeklyRateKg <= 0 || !profile.goalWeightKg) return null;
  if (profile.weightKg <= profile.goalWeightKg) return null;
  const weeksNeeded = (profile.weightKg - profile.goalWeightKg) / profile.weeklyRateKg;
  return shiftDate(getLocalDateString(), Math.ceil(weeksNeeded * 7));
}

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
  const selectedPace = profilePaceOptions.find(
    (pace) => pace.goal === profileForm.goal && Math.abs(pace.weeklyRateKg - Number(profileForm.weeklyRateKg || 0)) < 0.001
  ) ?? profilePaceOptions[0];
  const macroPresetOptions: MacroPreset[] = ["balanced", "high_protein", "custom"];
  const requiredStepError =
    profileWizardStep === 0
      ? profileErrors.age || profileErrors.height
      : profileWizardStep === 1
        ? profileErrors.weight || profileErrors.goalWeight
        : profileWizardStep === 5
          ? profileErrors.macros
          : "";
  const canMoveNext =
    !requiredStepError &&
    (profileWizardStep !== 4 || Boolean(profileCalculation)) &&
    (profileWizardStep !== 5 || !profileHasBlockingErrors);
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
      <div className="top-bar">
        <div>
          <h1>{isSetupMode ? "Set Up Profile" : "Edit Profile"}</h1>
          <p className="week-range">Step {profileWizardStep + 1} of {profileWizardSteps.length}</p>
        </div>
        {!isSetupMode && (
          <button
            type="button"
            className="wizard-close"
            onClick={cancelProfileChanges}
            aria-label="Close profile wizard"
          >
            ×
          </button>
        )}
      </div>

      {profileSaveStatus && <p className="profile-toast">{profileSaveStatus}</p>}

      <section className="panel profile-card profile-wizard-card calculator-wizard">
        <div className="wz-progress-bars" aria-label="Profile setup progress">
          {profileWizardSteps.map((step, index) => (
            <span
              key={step}
              className={`wz-bar${index < profileWizardStep ? " wz-bar-done" : index === profileWizardStep ? " wz-bar-cur" : ""}`}
            />
          ))}
        </div>
        <p className="wz-step-meta"><strong>{currentStepName}</strong></p>

        {profileWizardStep === 0 && (
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
        )}

        {profileWizardStep === 1 && (
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

            <label>
              Goal Weight
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
        )}

        {profileWizardStep === 2 && (
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
        )}

        {profileWizardStep === 3 && (
          <div className="wizard-card">
            <p className="wizard-hint">Choose the pace you want the calorie target to support.</p>
            <div className="profile-option-grid pace-grid">
              {profilePaceOptions.map((pace) => (
                <button
                  key={pace.label}
                  type="button"
                  className={`option-card profile-option${selectedPace.label === pace.label ? " selected" : ""}`}
                  onClick={() =>
                    updateProfileForm({
                      goal: pace.goal,
                      weeklyRateKg: pace.weeklyRateKg === 0 ? "0.5" : String(pace.weeklyRateKg),
                    })
                  }
                >
                  <strong>{pace.label}</strong>
                  <span>
                    {pace.goal === "maintain"
                      ? "Keep calories near your TDEE."
                      : `${Math.round(pace.weeklyRateKg * 1100)} kcal/day estimated deficit.`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {profileWizardStep === 4 && (
          <div className="wizard-card">
            <div className="profile-summary-card">
              {profileCalculation ? (
                <>
                  <div>
                    <span>BMR Formula</span>
                    <strong>Mifflin-St Jeor</strong>
                    <small>
                      10 x weight + 6.25 x height - 5 x age {profileForm.sex === "female" ? "- 161" : "+ 5"}
                    </small>
                  </div>
                  <div>
                    <span>Activity Multiplier</span>
                    <strong>{profileActivityMultipliers[profileForm.activityLevel]}</strong>
                    <small>{profileActivityLabels[profileForm.activityLevel].title}</small>
                  </div>
                  <div>
                    <span>BMR</span>
                    <strong>{profileCalculation.bmr} kcal</strong>
                  </div>
                  <div>
                    <span>TDEE</span>
                    <strong>{profileCalculation.tdee} kcal</strong>
                  </div>
                  <div>
                    <span>Deficit / Surplus</span>
                    <strong>{profileCalculation.goalAdjustment > 0 ? "+" : ""}{profileCalculation.goalAdjustment} kcal</strong>
                  </div>
                  <div className="profile-target">
                    <span>Final calorie target</span>
                    <strong>{profileCalculation.activeCalories} kcal/day</strong>
                  </div>
                </>
              ) : (
                <div className="profile-target">
                  <span>Math Preview</span>
                  <strong>Complete previous steps</strong>
                </div>
              )}
            </div>
            {profileLowCalorieWarning && <p className="profile-warning">{profileLowCalorieWarning}</p>}
          </div>
        )}

        {profileWizardStep === 5 && (
          <div className="wizard-card profile-macro-section">
            <div className="profile-option-grid pace-grid">
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
                Targets: {Math.round((profileCalculation.activeCalories * Number(profileForm.proteinPct)) / 100 / 4)}g protein /{" "}
                {Math.round((profileCalculation.activeCalories * Number(profileForm.carbPct)) / 100 / 4)}g carbs /{" "}
                {Math.round((profileCalculation.activeCalories * Number(profileForm.fatPct)) / 100 / 9)}g fat
              </p>
            )}

            {profileErrors.macros && <p className="profile-warning">{profileErrors.macros}</p>}
          </div>
        )}

        {profileCalculation && profileWizardStep !== 4 && (
          <div className="calculator-estimate">
            <span>Estimated target</span>
            <strong>{profileCalculation.activeCalories} cal/day</strong>
            <small>
              {Math.round((profileCalculation.activeCalories * Number(profileForm.proteinPct)) / 100 / 4)}g P /{" "}
              {Math.round((profileCalculation.activeCalories * Number(profileForm.carbPct)) / 100 / 4)}g C /{" "}
              {Math.round((profileCalculation.activeCalories * Number(profileForm.fatPct)) / 100 / 9)}g F
            </small>
          </div>
        )}
      </section>

      <section className="profile-save-bar wizard-nav">
        {profileWizardStep > 0 && (
          <button type="button" className="secondary-button" onClick={() => moveProfileStep(-1)}>
            Back
          </button>
        )}
        {!isSetupMode && profileWizardStep === 0 && (
          <button type="button" className="secondary-button" onClick={cancelProfileChanges}>
            Cancel
          </button>
        )}
        {profileWizardStep < profileWizardSteps.length - 1 ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => moveProfileStep(1)}
            disabled={!canMoveNext}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            className="primary-button"
            onClick={handleProfileSave}
            disabled={profileHasBlockingErrors}
          >
            {saveButtonLabel}
          </button>
        )}
      </section>

      {bottomNav}
    </main>
  );
}
