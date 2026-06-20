import { useEffect, useState, type ReactNode } from "react";
import type { AmountUnit, PortionOption } from "../appSupport";
import "../styles/overlays.css";

// ── Sheet shell ──────────────────────────────────────────────────────────────

type SheetProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function Sheet({ title, onClose, children, footer }: SheetProps) {
  return (
    <div className="kit-overlay" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="kit-sheet" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <div className="kit-sheet__grab" />
        <div className="kit-sheet__head">
          <span className="kit-sheet__title">{title}</span>
          <button className="kit-sheet-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="kit-sheet__body">{children}</div>
        {footer && <div className="kit-sheet__footer">{footer}</div>}
      </div>
    </div>
  );
}

// ── Confirm dialog ───────────────────────────────────────────────────────────

type ConfirmDialogProps = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="kit-confirm" role="presentation" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="kit-confirm__box" role="dialog" aria-modal aria-labelledby="kit-confirm-title" onClick={(e) => e.stopPropagation()}>
        <p className="kit-confirm__title" id="kit-confirm-title">{title}</p>
        {message && <p className="kit-confirm__msg">{message}</p>}
        <div className="kit-confirm__actions">
          <button className="kit-btn kit-btn--secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className={`kit-btn ${danger ? "kit-btn--danger" : "kit-btn--primary"}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Streak celebration ───────────────────────────────────────────────────────

type StreakCelebrationProps = {
  from: number;
  to: number;
  onClose: () => void;
};

export function StreakCelebration({ from, to, onClose }: StreakCelebrationProps) {
  const [n, setN] = useState(from);
  const [bumped, setBumped] = useState(false);

  useEffect(() => {
    const bumpTimer = setTimeout(() => {
      setN(to);
      setBumped(true);
    }, 520);
    const closeTimer = setTimeout(onClose, 2600);
    return () => {
      clearTimeout(bumpTimer);
      clearTimeout(closeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="kit-streak" role="presentation" onClick={onClose}>
      <div className="kit-streak__box" onClick={(e) => e.stopPropagation()}>
        <span className="kit-streak__eyebrow">Day Logged</span>
        <div className="kit-streak__badge">
          <span className="kit-streak__ring" />
          <span className="kit-streak__ring kit-streak__ring--2" />
          <span key={n} className={`kit-streak__num${bumped ? " is-bumped" : ""}`}>{n}</span>
        </div>
        <span className="kit-streak__label">day streak</span>
        <p className="kit-streak__sub">{bumped ? "Keep the chain going." : "Locking in your day…"}</p>
      </div>
    </div>
  );
}

// ── Nutrition sheet ──────────────────────────────────────────────────────────

export type NutritionFood = {
  name: string;
  calories: number;
  serving: string;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export type NutritionUnitPicker = {
  amountUnit: AmountUnit;
  allowedAmountUnits: AmountUnit[];
  onAmountUnitChange: (unit: AmountUnit) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  portionOptions: PortionOption[];
  selectedPortionValue: string;
  onPortionChange: (value: string) => void;
  canAdd: boolean;
};

export type NutritionIngredientRow = {
  key: string | number;
  name: string;
  quantityLabel: string;
  calories: number;
  onClick: () => void;
};

export type NutritionMealPicker = {
  categories: string[];
  onAdd: (category: string, qty: string) => void;
};

export type NutritionAction = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

type NutritionSheetProps = {
  food: NutritionFood;
  meal?: string;
  mode?: "add" | "logged" | "view";
  initialQuantity?: string;
  unitPicker?: NutritionUnitPicker;
  ingredients?: NutritionIngredientRow[];
  mealPicker?: NutritionMealPicker;
  actions?: NutritionAction[];
  onAdd?: (qty: string) => void;
  onSave?: (qty: string) => void;
  onRemove?: () => void;
  onClose: () => void;
};

function clampQtyStr(s: string): string {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? s : "1";
}

export function NutritionSheet({
  food,
  meal,
  mode = "add",
  initialQuantity = "1",
  unitPicker,
  ingredients,
  mealPicker,
  actions,
  onAdd,
  onSave,
  onRemove,
  onClose,
}: NutritionSheetProps) {
  const [qtyStr, setQtyStr] = useState(initialQuantity || "1");
  const [confirming, setConfirming] = useState(false);

  const isUnitMode = Boolean(unitPicker && unitPicker.amountUnit !== "serving");
  const q = isUnitMode ? 1 : qtyStr === "" ? 0 : parseFloat(qtyStr) || 0;

  const hasMacros = food.protein != null && food.carbs != null && food.fat != null;
  const baseP = hasMacros ? food.protein! : Math.round((food.calories * 0.25) / 4);
  const baseC = hasMacros ? food.carbs!   : Math.round((food.calories * 0.5) / 4);
  const baseF = hasMacros ? food.fat!     : Math.round((food.calories * 0.25) / 9);

  const cal = Math.round(food.calories * q);
  const macros = [
    { label: "Protein", g: Math.round(baseP * q), kcal: baseP * q * 4, color: "var(--macro-protein)" },
    { label: "Carbs",   g: Math.round(baseC * q), kcal: baseC * q * 4, color: "var(--macro-carbs)" },
    { label: "Fat",     g: Math.round(baseF * q), kcal: baseF * q * 9, color: "var(--macro-fat)" },
  ];
  const maxKcal = Math.max(...macros.map((m) => m.kcal), 1);
  const logged = mode === "logged";
  const isView = mode === "view";
  const disableAdd = Boolean(unitPicker && !unitPicker.canAdd);

  const handleAction = () => {
    const qty = clampQtyStr(qtyStr);
    if (logged) onSave?.(qty);
    else onAdd?.(qty);
  };

  return (
    <>
      <Sheet
        title={food.name}
        onClose={onClose}
        footer={
          isView ? (
            (mealPicker || (actions && actions.length > 0)) && (
              <div style={{ display: "grid", gap: "0.6rem" }}>
                {actions && actions.length > 0 && (
                  <div className="kit-view-actions">
                    {actions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        className={action.danger ? "kit-btn kit-btn--danger" : "kit-btn kit-btn--secondary"}
                        onClick={action.onClick}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
                {mealPicker && (
                  <div className="kit-mealpicker">
                    <span className="kit-field__label">Add to today</span>
                    <div className="kit-mealpicker__grid">
                      {mealPicker.categories.map((category) => (
                        <button
                          key={category}
                          type="button"
                          className="kit-mealpicker__btn"
                          onClick={() => mealPicker.onAdd(category, clampQtyStr(qtyStr))}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            <div style={{ display: "grid", gap: "0.55rem" }}>
              <button className="kit-btn kit-btn--primary" onClick={handleAction} disabled={disableAdd}>
                {logged ? "Save changes" : `Add to ${meal ?? "log"}`}
              </button>
              {logged && onRemove && (
                <button className="kit-remove-link" onClick={() => setConfirming(true)}>
                  Remove from log
                </button>
              )}
            </div>
          )
        }
      >
        {logged && meal && <p className="kit-nutri-context">Logged in {meal}</p>}
        {!logged && meal && <p className="kit-nutri-context">{meal}</p>}

        <div className="kit-nutri-hero">
          <div>
            <span className="kit-nutri-cal">{cal.toLocaleString()}</span>
            <span className="kit-nutri-unit"> cal</span>
          </div>
          <span className="kit-nutri-serv">{food.serving}</span>
        </div>

        {unitPicker && unitPicker.allowedAmountUnits.length > 1 && (
          <div className="kit-unit-tabs" role="group" aria-label="Serving unit">
            {unitPicker.allowedAmountUnits.map((unit) => (
              <button
                key={unit}
                type="button"
                className={unitPicker.amountUnit === unit ? "is-active" : ""}
                onClick={() => unitPicker.onAmountUnitChange(unit)}
              >
                {unit === "serving" ? "Serving" : unit}
              </button>
            ))}
          </div>
        )}

        {unitPicker && !isUnitMode && unitPicker.portionOptions.length > 0 && (
          <label className="kit-qty kit-qty--select">
            <span className="kit-qty__label">Portion</span>
            <select
              value={unitPicker.selectedPortionValue}
              onChange={(e) => unitPicker.onPortionChange(e.target.value)}
            >
              {unitPicker.portionOptions.map((portion) => (
                <option key={portion.value} value={portion.value}>
                  {portion.label} ({portion.gramWeight}g)
                </option>
              ))}
            </select>
          </label>
        )}

        {isUnitMode ? (
          <div className="kit-qty">
            <span className="kit-qty__label">Amount</span>
            <div className="kit-qty__field">
              <input
                className="kit-qty__input"
                type="text"
                inputMode="decimal"
                value={unitPicker!.amount}
                aria-label="Amount"
                onChange={(e) => unitPicker!.onAmountChange(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
              />
              <span className="kit-qty__x">{unitPicker!.amountUnit}</span>
            </div>
          </div>
        ) : (
          <div className="kit-qty">
            <span className="kit-qty__label">Quantity</span>
            <div className="kit-qty__field">
              <input
                className="kit-qty__input"
                type="text"
                inputMode="decimal"
                value={qtyStr}
                aria-label="Quantity"
                onChange={(e) =>
                  setQtyStr(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))
                }
                onBlur={() => {
                  if (qtyStr === "" || parseFloat(qtyStr) <= 0) setQtyStr("1");
                }}
              />
              <span className="kit-qty__x">× serving</span>
            </div>
          </div>
        )}

        <div className="kit-nutri-macros">
          {macros.map((m) => (
            <div key={m.label} className="kit-nutri-row">
              <span className="kit-nutri-name" style={{ color: m.color }}>{m.label}</span>
              <div className="kit-nutri-track">
                <div className="kit-nutri-fill" style={{ width: `${(m.kcal / maxKcal) * 100}%`, background: m.color }} />
              </div>
              <span className="kit-nutri-g">{m.g} g</span>
            </div>
          ))}
        </div>

        <div className="kit-nutri-grid">
          <div><span>Fiber</span><strong>{Math.round(cal * 0.012)} g</strong></div>
          <div><span>Sugar</span><strong>{Math.round(cal * 0.03)} g</strong></div>
          <div><span>Sodium</span><strong>{Math.round(cal * 0.6)} mg</strong></div>
          <div>
            <span>{isUnitMode ? "Amount" : "Serving"}</span>
            <strong>
              {isUnitMode ? `${unitPicker!.amount} ${unitPicker!.amountUnit}` : `${qtyStr === "" ? "0" : qtyStr}×`}
            </strong>
          </div>
        </div>

        {ingredients && ingredients.length > 0 && (
          <div className="kit-ingredient-list">
            <span className="kit-field__label">Ingredients</span>
            {ingredients.map((row) => (
              <button key={row.key} type="button" className="kit-ingredient-row" onClick={row.onClick}>
                <span>{row.name}</span>
                <span>{row.quantityLabel}</span>
                <span>{row.calories} cal</span>
              </button>
            ))}
          </div>
        )}
      </Sheet>

      {confirming && (
        <ConfirmDialog
          title="Remove from log?"
          message={`"${food.name}" will be removed from ${meal ?? "log"}.`}
          confirmLabel="Remove"
          danger
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onRemove?.();
          }}
        />
      )}
    </>
  );
}

// ── Weight entry sheet ───────────────────────────────────────────────────────

type EnterWeightSheetProps = {
  initialWeight: string;
  unit?: string;
  dateLabel?: string;
  onSave: (weight: string) => void;
  onClose: () => void;
};

export function EnterWeightSheet({
  initialWeight,
  unit = "lbs",
  dateLabel,
  onSave,
  onClose,
}: EnterWeightSheetProps) {
  const [raw, setRaw] = useState(initialWeight || "");
  const w = parseFloat(raw) || 0;

  const step = (delta: number) => {
    const next = Math.round((w + delta) * 10) / 10;
    const clamped = Math.min(999, Math.max(1, next));
    setRaw(clamped.toFixed(1));
  };

  const commit = () => {
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) {
      const clamped = Math.round(Math.min(999, Math.max(1, n)) * 10) / 10;
      setRaw(clamped.toFixed(1));
    } else {
      setRaw(w > 0 ? w.toFixed(1) : "");
    }
  };

  const canSave = parseFloat(raw) > 0;

  return (
    <Sheet
      title="Enter weight"
      onClose={onClose}
      footer={
        <button className="kit-btn kit-btn--primary" disabled={!canSave} onClick={() => canSave && onSave(raw)}>
          Save entry
        </button>
      }
    >
      <div className="kit-weighin">
        <button className="kit-weighin__step" onClick={() => step(-0.2)} aria-label="Decrease">−</button>
        <div className="kit-weighin__val">
          <input
            className="kit-weighin__input"
            type="text"
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commit}
            autoFocus
          />
          <span>{unit}</span>
        </div>
        <button className="kit-weighin__step" onClick={() => step(0.2)} aria-label="Increase">＋</button>
      </div>
      {dateLabel && <p className="kit-weighin__date">{dateLabel}</p>}
    </Sheet>
  );
}

// ── Cycle log sheet ──────────────────────────────────────────────────────────

export type CycleLogSheetSaveData = {
  flow: string | null;
  symptoms: string[];
  lhTest: string | null;
  note: string;
  sex: boolean;
};

type CycleLogSheetExistingLogs = {
  flow?: string | null;
  symptoms?: string[];
  lhTest?: string | null;
  note?: string;
  sex?: boolean;
};

type CycleLogSheetProps = {
  day: number;
  monthName: string;
  cycleDay?: number;
  dayContext?: string;
  isPeriodLogged: boolean;
  existingLogs?: CycleLogSheetExistingLogs;
  onTogglePeriod: (on: boolean) => void;
  onSave: (data: CycleLogSheetSaveData) => void;
  onClose: () => void;
};

const SYMPTOM_LIST = ["Cramps", "Headache", "Bloating", "Fatigue", "Low mood", "Acne", "Cravings", "Tender"];
const FLOW_OPTS = ["Spotting", "Light", "Medium", "Heavy"];
const LH_OPTS = ["Negative", "Low", "High", "Peak"];

export function CycleLogSheet({
  day,
  monthName,
  cycleDay,
  dayContext,
  isPeriodLogged,
  existingLogs = {},
  onTogglePeriod,
  onSave,
  onClose,
}: CycleLogSheetProps) {
  const [periodOn, setPeriodOn] = useState(isPeriodLogged);
  const [flow, setFlow] = useState<string | null>(existingLogs.flow ?? null);
  const [symptoms, setSymptoms] = useState<string[]>(existingLogs.symptoms ?? []);
  const [lhTest, setLhTest] = useState<string | null>(existingLogs.lhTest ?? null);
  const [note, setNote] = useState(existingLogs.note ?? "");
  const [sex, setSex] = useState(existingLogs.sex ?? false);
  const [expanded, setExpanded] = useState<"symptom" | "lh" | "note" | null>(null);

  function toggleSym(s: string) {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function toggleExpanded(key: "symptom" | "lh" | "note") {
    setExpanded((prev) => (prev === key ? null : key));
  }

  function handleSave() {
    onTogglePeriod(periodOn);
    onSave({ flow: periodOn ? flow : null, symptoms, lhTest, note, sex });
    onClose();
  }

  const ctxColor =
    dayContext?.startsWith("Estimated") ? "var(--accent)"
    : dayContext === "Period logged" ? "var(--cycle-period)"
    : "var(--text-muted)";

  return (
    <div className="kit-overlay" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="kit-sheet" style={{ gap: "0.7rem" }} role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <div className="kit-sheet__grab" />

        <div className="kit-sheet__head">
          <div>
            <div className="kit-cycle-date">{monthName} {day}</div>
            <div className="kit-cycle-meta">
              {cycleDay != null && <span>Cycle day {cycleDay}</span>}
              {dayContext && <span style={{ color: ctxColor }}>{dayContext}</span>}
            </div>
          </div>
          <button className="kit-sheet-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="kit-sheet__body">
          <div className="kit-cycle-actions">

            {/* Period + flow */}
            <div className="kit-cycle-group">
              <button
                className={`kit-cycle-action kit-cycle-action--period${periodOn ? " is-on is-open" : ""}`}
                onClick={() => setPeriodOn((p) => !p)}
              >
                <span className="kit-cycle-action__dot" style={{ background: "var(--cycle-period)" }} />
                <span className="kit-cycle-action__lbl">
                  {periodOn ? (flow ? `Period · ${flow} flow` : "Period logged") : "Log period"}
                </span>
                {periodOn && <span className="kit-cycle-action__check">✓</span>}
              </button>
              {periodOn && (
                <div className="kit-cycle-sub">
                  <div className="kit-cycle-sub__lbl">Flow</div>
                  <div className="kit-chiprow kit-chiprow--wrap">
                    {FLOW_OPTS.map((f) => (
                      <button
                        key={f}
                        className={`kit-pick kit-pick--flow${flow === f ? " is-on" : ""}`}
                        onClick={(e) => { e.stopPropagation(); setFlow(flow === f ? null : f); }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Symptoms */}
            <div className="kit-cycle-group">
              <button
                className={`kit-cycle-action${symptoms.length ? " is-on" : ""}${expanded === "symptom" ? " is-open" : ""}`}
                onClick={() => toggleExpanded("symptom")}
              >
                <span className="kit-cycle-action__dot" style={{ background: "var(--macro-carbs)" }} />
                <span className="kit-cycle-action__lbl">
                  {symptoms.length ? `${symptoms.length} symptom${symptoms.length > 1 ? "s" : ""} logged` : "Add symptom"}
                </span>
                <span className="kit-cycle-action__chev">{expanded === "symptom" ? "↑" : "›"}</span>
              </button>
              {expanded === "symptom" && (
                <div className="kit-cycle-sub">
                  <div className="kit-chiprow kit-chiprow--wrap">
                    {SYMPTOM_LIST.map((s) => (
                      <button
                        key={s}
                        className={`kit-pick${symptoms.includes(s) ? " is-on" : ""}`}
                        onClick={(e) => { e.stopPropagation(); toggleSym(s); }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* LH test */}
            <div className="kit-cycle-group">
              <button
                className={`kit-cycle-action${lhTest ? " is-on" : ""}${expanded === "lh" ? " is-open" : ""}`}
                onClick={() => toggleExpanded("lh")}
              >
                <span className="kit-cycle-action__dot" style={{ background: "var(--cycle-ovulation)" }} />
                <span className="kit-cycle-action__lbl">
                  {lhTest ? `LH: ${lhTest}` : "Add LH test"}
                </span>
                <span className="kit-cycle-action__chev">{expanded === "lh" ? "↑" : "›"}</span>
              </button>
              {expanded === "lh" && (
                <div className="kit-cycle-sub">
                  <div className="kit-chiprow">
                    {LH_OPTS.map((v) => (
                      <button
                        key={v}
                        className={`kit-pick${lhTest === v ? " is-on" : ""}`}
                        onClick={(e) => { e.stopPropagation(); setLhTest(lhTest === v ? null : v); }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Note */}
            <div className="kit-cycle-group">
              <button
                className={`kit-cycle-action${note ? " is-on" : ""}${expanded === "note" ? " is-open" : ""}`}
                onClick={() => toggleExpanded("note")}
              >
                <span className="kit-cycle-action__dot" style={{ background: "var(--text-secondary)" }} />
                <span className="kit-cycle-action__lbl">
                  {note ? `Note · ${note.slice(0, 20)}${note.length > 20 ? "…" : ""}` : "Add note"}
                </span>
                <span className="kit-cycle-action__chev">{expanded === "note" ? "↑" : "›"}</span>
              </button>
              {expanded === "note" && (
                <div className="kit-cycle-sub">
                  <textarea
                    className="kit-cycle-textarea"
                    placeholder="How are you feeling?"
                    value={note}
                    rows={3}
                    onChange={(e) => setNote(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
            </div>

            {/* Sex */}
            <button
              className={`kit-cycle-action kit-cycle-action--sex${sex ? " is-on" : ""}`}
              onClick={() => setSex((s) => !s)}
            >
              <span className="kit-cycle-action__dot" style={{ background: "var(--macro-fat)" }} />
              <span className="kit-cycle-action__lbl">{sex ? "Sex logged" : "Log sex"}</span>
              {sex && <span className="kit-cycle-action__check">✓</span>}
            </button>

          </div>
        </div>

        <div className="kit-sheet__footer">
          <button className="kit-btn kit-btn--primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
