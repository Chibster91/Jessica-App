import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import "../styles/profile.css";
import { loadCycleData, saveCycleData } from "../cycleStorage";
import { Sheet } from "./Overlays";
import {
  formatEntryDate,
  formatProfileNumber,
  formatWeightValue,
  getLocalDateString,
  getSavedCustomFoods,
  getSavedRecipes,
  getSavedWeightEntries,
  kgToLb,
  lbToKg,
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
  type EnergyUnit,
  type GoalType,
  type MacroPreset,
  type Profile,
  type ProfileActivityLevel,
  type ProfileCalculation,
  type ProfileForm,
  type Sex,
  type WeightUnit
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
  themeMode: ThemeMode;
  setThemeMode: Dispatch<SetStateAction<ThemeMode>>;
  setCycleTrackingPreference: (trackCycle: boolean) => void;
  cancelProfileChanges: () => void;
  saveProfile: () => void;
  patchProfile: (patch: Partial<Profile>) => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onConnectDrive: () => void;
  onDeleteAllData: () => void;
};

type ThemeMode = "dark" | "light" | "system";

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
  0: "Name, age, height & weight",
  1: "Activity level",
  2: "Goal & pace",
  3: "Macro targets",
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

// ── ft/in helpers ─────────────────────────────────────────────
function cmToFtIn(cm: number) {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const ins = Math.round(totalIn % 12);
  return { ft, ins };
}
function ftInToCm(ft: number, ins: number) { return (ft * 12 + ins) * 2.54; }

// ── Shared micro-components ───────────────────────────────────
function Row({ label, value, sub, accent, onEdit }: { label: string; value?: string; sub?: string; accent?: boolean; onEdit?: () => void }) {
  const El = onEdit ? "button" : "div";
  return (
    <El className={`kit-prof-row${onEdit ? " kit-prof-row--tap" : ""}`} onClick={onEdit} type={onEdit ? "button" : undefined}>
      <span className="kit-prof-row__label">{label}</span>
      <span className="kit-prof-row__right">
        <span className={`kit-prof-row__val${accent ? " kit-prof-row__val--accent" : ""}`}>{value}</span>
        {sub && <span className="kit-prof-row__sub">{sub}</span>}
        {onEdit && <span className="kit-prof-row__chev">›</span>}
      </span>
    </El>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="kit-prof-group">
      <div className="kit-prof-section">{title}</div>
      <div className="kit-prof-card">{children}</div>
    </div>
  );
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="kit-prof-row kit-prof-row--tap kit-prof-row--control" type="button" onClick={() => onChange(!checked)}>
      <span className="kit-prof-row__label">{label}</span>
      <span className={`kit-toggle${checked ? " is-on" : ""}`}><span className="kit-toggle__thumb" /></span>
    </button>
  );
}

function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div className="kit-seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" className={`kit-seg__btn${value === o.value ? " is-on" : ""}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ControlRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="kit-prof-row kit-prof-row--control">
      <span className="kit-prof-row__label">{label}</span>
      {children}
    </div>
  );
}

function NumStepper({ value, onChange, unit, min = 1, max = 120 }: { value: number; onChange: (n: number) => void; unit?: string; min?: number; max?: number }) {
  const bump = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  return (
    <div className="kit-weighin">
      <button className="kit-weighin__step" type="button" onClick={() => bump(-1)}>−</button>
      <div className="kit-weighin__val"><strong>{value}</strong>{unit && <span>{unit}</span>}</div>
      <button className="kit-weighin__step" type="button" onClick={() => bump(1)}>＋</button>
    </div>
  );
}

function WtStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [raw, setRaw] = useState(value.toFixed(1));
  const bump = (d: number) => {
    const next = Math.round((value + d) * 10) / 10;
    onChange(next);
    setRaw(next.toFixed(1));
  };
  const commit = () => {
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) {
      const clamped = Math.round(Math.min(999, Math.max(1, n)) * 10) / 10;
      onChange(clamped);
      setRaw(clamped.toFixed(1));
    } else setRaw(value.toFixed(1));
  };
  return (
    <div className="kit-weighin">
      <button className="kit-weighin__step" type="button" onClick={() => bump(-0.2)}>−</button>
      <div className="kit-weighin__val">
        <input className="kit-weighin__input" type="text" inputMode="decimal"
          value={raw} onChange={(e) => setRaw(e.target.value)}
          onFocus={(e) => e.target.select()} onBlur={commit} />
        <span>lb</span>
      </div>
      <button className="kit-weighin__step" type="button" onClick={() => bump(0.2)}>＋</button>
    </div>
  );
}

function OptionList({ options, value, onChange }: { options: Array<{ value: string; label: string; desc?: string }>; value: string; onChange: (v: string) => void }) {
  return (
    <div className="kit-prof-optlist">
      {options.map((o) => (
        <button key={o.value} type="button" className={`kit-prof-opt${value === o.value ? " is-on" : ""}`} onClick={() => onChange(o.value)}>
          <div className="kit-prof-opt__main">
            <span className="kit-prof-opt__label">{o.label}</span>
            {o.desc && <span className="kit-prof-opt__desc">{o.desc}</span>}
          </div>
          {value === o.value && <span className="kit-prof-opt__check">✓</span>}
        </button>
      ))}
    </div>
  );
}

const activityOpts = profileActivityOptions.map((level) => ({
  value: level,
  label: profileActivityLabels[level].title,
  desc: profileActivityLabels[level].detail,
}));

// ── Edit sheets ───────────────────────────────────────────────
type EditSheetProps = { profile: Profile; patchProfile: (patch: Partial<Profile>) => void; onClose: () => void };

function EditName({ profile, patchProfile, onClose }: EditSheetProps) {
  const [name, setName] = useState(profile.name);
  return (
    <Sheet title="Edit name" onClose={onClose}
      footer={<button className="kit-btn kit-btn--primary" style={{ width: "100%" }} type="button"
        onClick={() => { patchProfile({ name: name.trim() || profile.name }); onClose(); }}>Save</button>}>
      <div className="kit-prof-input-wrap">
        <div className="kit-field__label">Display name</div>
        <input className="kit-qty__input" style={{ width: "100%", boxSizing: "border-box", textAlign: "left" }}
          value={name} onChange={(e) => setName(e.target.value)} />
      </div>
    </Sheet>
  );
}

function EditPersonal({ profile, patchProfile, onClose }: EditSheetProps) {
  const [age, setAge] = useState(profile.age);
  const [sex, setSex] = useState<Sex>(profile.sex);
  return (
    <Sheet title="Personal info" onClose={onClose}
      footer={<button className="kit-btn kit-btn--primary" style={{ width: "100%" }} type="button"
        onClick={() => { patchProfile({ age, sex }); onClose(); }}>Save</button>}>
      <div className="kit-prof-input-wrap">
        <div className="kit-field__label">Age</div>
        <NumStepper value={age} onChange={setAge} unit="yrs" min={13} max={99} />
      </div>
      <div className="kit-prof-input-wrap">
        <div className="kit-field__label">Biological sex</div>
        <OptionList options={[{ value: "female", label: "Female" }, { value: "male", label: "Male" }]} value={sex} onChange={(v) => setSex(v as Sex)} />
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0 }}>Used only for BMR calculation.</p>
      </div>
    </Sheet>
  );
}

function EditHeight({ profile, patchProfile, onClose }: EditSheetProps) {
  const { ft: initFt, ins: initIns } = cmToFtIn(profile.heightCm);
  const [ft, setFt] = useState(initFt);
  const [ins, setIns] = useState(initIns);
  const cm = Math.round(ftInToCm(ft, ins));
  return (
    <Sheet title="Height" onClose={onClose}
      footer={<button className="kit-btn kit-btn--primary" style={{ width: "100%" }} type="button"
        onClick={() => { patchProfile({ heightCm: ftInToCm(ft, ins) }); onClose(); }}>Save</button>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div className="kit-prof-input-wrap">
          <div className="kit-field__label">Feet</div>
          <NumStepper value={ft} onChange={setFt} unit="ft" min={3} max={8} />
        </div>
        <div className="kit-prof-input-wrap">
          <div className="kit-field__label">Inches</div>
          <NumStepper value={ins} onChange={setIns} unit="in" min={0} max={11} />
        </div>
      </div>
      <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>{cm} cm</p>
    </Sheet>
  );
}

function EditCycle({ onClose }: { onClose: () => void }) {
  const initial = loadCycleData();
  const [cycleLength, setCycleLength] = useState(initial.cycleLengthFallback);
  const [periodLength, setPeriodLength] = useState(initial.periodLengthFallback);
  const [trackFertile, setTrackFertile] = useState(initial.trackFertile);
  return (
    <Sheet title="Cycle" onClose={onClose}
      footer={<button className="kit-btn kit-btn--primary" style={{ width: "100%" }} type="button"
        onClick={() => { saveCycleData({ ...loadCycleData(), cycleLengthFallback: cycleLength, periodLengthFallback: periodLength, trackFertile }); onClose(); }}>Save</button>}>
      <div className="kit-prof-input-wrap">
        <div className="kit-field__label">Average cycle length</div>
        <NumStepper value={cycleLength} onChange={setCycleLength} unit="days" min={15} max={60} />
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.45 }}>
          The textbook cycle is 28 days — a starting point only. FoodVault re-learns your real average as you log, so predictions get sharper over time.
        </p>
      </div>
      <div className="kit-prof-input-wrap">
        <div className="kit-field__label">Average period length</div>
        <NumStepper value={periodLength} onChange={setPeriodLength} unit="days" min={1} max={14} />
      </div>
      <SwitchRow label="Show fertile window & ovulation" checked={trackFertile} onChange={setTrackFertile} />
    </Sheet>
  );
}

function EditCurrentWeight({ profile, patchProfile, onClose }: EditSheetProps) {
  const [w, setW] = useState(parseFloat(kgToLb(profile.weightKg).toFixed(1)));
  return (
    <Sheet title="Start weight" onClose={onClose}
      footer={<button className="kit-btn kit-btn--primary" style={{ width: "100%" }} type="button"
        onClick={() => { patchProfile({ weightKg: lbToKg(w) }); onClose(); }}>Save</button>}>
      <WtStepper value={w} onChange={setW} />
    </Sheet>
  );
}

function EditGoalWeight({ profile, patchProfile, onClose }: EditSheetProps) {
  const [w, setW] = useState(parseFloat(kgToLb(profile.goalWeightKg ?? profile.weightKg).toFixed(1)));
  return (
    <Sheet title="Goal weight" onClose={onClose}
      footer={<button className="kit-btn kit-btn--primary" style={{ width: "100%" }} type="button"
        onClick={() => { patchProfile({ goalWeightKg: lbToKg(w) }); onClose(); }}>Save</button>}>
      <WtStepper value={w} onChange={setW} />
    </Sheet>
  );
}

function EditActivity({ profile, patchProfile, onClose }: EditSheetProps) {
  const [level, setLevel] = useState<ProfileActivityLevel>(toProfileActivityLevel(profile.activityLevel));
  return (
    <Sheet title="Activity level" onClose={onClose}
      footer={<button className="kit-btn kit-btn--primary" style={{ width: "100%" }} type="button"
        onClick={() => { patchProfile({ activityLevel: level }); onClose(); }}>Save</button>}>
      <OptionList options={activityOpts} value={level} onChange={(v) => setLevel(v as ProfileActivityLevel)} />
    </Sheet>
  );
}

function EditGoal({ profile, patchProfile, onClose }: EditSheetProps) {
  const [goalType, setGoalType] = useState<GoalType>(profile.goal);
  const [rateKg, setRateKg] = useState(profile.weeklyRateKg);
  const rateOpts = goalType === "gain"
    ? [0.25, 0.5, 0.75, 1].map((lb) => ({ value: lb / poundsPerKilogram, label: `+${lb} lb/wk` }))
    : [0.5, 1, 1.5, 2].map((lb) => ({ value: lb / poundsPerKilogram, label: `−${lb} lb/wk` }));
  return (
    <Sheet title="Goal" onClose={onClose}
      footer={<button className="kit-btn kit-btn--primary" style={{ width: "100%" }} type="button"
        onClick={() => { patchProfile({ goal: goalType, weeklyRateKg: goalType === "maintain" ? 0 : rateKg }); onClose(); }}>Save</button>}>
      <div className="kit-prof-input-wrap">
        <div className="kit-field__label">Goal type</div>
        <OptionList
          options={[{ value: "lose", label: "Lose weight" }, { value: "maintain", label: "Maintain weight" }, { value: "gain", label: "Gain weight" }]}
          value={goalType}
          onChange={(v) => { setGoalType(v as GoalType); setRateKg(v === "gain" ? 0.5 / poundsPerKilogram : v === "maintain" ? 0 : 1 / poundsPerKilogram); }} />
      </div>
      {goalType !== "maintain" && (
        <div className="kit-prof-input-wrap">
          <div className="kit-field__label">Weekly rate</div>
          <div className="kit-chiprow kit-chiprow--wrap">
            {rateOpts.map((o) => (
              <button key={o.value} type="button"
                className={`kit-pick${Math.abs(rateKg - o.value) < 0.001 ? " is-on" : ""}`}
                onClick={() => setRateKg(o.value)}>{o.label}</button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function EditCalories({ profile, patchProfile, onClose }: EditSheetProps) {
  const activeCalories = profile.useManualCalories && profile.manualCalorieOverride
    ? profile.manualCalorieOverride
    : profile.calculatedCalories;
  const tdee = computeTdee(profile);
  const [manual, setManual] = useState(profile.useManualCalories);
  const [val, setVal] = useState(String(profile.manualCalorieOverride ?? activeCalories));
  const deficitLabel = profile.goal === "maintain" ? ""
    : profile.goal === "gain" ? ` + ${Math.round(kgToLb(profile.weeklyRateKg) * 500)} cal surplus`
    : ` − ${Math.round(kgToLb(profile.weeklyRateKg) * 500)} cal deficit`;
  return (
    <Sheet title="Calorie target" onClose={onClose}
      footer={<button className="kit-btn kit-btn--primary" style={{ width: "100%" }} type="button"
        onClick={() => { patchProfile({ useManualCalories: manual, manualCalorieOverride: manual ? (parseInt(val) || null) : null }); onClose(); }}>Save</button>}>
      <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "0.8rem 0.9rem" }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Auto-calculated</div>
        <div style={{ fontSize: "1.8rem", fontWeight: 800, lineHeight: 1 }}>
          {profile.calculatedCalories.toLocaleString()}
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 700, marginLeft: "0.3rem" }}>cal/day</span>
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4 }}>
          TDEE {tdee.toLocaleString()}{deficitLabel}
        </div>
      </div>
      <SwitchRow label="Override manually" checked={manual} onChange={setManual} />
      {manual && (
        <div className="kit-prof-input-wrap">
          <div className="kit-field__label">Daily calorie target</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <input className="kit-qty__input" style={{ width: 120, textAlign: "right" }}
              type="text" inputMode="numeric"
              value={val} onChange={(e) => setVal(e.target.value.replace(/\D/g, ""))} />
            <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>cal</span>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function EditMacros({ profile, patchProfile, onClose }: EditSheetProps) {
  const savedProfileGoals = profileToGoals(profile);
  const pr0 = savedProfileGoals.protein, ca0 = savedProfileGoals.carbs, fa0 = savedProfileGoals.fat;
  const wasManual = profile.macroMode === "grams" && (profile.macros.proteinGrams !== undefined);
  const [manual, setManual] = useState(wasManual);
  const [pr, setPr] = useState(String(profile.macros.proteinGrams ?? pr0));
  const [ca, setCa] = useState(String(profile.macros.carbGrams ?? ca0));
  const [fa, setFa] = useState(String(profile.macros.fatGrams ?? fa0));
  const total = (parseInt(pr) || 0) * 4 + (parseInt(ca) || 0) * 4 + (parseInt(fa) || 0) * 9;
  const reset = () => { setPr(String(pr0)); setCa(String(ca0)); setFa(String(fa0)); };
  return (
    <Sheet title="Macro targets" onClose={onClose}
      footer={<button className="kit-btn kit-btn--primary" style={{ width: "100%" }} type="button"
        onClick={() => {
          patchProfile({
            macroMode: manual ? "grams" : "percentages",
            macros: {
              ...profile.macros,
              ...(manual ? { proteinGrams: parseInt(pr) || 0, carbGrams: parseInt(ca) || 0, fatGrams: parseInt(fa) || 0 } : {}),
            },
          });
          onClose();
        }}>Save</button>}>
      <SwitchRow label="Set manually (grams)" checked={manual} onChange={(v) => { setManual(v); if (!v) reset(); }} />
      <div style={{ display: "grid", gap: "0.65rem" }}>
        {([["Protein", "var(--macro-protein)", pr, setPr], ["Carbs", "var(--macro-carbs)", ca, setCa], ["Fat", "var(--macro-fat)", fa, setFa]] as const).map(([lbl, color, val, set]) => (
          <div key={lbl} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ width: 52, fontSize: "0.8rem", fontWeight: 800, color, flexShrink: 0 }}>{lbl}</span>
            <input className="kit-qty__input" style={{ flex: 1, textAlign: "right", opacity: manual ? 1 : 0.45 }}
              disabled={!manual} type="text" inputMode="numeric"
              value={val} onChange={(e) => (set as (v: string) => void)(e.target.value.replace(/\D/g, ""))} />
            <span style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "0.82rem", width: 16 }}>g</span>
          </div>
        ))}
      </div>
      {manual && <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0, textAlign: "center" }}>≈ {total.toLocaleString()} cal total</p>}
    </Sheet>
  );
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
  themeMode,
  setThemeMode,
  setCycleTrackingPreference,
  cancelProfileChanges,
  saveProfile,
  patchProfile,
  onOpenExport,
  onOpenImport,
  onConnectDrive,
  onDeleteAllData,
}: ProfileViewProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteStats, setDeleteStats] = useState<DeleteStats | null>(null);
  const [isManualCalorieEditorOpen, setIsManualCalorieEditorOpen] = useState(false);
  const [manualCalorieDraft, setManualCalorieDraft] = useState("");
  const [manualCalorieDraftError, setManualCalorieDraftError] = useState("");
  const [profileTab, setProfileTab] = useState<"info" | "settings">("info");
  const [editing, setEditing] = useState<string | null>(null);
  const [infoSheet, setInfoSheet] = useState<"privacy" | "help" | null>(null);

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
      ? profileErrors.age || profileErrors.height || profileErrors.weight
      : profileWizardStep === 2
        ? profileErrors.goalWeight
        : profileWizardStep === 3
          ? profileErrors.macros
          : "";
  const canMoveNext =
    !requiredStepError &&
    (profileWizardStep !== 3 || !profileHasBlockingErrors);
  const planGoalDate = (() => {
    if (profileForm.goal === "maintain") return null;
    const wKg = Number(profileForm.weight) / poundsPerKilogram;
    const gKg = Number(profileForm.goalWeight) / poundsPerKilogram;
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
  const openManualCalorieEditor = () => {
    setManualCalorieDraft(
      profileForm.manualCalorieOverride ||
      (profileCalculation ? String(profileCalculation.calculatedCalories) : "")
    );
    setManualCalorieDraftError("");
    setIsManualCalorieEditorOpen(true);
  };
  const applyManualCalorieGoal = () => {
    const calories = Number(manualCalorieDraft);
    if (!Number.isFinite(calories) || calories <= 0) {
      setManualCalorieDraftError("Enter a calorie goal above 0.");
      return;
    }

    updateProfileForm({
      useManualCalories: true,
      manualCalorieOverride: String(Math.round(calories)),
    });
    setManualCalorieDraft(String(Math.round(calories)));
    setManualCalorieDraftError("");
    setIsManualCalorieEditorOpen(false);
  };
  const revertManualCalorieGoal = () => {
    updateProfileForm({ useManualCalories: false, manualCalorieOverride: "" });
    setManualCalorieDraft(profileCalculation ? String(profileCalculation.calculatedCalories) : "");
    setManualCalorieDraftError("");
    setIsManualCalorieEditorOpen(false);
  };

  // ─── READ-ONLY VIEW ────────────────────────────────────────────
  if (profile && !isProfileWizardOpen) {
    const savedProfileGoals = profileToGoals(profile);
    const displayUnit = profile.units === "metric" ? "kg" : "lb";
    const weightLb = kgToLb(profile.weightKg);
    const weightDisplay = formatWeightValue(
      profile.units === "metric" ? profile.weightKg : weightLb,
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
    const { ft: heightFt, ins: heightIns } = cmToFtIn(profile.heightCm);
    const heightDisplay = `${heightFt}'${heightIns}" · ${Math.round(profile.heightCm)} cm`;
    // ── computed display values ──────────────────────────────────
    const paceLabel = (() => {
      if (profile.goal === "maintain") return "Maintain";
      const lbPerWeek = kgToLb(profile.weeklyRateKg);
      const match = profilePaceOptions.find(
        (p) => p.goal === profile.goal && Math.abs(kgToLb(p.weeklyRateKg) - lbPerWeek) < 0.05
      );
      return match?.label ?? `${profile.goal === "gain" ? "+" : "−"}${formatProfileNumber(lbPerWeek, 1)} lb/wk`;
    })();
    const goalLabel = profile.goal === "lose" ? "Lose weight" : profile.goal === "gain" ? "Gain weight" : "Maintain weight";
    const actLabel = profileActivityLabels[toProfileActivityLevel(profile.activityLevel)].title;
    const rateStr = profile.goal === "maintain" ? "—" : paceLabel;
    const cycleData = loadCycleData();
    const defaultWeightUnit: WeightUnit = profile.units === "metric" ? "kg" : "lb";

    const close = () => setEditing(null);

    return (
      <main className="app">
        {profileSaveStatus && <p className="profile-toast">{profileSaveStatus}</p>}

        <h1 className="kit-prof-title">Profile</h1>

        <div className="health-tabs pf-tabs" role="tablist" aria-label="Profile sections">
          <button type="button" role="tab" aria-selected={profileTab === "info"}
            className={profileTab === "info" ? "active" : ""} onClick={() => setProfileTab("info")}>Info</button>
          <button type="button" role="tab" aria-selected={profileTab === "settings"}
            className={profileTab === "settings" ? "active" : ""} onClick={() => setProfileTab("settings")}>Settings</button>
        </div>

        {profileTab === "info" && (
          <>
            <div className="kit-prof-hero">
              <div className="kit-prof-hero-avatar">{avatarInitial}</div>
              <div>
                <div className="kit-prof-hero-name">{profile.name || "Your Profile"}</div>
                <div className="kit-prof-hero-meta">Member since {new Date(profile.profileCreatedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</div>
              </div>
            </div>

            <Section title="About you">
              <Row label="Name"   value={profile.name}   onEdit={() => setEditing("name")} />
              <Row label="Age"    value={`${profile.age} yrs`}  onEdit={() => setEditing("personal")} />
              <Row label="Sex"    value={sexDisplay}             onEdit={() => setEditing("personal")} />
              <Row label="Height" value={heightDisplay}          onEdit={() => setEditing("height")} />
            </Section>

            {profile.trackCycle !== false && (
              <Section title="Cycle">
                <Row label="Cycle length"  value={`${cycleData.cycleLengthFallback} days`} sub="avg" onEdit={() => setEditing("cycle")} />
                <Row label="Period length" value={`${cycleData.periodLengthFallback} days`} sub="avg" onEdit={() => setEditing("cycle")} />
                <Row label="Fertile &amp; ovulation" value={cycleData.trackFertile ? "On" : "Off"} onEdit={() => setEditing("cycle")} />
              </Section>
            )}

            <Section title="Body">
              <Row label="Start weight" value={weightDisplay}    onEdit={() => setEditing("currentWeight")} />
              <Row label="Goal weight"    value={goalWeightDisplay ?? "—"} onEdit={() => setEditing("goalWeight")} />
              <Row label="Weekly rate"    value={rateStr}  onEdit={() => setEditing("goal")} />
            </Section>

            <Section title="Goal">
              <Row label="Goal type" value={goalLabel}  onEdit={() => setEditing("goal")} />
              <Row label="Activity"  value={actLabel}   onEdit={() => setEditing("activity")} />
            </Section>

            <Section title="Targets">
              <Row label="Daily calories" value={`${activeCalories.toLocaleString()} cal`} accent onEdit={() => setEditing("calories")} />
              <Row label="Protein" value={`${savedProfileGoals.protein} g`} onEdit={() => setEditing("macros")} />
              <Row label="Carbs"   value={`${savedProfileGoals.carbs} g`}   onEdit={() => setEditing("macros")} />
              <Row label="Fat"     value={`${savedProfileGoals.fat} g`}     onEdit={() => setEditing("macros")} />
            </Section>

            <Section title="Estimates">
              <Row label="BMR"            value={`${bmr.toLocaleString()} cal`}  sub="Basal metabolic rate" />
              <Row label="TDEE"           value={`${tdee.toLocaleString()} cal`} sub="Total daily energy" />
              <Row label="Est. goal date" value={goalDateDisplay ?? "—"} accent />
            </Section>

            <button
              type="button"
              className="secondary-button profile-recalculate-btn"
              style={{ marginTop: "0.5rem" }}
              onClick={() => { setProfileForm(profileToForm(profile)); setProfileWizardStep(0); setIsProfileWizardOpen(true); setProfileSaveStatus(""); }}
            >
              Full recalculate →
            </button>
          </>
        )}

        {profileTab === "settings" && (
          <>
            <Section title="Appearance">
              <ControlRow label="Theme">
                <SegmentedControl<ThemeMode>
                  ariaLabel="Theme"
                  options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "system", label: "System" }]}
                  value={themeMode}
                  onChange={setThemeMode}
                />
              </ControlRow>
            </Section>

            <Section title="Units">
              <ControlRow label="Weight">
                <SegmentedControl<WeightUnit>
                  ariaLabel="Weight unit"
                  options={[{ value: "lb", label: "lb" }, { value: "kg", label: "kg" }]}
                  value={profile.weightUnit ?? defaultWeightUnit}
                  onChange={(v) => patchProfile({ weightUnit: v })}
                />
              </ControlRow>
              <ControlRow label="Energy">
                <SegmentedControl<EnergyUnit>
                  ariaLabel="Energy unit"
                  options={[{ value: "cal", label: "cal" }, { value: "kj", label: "kJ" }]}
                  value={profile.energyUnit ?? "cal"}
                  onChange={(v) => patchProfile({ energyUnit: v })}
                />
              </ControlRow>
            </Section>

            <Section title="Home screen">
              <SwitchRow label="Show streak counter"  checked={profile.showStreak ?? true} onChange={(v) => patchProfile({ showStreak: v })} />
              <SwitchRow label="Show macro breakdown" checked={profile.showMacros ?? true} onChange={(v) => patchProfile({ showMacros: v })} />
            </Section>

            <Section title="Food logging">
              <SwitchRow label="Quick-add calories" checked={profile.quickAdd ?? true}       onChange={(v) => patchProfile({ quickAdd: v })} />
              <SwitchRow label="Barcode scanner"    checked={profile.barcodeScanner ?? true} onChange={(v) => patchProfile({ barcodeScanner: v })} />
            </Section>

            <Section title="Cycle tracking">
              <SwitchRow label="Show cycle tab" checked={profile.trackCycle !== false} onChange={(v) => setCycleTrackingPreference(v)} />
            </Section>

            <Section title="Notifications">
              <SwitchRow label="Push notifications"       checked={profile.notifications ?? true}  onChange={(v) => patchProfile({ notifications: v })} />
              <SwitchRow label="Daily log reminder"       checked={profile.logReminder ?? true}    onChange={(v) => patchProfile({ logReminder: v })} />
              <SwitchRow label="Weight check-in reminder" checked={profile.weightReminder ?? false} onChange={(v) => patchProfile({ weightReminder: v })} />
            </Section>

            <Section title="Data &amp; account">
              <button className="kit-prof-row kit-prof-row--tap kit-prof-row--link" type="button" onClick={onOpenExport}>
                <span className="kit-prof-row__label">Export my data</span>
                <span className="kit-prof-row__chev">›</span>
              </button>
              <button className="kit-prof-row kit-prof-row--tap kit-prof-row--link" type="button" onClick={onOpenImport}>
                <span className="kit-prof-row__label">Import data</span>
                <span className="kit-prof-row__chev">›</span>
              </button>
              <button className="kit-prof-row kit-prof-row--tap kit-prof-row--link" type="button" onClick={onConnectDrive}>
                <span className="kit-prof-row__label">Connected apps</span>
                <span className="kit-prof-row__chev">›</span>
              </button>
              <button className="kit-prof-row kit-prof-row--tap kit-prof-row--link" type="button" onClick={() => setInfoSheet("privacy")}>
                <span className="kit-prof-row__label">Privacy &amp; data</span>
                <span className="kit-prof-row__chev">›</span>
              </button>
              <button className="kit-prof-row kit-prof-row--tap kit-prof-row--link" type="button" onClick={() => setInfoSheet("help")}>
                <span className="kit-prof-row__label">Help &amp; support</span>
                <span className="kit-prof-row__chev">›</span>
              </button>
              <button className="kit-prof-row kit-prof-row--tap kit-prof-row--link kit-prof-row--danger" type="button" onClick={openDeleteModal}>
                <span className="kit-prof-row__label">Delete all data</span>
                <span className="kit-prof-row__chev">›</span>
              </button>
            </Section>
          </>
        )}

        {/* Edit sheets */}
        {editing === "name"          && <EditName profile={profile} patchProfile={patchProfile} onClose={close} />}
        {editing === "personal"      && <EditPersonal profile={profile} patchProfile={patchProfile} onClose={close} />}
        {editing === "height"        && <EditHeight profile={profile} patchProfile={patchProfile} onClose={close} />}
        {editing === "currentWeight" && <EditCurrentWeight profile={profile} patchProfile={patchProfile} onClose={close} />}
        {editing === "goalWeight"    && <EditGoalWeight profile={profile} patchProfile={patchProfile} onClose={close} />}
        {editing === "activity"      && <EditActivity profile={profile} patchProfile={patchProfile} onClose={close} />}
        {editing === "goal"          && <EditGoal profile={profile} patchProfile={patchProfile} onClose={close} />}
        {editing === "calories"      && <EditCalories profile={profile} patchProfile={patchProfile} onClose={close} />}
        {editing === "macros"        && <EditMacros profile={profile} patchProfile={patchProfile} onClose={close} />}
        {editing === "cycle"         && <EditCycle onClose={close} />}

        {infoSheet === "privacy" && (
          <Sheet title="Privacy &amp; data" onClose={() => setInfoSheet(null)}>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
              FoodVault stores everything — your profile, food logs, recipes, and weight entries — only in this browser&rsquo;s local storage. Nothing is sent to a server except food searches (looked up against the USDA FoodData Central database) and, if you choose to connect it, an optional Google Drive backup. Clearing your browser data or switching devices without backing up will lose anything stored locally.
            </p>
          </Sheet>
        )}

        {infoSheet === "help" && (
          <Sheet title="Help &amp; support" onClose={() => setInfoSheet(null)}>
            <div style={{ display: "grid", gap: "0.9rem", fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}>FoodVault calculates your targets from the <strong>Mifflin-St Jeor</strong> formula (BMR), scaled by your activity level (TDEE), then adjusted by your goal and weekly rate.</p>
              <p style={{ margin: 0 }}>You can override the calculated calorie target or macros at any time from the Targets section — toggle &ldquo;Override manually&rdquo; in the Calorie target or Macro targets editor.</p>
              <p style={{ margin: 0 }}>This is a personal project with no support team behind it — there&rsquo;s no ticket system or live chat, just the app itself.</p>
            </div>
          </Sheet>
        )}

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
                <p className="pf-dlg-instruction">Type <strong>DELETE</strong> to confirm.</p>
                <input className="pf-dlg-input" type="text" placeholder="DELETE"
                  value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)}
                  autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
              </div>
              <div className="pf-dlg-foot">
                <button type="button" className="secondary-button" onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
                <button type="button" className="danger-button" onClick={handleDeleteConfirm} disabled={deleteConfirmText !== "DELETE"}>
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
        {profileWizardStep === 2 && (
          <button type="button" className="wz-skip-btn" onClick={() => moveProfileStep(1)}>
            Skip
          </button>
        )}
      </div>

      {/* Step 0: Basics */}
      {profileWizardStep === 0 && (
        <section className="panel">
          <div className="wizard-card profile-form-grid profile-basics-form">
            <div className="wz-name-age-row">
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
            </div>

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

            <label>
              Height
              <div className="profile-height-row">
                <div className="profile-unit-input">
                  <input
                    aria-label="Height feet"
                    type="number"
                    min="3"
                    max="8"
                    step="1"
                    value={profileForm.heightFeet}
                    onChange={(e) => updateProfileForm({ heightFeet: e.target.value })}
                  />
                  <span>ft</span>
                </div>
                <div className="profile-unit-input">
                  <input
                    aria-label="Height inches"
                    type="number"
                    min="0"
                    max="11"
                    step="0.1"
                    value={profileForm.heightInches}
                    onChange={(e) => updateProfileForm({ heightInches: e.target.value })}
                  />
                  <span>in</span>
                </div>
              </div>
              {profileErrors.height && <span className="profile-field-error">{profileErrors.height}</span>}
            </label>

            <label>
              Current Weight
              <div className="profile-weight-row">
                <input
                  type="number"
                  min="66"
                  max="661"
                  step="0.1"
                  value={profileForm.weight}
                  onChange={(e) => updateProfileForm({ weight: e.target.value })}
                />
                <span>lb</span>
              </div>
              {profileErrors.weight && <span className="profile-field-error">{profileErrors.weight}</span>}
            </label>

            <label className="profile-checkbox-row">
              <input
                type="checkbox"
                checked={profileForm.trackCycle}
                onChange={(e) => updateProfileForm({ trackCycle: e.target.checked })}
              />
              <span>Track Menstrual Cycle</span>
            </label>
          </div>
        </section>
      )}

      {/* Step 1: Activity */}
      {profileWizardStep === 1 && (
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

      {/* Step 2: Plan */}
      {profileWizardStep === 2 && (
        <>
          <section className="panel">
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
                    min="66"
                    max="661"
                    step="0.1"
                    value={profileForm.goalWeight}
                    onChange={(e) => updateProfileForm({ goalWeight: e.target.value })}
                  />
                  <span>lb</span>
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

          <section className="panel profile-manual-calorie-panel">
            <div className="profile-manual-calorie-header">
              <div>
                <span>Calorie target</span>
                <strong>
                  {profileForm.useManualCalories && profileForm.manualCalorieOverride
                    ? `${Number(profileForm.manualCalorieOverride).toLocaleString()} kcal/day`
                    : "Using recommendation"}
                </strong>
              </div>
              <button type="button" className="secondary-button" onClick={openManualCalorieEditor}>
                Set calorie goal manually
              </button>
            </div>

            {isManualCalorieEditorOpen && (
              <div className="profile-manual-calorie-editor">
                <label>
                  Manual calorie goal
                  <div className="profile-manual-calorie-input">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={manualCalorieDraft}
                      onChange={(e) => {
                        setManualCalorieDraft(e.target.value);
                        setManualCalorieDraftError("");
                      }}
                    />
                    <span>kcal/day</span>
                  </div>
                </label>
                <div className="profile-manual-calorie-actions">
                  <button type="button" className="primary-button" onClick={applyManualCalorieGoal}>
                    Apply
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setIsManualCalorieEditorOpen(false);
                      setManualCalorieDraftError("");
                    }}
                  >
                    Cancel
                  </button>
                  <button type="button" className="secondary-button" onClick={revertManualCalorieGoal}>
                    Revert to recommended
                  </button>
                </div>
                {manualCalorieDraftError && <span className="profile-field-error">{manualCalorieDraftError}</span>}
                {profileErrors.manualCalories && <span className="profile-field-error">{profileErrors.manualCalories}</span>}
              </div>
            )}
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
                  <div className="wz-live-label">Recommended</div>
                  <div className="wz-live-val">{profileCalculation.calculatedCalories.toLocaleString()}<small>kcal/day</small></div>
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

      {/* Step 3: Macros */}
      {profileWizardStep === 3 && (
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
