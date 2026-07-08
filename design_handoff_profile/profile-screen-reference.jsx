(function () {

  // ── Activity level constants ───────────────────────────────────────────────
  const ACTIVITY = [
    { value: "sedentary",   label: "Sedentary",        desc: "Little or no exercise",               mult: 1.2   },
    { value: "light",       label: "Lightly active",    desc: "Light exercise 1–3 days/wk",          mult: 1.375 },
    { value: "moderate",    label: "Moderately active", desc: "Moderate exercise 3–5 days/wk",       mult: 1.55  },
    { value: "active",      label: "Active",            desc: "Hard exercise 6–7 days/wk",           mult: 1.725 },
    { value: "very_active", label: "Very active",       desc: "Hard daily training or physical job", mult: 1.9   },
  ];

  // ── Pure calculation helpers ───────────────────────────────────────────────
  function ftInToCm(ft, ins) { return (ft * 12 + ins) * 2.54; }
  function lbToKg(lb) { return lb * 0.453592; }

  function calcBMR(wlb, hft, hin, age, sex) {
    const kg = lbToKg(wlb), cm = ftInToCm(hft, hin);
    return Math.round(sex === "male"
      ? 10 * kg + 6.25 * cm - 5 * age + 5
      : 10 * kg + 6.25 * cm - 5 * age - 161);
  }
  function calcTDEE(bmr, act) {
    const a = ACTIVITY.find(a => a.value === act) || ACTIVITY[2];
    return Math.round(bmr * a.mult);
  }
  function calcTarget(tdee, goal, rate) {
    if (goal === "lose") return Math.max(1200, tdee - Math.round(rate * 500));
    if (goal === "gain") return tdee + Math.round(rate * 500);
    return tdee;
  }
  function calcMacros(cal, goal) {
    const [pp, cp, fp] = goal === "lose" ? [.30, .40, .30]
                       : goal === "gain" ? [.25, .50, .25]
                       :                  [.25, .45, .30];
    return {
      protein: Math.round(cal * pp / 4),
      carbs:   Math.round(cal * cp / 4),
      fat:     Math.round(cal * fp / 9),
    };
  }
  function calcGoalDate(cw, gw, rate, goal) {
    if (goal === "maintain") return "—";
    const diff = Math.abs(cw - gw);
    if (diff < 0.5) return "Almost there!";
    const d = new Date(2026, 5, 15);
    d.setDate(d.getDate() + Math.round(diff / rate * 7));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // ── Persistence ────────────────────────────────────────────────────────────
  const LS_KEY = "fv.profile2";
  const DEFAULTS = {
    name: "Jessica", age: 28, sex: "female",
    heightFt: 5, heightIn: 6,
    startWeight: 161.1, goalWeight: 141, weeklyRate: 1,
    activityLevel: "moderate", goalType: "lose",
    manualCalories: null, manualProtein: null, manualCarbs: null, manualFat: null,
    cycleLength: 28, periodLength: 5, trackFertile: true,
    theme: "dark", weightUnit: "lb", energyUnit: "cal",
    showCycle: true, showStreak: true, showMacros: true,
    logReminder: true, weightReminder: false, notifications: true,
    quickAdd: true, barcodeScanner: true,
  };
  function loadProfile() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY));
      return s ? { ...DEFAULTS, ...s } : { ...DEFAULTS };
    } catch { return { ...DEFAULTS }; }
  }
  function saveProfile(p) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
    try { window.dispatchEvent(new CustomEvent("fv:profilechange")); } catch {}
  }

  // ── Micro UI components ────────────────────────────────────────────────────
  function SectionLabel({ title }) {
    return <div className="kit-prof-section">{title}</div>;
  }

  // Wraps label + card as one grid item — avoids CSS Grid track-sizing
  // collapse that occurs when overflow:hidden children set min-content to 0.
  function Section({ title, children }) {
    return (
      <div className="kit-prof-group">
        <SectionLabel title={title} />
        <div className="kit-prof-card">{children}</div>
      </div>
    );
  }

  // Tappable = button, static = div
  function Row({ label, value, sub, accent, onEdit }) {
    const El = onEdit ? "button" : "div";
    return (
      <El className={`kit-prof-row${onEdit ? " kit-prof-row--tap" : ""}`} onClick={onEdit}>
        <span className="kit-prof-row__label">{label}</span>
        <span className="kit-prof-row__right">
          <span className={`kit-prof-row__val${accent ? " kit-prof-row__val--accent" : ""}`}>{value}</span>
          {sub && <span className="kit-prof-row__sub">{sub}</span>}
          {onEdit && <span className="kit-prof-row__chev">›</span>}
        </span>
      </El>
    );
  }

  function WtStepper({ value, onChange }) {
    const [raw, setRaw] = React.useState(value.toFixed(1));
    // keep raw in sync when stepper bumps value
    React.useEffect(() => { setRaw(value.toFixed(1)); }, [value]);
    const bump = d => onChange(Math.round((value + d) * 10) / 10);
    const commit = () => {
      const n = parseFloat(raw);
      if (!isNaN(n) && n > 0) {
        const clamped = Math.round(Math.min(999, Math.max(1, n)) * 10) / 10;
        onChange(clamped);
        setRaw(clamped.toFixed(1));
      } else {
        setRaw(value.toFixed(1));
      }
    };
    return (
      <div className="kit-weighin">
        <button className="kit-weighin__step" onClick={() => bump(-0.2)}>−</button>
        <div className="kit-weighin__val">
          <input className="kit-weighin__input"
            type="text" inputMode="decimal"
            value={raw}
            onChange={e => setRaw(e.target.value)}
            onFocus={e => e.target.select()}
            onBlur={commit} />
          <span>lb</span>
        </div>
        <button className="kit-weighin__step" onClick={() => bump(0.2)}>＋</button>
      </div>
    );
  }

  function NumStepper({ value, onChange, unit, min = 1, max = 120 }) {
    const bump = d => onChange(Math.min(max, Math.max(min, value + d)));
    return (
      <div className="kit-weighin">
        <button className="kit-weighin__step" onClick={() => bump(-1)}>−</button>
        <div className="kit-weighin__val"><strong>{value}</strong>{unit && <span>{unit}</span>}</div>
        <button className="kit-weighin__step" onClick={() => bump(1)}>＋</button>
      </div>
    );
  }

  function OptionList({ options, value, onChange }) {
    return (
      <div className="kit-prof-optlist">
        {options.map(o => (
          <button key={o.value}
            className={`kit-prof-opt${value === o.value ? " is-on" : ""}`}
            onClick={() => onChange(o.value)}>
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

  // ── Sheet wrapper (uses window.Sheet from Overlays.jsx) ───────────────────
  function SheetWrap({ title, onClose, onSave, children }) {
    const { Button } = window.FoodVaultDesignSystem_fb9669;
    return (
      <window.Sheet title={title} onClose={onClose}
        footer={<Button variant="primary" fullWidth onClick={onSave}>Save</Button>}>
        <div style={{ display: "grid", gap: "1.1rem" }}>{children}</div>
      </window.Sheet>
    );
  }

  // ── Edit sheets ────────────────────────────────────────────────────────────

  function EditName({ p, onSave, onClose }) {
    const [name, setName] = React.useState(p.name);
    return (
      <SheetWrap title="Edit name" onClose={onClose} onSave={() => onSave({ name: name.trim() || p.name })}>
        <div className="kit-prof-input-wrap">
          <div className="kit-field__label">Display name</div>
          <input className="kit-qty__input"
            style={{ width: "100%", boxSizing: "border-box", textAlign: "left" }}
            value={name} onChange={e => setName(e.target.value)} />
        </div>
      </SheetWrap>
    );
  }

  function EditPersonal({ p, onSave, onClose }) {
    const [age, setAge] = React.useState(p.age);
    const [sex, setSex] = React.useState(p.sex);
    return (
      <SheetWrap title="Personal info" onClose={onClose} onSave={() => onSave({ age, sex })}>
        <div className="kit-prof-input-wrap">
          <div className="kit-field__label">Age</div>
          <NumStepper value={age} onChange={setAge} unit="yrs" min={13} max={99} />
        </div>
        <div className="kit-prof-input-wrap">
          <div className="kit-field__label">Biological sex</div>
          <OptionList
            options={[{ value: "female", label: "Female" }, { value: "male", label: "Male" }]}
            value={sex} onChange={setSex} />
          <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: 0 }}>Used only for BMR calculation.</p>
        </div>
      </SheetWrap>
    );
  }

  function EditHeight({ p, onSave, onClose }) {
    const [ft, setFt] = React.useState(p.heightFt);
    const [ins, setIns] = React.useState(p.heightIn);
    const cm = Math.round(ftInToCm(ft, ins));
    return (
      <SheetWrap title="Height" onClose={onClose} onSave={() => onSave({ heightFt: ft, heightIn: ins })}>
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
      </SheetWrap>
    );
  }

  function EditCurrentWeight({ p, onSave, onClose }) {
    const [w, setW] = React.useState(p.startWeight);
    return (
      <SheetWrap title="Start weight" onClose={onClose} onSave={() => onSave({ startWeight: w })}>
        <WtStepper value={w} onChange={setW} />
        <p className="kit-weighin__date">June 15, 2026</p>
      </SheetWrap>
    );
  }

  function EditGoalWeight({ p, onSave, onClose }) {
    const [w, setW] = React.useState(p.goalWeight);
    return (
      <SheetWrap title="Goal weight" onClose={onClose} onSave={() => onSave({ goalWeight: w })}>
        <WtStepper value={w} onChange={setW} />
      </SheetWrap>
    );
  }

  function EditActivity({ p, onSave, onClose }) {
    const [level, setLevel] = React.useState(p.activityLevel);
    return (
      <SheetWrap title="Activity level" onClose={onClose} onSave={() => onSave({ activityLevel: level })}>
        <OptionList options={ACTIVITY} value={level} onChange={setLevel} />
      </SheetWrap>
    );
  }

  function EditCycle({ p, onSave, onClose }) {
    const { Switch } = window.FoodVaultDesignSystem_fb9669;
    const [cycleLength,  setCycleLength]  = React.useState(p.cycleLength  ?? 28);
    const [periodLength, setPeriodLength] = React.useState(p.periodLength ?? 5);
    const [trackFertile, setTrackFertile] = React.useState(p.trackFertile !== false);
    return (
      <SheetWrap title="Cycle" onClose={onClose}
        onSave={() => onSave({ cycleLength, periodLength, trackFertile })}>
        <div className="kit-prof-input-wrap">
          <div className="kit-field__label">Average cycle length</div>
          <NumStepper value={cycleLength} onChange={setCycleLength} unit="days" min={20} max={45} />
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.45 }}>
            The textbook cycle is 28 days — a starting point only. FoodVault re-learns your real
            average as you log, so predictions get sharper over time.
          </p>
        </div>
        <div className="kit-prof-input-wrap">
          <div className="kit-field__label">Average period length</div>
          <NumStepper value={periodLength} onChange={setPeriodLength} unit="days" min={1} max={10} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem" }}>
          <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Show fertile window &amp; ovulation</span>
          <Switch checked={trackFertile} label="" onChange={setTrackFertile} />
        </div>
      </SheetWrap>
    );
  }

  function EditGoal({ p, onSave, onClose }) {
    const [goalType, setGoalType] = React.useState(p.goalType);
    const [rate, setRate]         = React.useState(p.weeklyRate);
    const rateOpts = goalType === "gain"
      ? [.25, .5, .75, 1].map(v => ({ value: v, label: `+${v} lb/wk` }))
      : [.5,  1, 1.5,  2].map(v => ({ value: v, label: `−${v} lb/wk` }));
    return (
      <SheetWrap title="Goal" onClose={onClose} onSave={() => onSave({ goalType, weeklyRate: rate })}>
        <div className="kit-prof-input-wrap">
          <div className="kit-field__label">Goal type</div>
          <OptionList
            options={[
              { value: "lose",     label: "Lose weight"    },
              { value: "maintain", label: "Maintain weight" },
              { value: "gain",     label: "Gain weight"     },
            ]}
            value={goalType}
            onChange={v => { setGoalType(v); setRate(v === "gain" ? 0.5 : v === "maintain" ? 0 : 1); }} />
        </div>
        {goalType !== "maintain" && (
          <div className="kit-prof-input-wrap">
            <div className="kit-field__label">Weekly rate</div>
            <div className="kit-chiprow kit-chiprow--wrap">
              {rateOpts.map(o => (
                <button key={o.value}
                  className={`kit-pick${rate === o.value ? " is-on" : ""}`}
                  onClick={() => setRate(o.value)}>{o.label}</button>
              ))}
            </div>
          </div>
        )}
      </SheetWrap>
    );
  }

  function EditCalories({ p, computed, onSave, onClose }) {
    const { Switch } = window.FoodVaultDesignSystem_fb9669;
    const [manual, setManual] = React.useState(p.manualCalories !== null);
    const [val, setVal] = React.useState(String(p.manualCalories ?? computed.dailyTarget));
    const deficitLabel = p.goalType === "maintain" ? ""
      : p.goalType === "gain" ? ` + ${Math.round(p.weeklyRate * 500)} cal surplus`
      : ` − ${Math.round(p.weeklyRate * 500)} cal deficit`;
    return (
      <SheetWrap title="Calorie target" onClose={onClose}
        onSave={() => onSave({ manualCalories: manual ? (parseInt(val) || null) : null })}>
        <div style={{ background: "var(--surface-raised)", border: "var(--border)", borderRadius: "var(--radius-md)", padding: "0.8rem 0.9rem" }}>
          <div style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Auto-calculated</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {computed.dailyTarget.toLocaleString()}
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 700, marginLeft: "0.3rem" }}>cal/day</span>
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4 }}>
            TDEE {computed.tdee.toLocaleString()}{deficitLabel}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem" }}>
          <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Override manually</span>
          <Switch checked={manual} label=""
            onChange={v => { setManual(v); if (!v) setVal(String(computed.dailyTarget)); }} />
        </div>
        {manual && (
          <div className="kit-prof-input-wrap">
            <div className="kit-field__label">Daily calorie target</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <input className="kit-qty__input" style={{ width: 120, textAlign: "right" }}
                type="text" inputMode="numeric"
                value={val} onChange={e => setVal(e.target.value.replace(/\D/g, ""))} />
              <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>cal</span>
            </div>
          </div>
        )}
      </SheetWrap>
    );
  }

  function EditMacros({ p, computed, onSave, onClose }) {
    const { Switch } = window.FoodVaultDesignSystem_fb9669;
    const wasManual = p.manualProtein !== null || p.manualCarbs !== null || p.manualFat !== null;
    const [manual, setManual] = React.useState(wasManual);
    const [pr, setPr] = React.useState(String(p.manualProtein ?? computed.macros.protein));
    const [ca, setCa] = React.useState(String(p.manualCarbs   ?? computed.macros.carbs));
    const [fa, setFa] = React.useState(String(p.manualFat     ?? computed.macros.fat));
    const total = (parseInt(pr)||0)*4 + (parseInt(ca)||0)*4 + (parseInt(fa)||0)*9;
    const reset = () => { setPr(String(computed.macros.protein)); setCa(String(computed.macros.carbs)); setFa(String(computed.macros.fat)); };
    return (
      <SheetWrap title="Macro targets" onClose={onClose} onSave={() => onSave({
        manualProtein: manual ? (parseInt(pr)||null) : null,
        manualCarbs:   manual ? (parseInt(ca)||null) : null,
        manualFat:     manual ? (parseInt(fa)||null) : null,
      })}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem" }}>
          <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Set manually</span>
          <Switch checked={manual} label="" onChange={v => { setManual(v); if (!v) reset(); }} />
        </div>
        <div style={{ display: "grid", gap: "0.65rem" }}>
          {[
            { label: "Protein", color: "var(--macro-protein)", val: pr, set: setPr },
            { label: "Carbs",   color: "var(--macro-carbs)",   val: ca, set: setCa },
            { label: "Fat",     color: "var(--macro-fat)",     val: fa, set: setFa },
          ].map(m => (
            <div key={m.label} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ width: 52, fontSize: "0.8rem", fontWeight: 800, color: m.color, flexShrink: 0 }}>{m.label}</span>
              <input className="kit-qty__input"
                style={{ flex: 1, textAlign: "right", opacity: manual ? 1 : 0.45 }}
                disabled={!manual} type="text" inputMode="numeric"
                value={m.val} onChange={e => m.set(e.target.value.replace(/\D/g, ""))} />
              <span style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "0.82rem", width: 16 }}>g</span>
            </div>
          ))}
        </div>
        {manual && (
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0, textAlign: "center" }}>
            ≈ {total.toLocaleString()} cal total
          </p>
        )}
      </SheetWrap>
    );
  }

  // ── Info tab ───────────────────────────────────────────────────────────────
  function InfoTab({ profile: p, computed: c, onEdit }) {
    const hStr = `${p.heightFt}'${p.heightIn}" · ${Math.round(ftInToCm(p.heightFt, p.heightIn))} cm`;
    const actLabel = (ACTIVITY.find(a => a.value === p.activityLevel) || ACTIVITY[2]).label;
    const goalLabel = { lose: "Lose weight", maintain: "Maintain", gain: "Gain weight" }[p.goalType] || "—";
    const rateStr   = p.goalType === "maintain" ? "—"
      : p.goalType === "gain" ? `+${p.weeklyRate} lb/wk` : `−${p.weeklyRate} lb/wk`;
    return (
      <div className="kit-scroll">
        {/* Avatar header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "4px 2px 2px" }}>
          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "var(--accent-bg)", display: "grid", placeItems: "center", fontSize: 20, fontWeight: 800, color: "var(--accent)", flexShrink: 0 }}>
            {p.name[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{p.name}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 1 }}>Member since Jan 2026</div>
          </div>
        </div>

        <Section title="About you">
          <Row label="Name"   value={p.name}                                 onEdit={() => onEdit("name")} />
          <Row label="Age"    value={`${p.age} yrs`}                        onEdit={() => onEdit("personal")} />
          <Row label="Sex"    value={p.sex === "female" ? "Female" : "Male"} onEdit={() => onEdit("personal")} />
          <Row label="Height" value={hStr}                                  onEdit={() => onEdit("height")} />
        </Section>

        {p.showCycle && (
          <Section title="Cycle">
            <Row label="Cycle length"       value={`${p.cycleLength ?? 28} days`}  sub="avg" onEdit={() => onEdit("cycle")} />
            <Row label="Period length"      value={`${p.periodLength ?? 5} days`}  sub="avg" onEdit={() => onEdit("cycle")} />
            <Row label="Fertile &amp; ovulation" value={(p.trackFertile !== false) ? "On" : "Off"}    onEdit={() => onEdit("cycle")} />
          </Section>
        )}

        <Section title="Body">
          <Row label="Start weight"   value={`${p.startWeight} lb`}  onEdit={() => onEdit("startWeight")} />
          <Row label="Goal weight"    value={`${p.goalWeight} lb`}    onEdit={() => onEdit("goalWeight")} />
          <Row label="Weekly rate"    value={rateStr}                 onEdit={() => onEdit("goal")} />
        </Section>

        <Section title="Goal">
          <Row label="Goal type" value={goalLabel} onEdit={() => onEdit("goal")} />
          <Row label="Activity"  value={actLabel}  onEdit={() => onEdit("activity")} />
        </Section>

        <Section title="Targets">
          <Row label="Daily calories" value={`${(p.manualCalories ?? c.dailyTarget).toLocaleString()} cal`} accent onEdit={() => onEdit("calories")} />
          <Row label="Protein" value={`${p.manualProtein ?? c.macros.protein} g`} onEdit={() => onEdit("macros")} />
          <Row label="Carbs"   value={`${p.manualCarbs   ?? c.macros.carbs} g`}   onEdit={() => onEdit("macros")} />
          <Row label="Fat"     value={`${p.manualFat     ?? c.macros.fat} g`}     onEdit={() => onEdit("macros")} />
        </Section>

        <Section title="Estimates">
          <Row label="BMR"            value={`${c.bmr.toLocaleString()} cal`}  sub="Basal metabolic rate" />
          <Row label="TDEE"           value={`${c.tdee.toLocaleString()} cal`} sub="Total daily energy" />
          <Row label="Est. goal date" value={c.goalDate} accent />
        </Section>
        <div style={{ height: "0.5rem" }} />
      </div>
    );
  }

  // ── Settings tab ───────────────────────────────────────────────────────────
  function SwitchRow({ label, checked, onChange }) {
    return (
      <button
        className="kit-prof-row kit-prof-row--control kit-prof-row--tap"
        onClick={() => onChange(!checked)}
        style={{ cursor: "pointer" }}
      >
        <span className="kit-prof-row__label"
          style={{ color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
        {/* Inline pill toggle — same visual as fv-switch */}
        <span style={{
          display: "inline-flex", alignItems: "center",
          width: 44, height: 26, borderRadius: 13, flexShrink: 0,
          background: checked ? "var(--accent)" : "var(--surface-raised)",
          border: checked ? "none" : "1px solid var(--border-default)",
          transition: "background 0.18s", padding: "0 3px",
          justifyContent: checked ? "flex-end" : "flex-start",
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            transition: "transform 0.18s",
          }} />
        </span>
      </button>
    );
  }

  function SettingsTab({ profile: p, onUpdate, onAction }) {
    const { SegmentedControl } = window.FoodVaultDesignSystem_fb9669;
    const set = (k, v) => onUpdate({ [k]: v });

    return (
      <div className="kit-scroll">
        <Section title="Appearance">
          <div className="kit-prof-row kit-prof-row--control">
            <span className="kit-prof-row__label">Theme</span>
            <SegmentedControl size="sm" ariaLabel="Theme"
              options={[{ label: "Dark", value: "dark" }, { label: "Light", value: "light" }, { label: "System", value: "system" }]}
              value={p.theme} onChange={v => set("theme", v)} />
          </div>
        </Section>

        <Section title="Units">
          <div className="kit-prof-row kit-prof-row--control">
            <span className="kit-prof-row__label">Weight</span>
            <SegmentedControl size="sm" ariaLabel="Weight unit"
              options={[{ label: "lb", value: "lb" }, { label: "kg", value: "kg" }]}
              value={p.weightUnit} onChange={v => set("weightUnit", v)} />
          </div>
          <div className="kit-prof-row kit-prof-row--control">
            <span className="kit-prof-row__label">Energy</span>
            <SegmentedControl size="sm" ariaLabel="Energy unit"
              options={[{ label: "cal", value: "cal" }, { label: "kJ", value: "kj" }]}
              value={p.energyUnit} onChange={v => set("energyUnit", v)} />
          </div>
        </Section>

        <Section title="Home screen">
          <SwitchRow label="Show streak counter"  checked={p.showStreak} onChange={v => set("showStreak", v)} />
          <SwitchRow label="Show macro breakdown" checked={p.showMacros} onChange={v => set("showMacros", v)} />
        </Section>

        <Section title="Food logging">
          <SwitchRow label="Quick-add calories" checked={p.quickAdd}       onChange={v => set("quickAdd", v)} />
          <SwitchRow label="Barcode scanner"    checked={p.barcodeScanner} onChange={v => set("barcodeScanner", v)} />
        </Section>

        <Section title="Cycle tracking">
          <SwitchRow label="Show cycle tab" checked={p.showCycle} onChange={v => set("showCycle", v)} />
        </Section>

        <Section title="Notifications">
          <SwitchRow label="Push notifications"         checked={p.notifications}  onChange={v => set("notifications", v)} />
          <SwitchRow label="Daily log reminder"         checked={p.logReminder}    onChange={v => set("logReminder", v)} />
          <SwitchRow label="Weight check-in reminder"   checked={p.weightReminder} onChange={v => set("weightReminder", v)} />
        </Section>

        <Section title="Data &amp; account">
          <button className="kit-prof-row kit-prof-row--tap kit-prof-row--link" onClick={() => onAction("export")}>
            <span className="kit-prof-row__label">Export my data</span>
            <span className="kit-prof-row__chev">›</span>
          </button>
          <button className="kit-prof-row kit-prof-row--tap kit-prof-row--link" onClick={() => onAction("connected")}>
            <span className="kit-prof-row__label">Connected apps</span>
            <span className="kit-prof-row__chev">›</span>
          </button>
          <button className="kit-prof-row kit-prof-row--tap kit-prof-row--link" onClick={() => onAction("privacy")}>
            <span className="kit-prof-row__label">Privacy &amp; data</span>
            <span className="kit-prof-row__chev">›</span>
          </button>
          <button className="kit-prof-row kit-prof-row--tap kit-prof-row--link" onClick={() => onAction("help")}>
            <span className="kit-prof-row__label">Help &amp; support</span>
            <span className="kit-prof-row__chev">›</span>
          </button>
          <button className="kit-prof-row kit-prof-row--tap kit-prof-row--link kit-prof-row--danger" onClick={() => onAction("delete")}>
            <span className="kit-prof-row__label">Delete account</span>
            <span className="kit-prof-row__chev">›</span>
          </button>
        </Section>
        <div style={{ height: "1rem" }} />
      </div>
    );
  }

  // ── Main component ─────────────────────────────────────────────────────────
  function ProfileScreen() {
    const [profile, setProfile] = React.useState(loadProfile);
    const [tab,     setTab]     = React.useState("info");
    const [editing, setEditing] = React.useState(null);
    const [confirmDel, setConfirmDel] = React.useState(false);

    function update(patch) {
      setProfile(prev => { const n = { ...prev, ...patch }; saveProfile(n); return n; });
    }
    function saveEdit(patch) { update(patch); setEditing(null); }

    const computed = React.useMemo(() => {
      const bmr         = calcBMR(profile.startWeight, profile.heightFt, profile.heightIn, profile.age, profile.sex);
      const tdee        = calcTDEE(bmr, profile.activityLevel);
      const dailyTarget = profile.manualCalories !== null
        ? profile.manualCalories
        : calcTarget(tdee, profile.goalType, profile.weeklyRate);
      const macros      = calcMacros(dailyTarget, profile.goalType);
      const goalDate    = calcGoalDate(profile.startWeight, profile.goalWeight, profile.weeklyRate, profile.goalType);
      return { bmr, tdee, dailyTarget, macros, goalDate };
    }, [profile]);

    const close = () => setEditing(null);

    return (
      <React.Fragment>
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          {/* Screen header + tab bar */}
          <div style={{ padding: "0.3rem 0.9rem 0", flexShrink: 0 }}>
            <div className="kit-head">
              <span className="kit-head__title">Profile</span>
            </div>
            <div className="kit-w-subtabs" style={{ marginLeft: 0, marginRight: 0 }}>
              {[["info", "Info"], ["settings", "Settings"]].map(([id, lbl]) => (
                <button key={id}
                  className={`kit-w-subtab${tab === id ? " is-active" : ""}`}
                  onClick={() => setTab(id)}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          {tab === "info"     && <InfoTab     profile={profile} computed={computed} onEdit={setEditing} />}
          {tab === "settings" && <SettingsTab profile={profile} onUpdate={update}
                                   onAction={a => { if (a === "delete") setConfirmDel(true); }} />}
        </div>

        {/* Edit sheets */}
        {editing === "name"          && <EditName          p={profile} onSave={saveEdit} onClose={close} />}
        {editing === "personal"      && <EditPersonal      p={profile} onSave={saveEdit} onClose={close} />}
        {editing === "cycle"         && <EditCycle         p={profile} onSave={saveEdit} onClose={close} />}
        {editing === "height"        && <EditHeight        p={profile} onSave={saveEdit} onClose={close} />}
        {editing === "startWeight"   && <EditCurrentWeight p={profile} onSave={saveEdit} onClose={close} />}
        {editing === "goalWeight"    && <EditGoalWeight    p={profile} onSave={saveEdit} onClose={close} />}
        {editing === "activity"      && <EditActivity      p={profile} onSave={saveEdit} onClose={close} />}
        {editing === "goal"          && <EditGoal          p={profile} onSave={saveEdit} onClose={close} />}
        {editing === "calories"      && <EditCalories      p={profile} computed={computed} onSave={saveEdit} onClose={close} />}
        {editing === "macros"        && <EditMacros        p={profile} computed={computed} onSave={saveEdit} onClose={close} />}

        {confirmDel && (
          <window.ConfirmDialog
            title="Delete account?"
            message="All your data will be permanently deleted. This cannot be undone."
            confirmLabel="Delete"
            danger
            onCancel={() => setConfirmDel(false)}
            onConfirm={() => setConfirmDel(false)} />
        )}
      </React.Fragment>
    );
  }

  window.ProfileScreen = ProfileScreen;
})();

/* ── Override EnterWeightSheet with typeable input version ─────────────────
   Defined here (last Babel script) so it always wins over _ds_bundle.js.
   ────────────────────────────────────────────────────────────────────────── */
(function() {
  function EnterWeightSheet({ onClose }) {
    const { Button } = window.FoodVaultDesignSystem_fb9669;
    const [w,   setW]   = React.useState(150.8);
    const [raw, setRaw] = React.useState("150.8");
    const step = d => {
      const next = Math.round((w + d) * 10) / 10;
      setW(next); setRaw(next.toFixed(1));
    };
    const commit = () => {
      const n = parseFloat(raw);
      if (!isNaN(n) && n > 0) {
        const c = Math.round(Math.min(999, Math.max(1, n)) * 10) / 10;
        setW(c); setRaw(c.toFixed(1));
      } else { setRaw(w.toFixed(1)); }
    };
    return (
      <window.Sheet title="Enter weight" onClose={onClose}
        footer={<Button variant="primary" fullWidth onClick={onClose}>Save entry</Button>}>
        <div className="kit-weighin">
          <button className="kit-weighin__step" onClick={() => step(-0.2)} aria-label="Decrease">−</button>
          <div className="kit-weighin__val">
            <input className="kit-weighin__input"
              type="text" inputMode="decimal"
              value={raw}
              onChange={e => setRaw(e.target.value)}
              onFocus={e => e.target.select()}
              onBlur={commit} />
            <span>lb</span>
          </div>
          <button className="kit-weighin__step" onClick={() => step(0.2)} aria-label="Increase">＋</button>
        </div>
        <p className="kit-weighin__date">Today · Sunday, June 15</p>
      </window.Sheet>
    );
  }
  window.EnterWeightSheet = EnterWeightSheet;
})();
