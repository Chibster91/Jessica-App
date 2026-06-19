import { useCallback, useEffect, useRef, useState } from "react";
import "../styles/overlays.css";
import {
  createNegativeFoodId,
  parseCustomFood,
  type CustomFoodForm,
  type Food,
  type Recipe,
} from "../appSupport";

// ── Shared helpers ──────────────────────────────────────────────

function parseServingField(s: string): { servingSize: string; servingUnit: string } {
  const trimmed = s.trim() || "1 serving";
  // "150g" → { servingSize: "150", servingUnit: "g" }
  const compact = trimmed.match(/^(\d+(?:\.\d+)?)([a-zA-Z].*)$/);
  if (compact) return { servingSize: compact[1], servingUnit: compact[2] };
  // "1 bowl · 320g" → { servingSize: "1", servingUnit: "bowl · 320g" }
  const spaced = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.*)/);
  if (spaced) return { servingSize: spaced[1], servingUnit: spaced[2].trim() || "serving" };
  return { servingSize: "1", servingUnit: trimmed };
}

// ── Types ───────────────────────────────────────────────────────

export type PrefillData = {
  name?: string;
  serving?: string;
  calories?: number;
  protein?: string;
  carbs?: string;
  fat?: string;
};

type LibraryManualEntryProps = {
  kind?: "food" | "recipe";
  prefill?: PrefillData | null;
  onSaveFood: (food: Food) => void;
  onSaveRecipe: (recipe: Recipe) => void;
  onClose: () => void;
  onBack?: () => void;
};

type LibraryBarcodeScanProps = {
  onSaveFood: (food: Food) => void;
  onClose: () => void;
  onBack?: () => void;
  onManual: () => void;
};

type LibraryUrlImportProps = {
  onClose: () => void;
  onBack?: () => void;
};

// ── Mock barcode lookup ─────────────────────────────────────────

const BARCODE_DB: Record<string, PrefillData> = {
  "0123456789012": { name: "Chobani Greek Yogurt", serving: "1 container · 150g", calories: 120, protein: "15", carbs: "9", fat: "0" },
  "0049000000443": { name: "Clif Bar — Chocolate", serving: "1 bar · 68g", calories: 250, protein: "9", carbs: "44", fat: "6" },
};

function lookupBarcode(code: string): PrefillData {
  return BARCODE_DB[code] ?? { name: "Scanned product", serving: "1 serving", calories: 180, protein: "6", carbs: "24", fat: "5" };
}

// ── LibraryManualEntry ──────────────────────────────────────────

export function LibraryManualEntry({
  kind = "food",
  prefill = null,
  onSaveFood,
  onSaveRecipe,
  onClose,
  onBack,
}: LibraryManualEntryProps) {
  const isRecipe = kind === "recipe";
  const back = onBack ?? onClose;

  const [name, setName] = useState(prefill?.name ?? "");
  const [serving, setServing] = useState(prefill?.serving ?? "");
  const [cal, setCal] = useState(prefill?.calories != null ? String(prefill.calories) : "");
  const [protein, setProtein] = useState(prefill?.protein ?? "");
  const [carbs, setCarbs] = useState(prefill?.carbs ?? "");
  const [fat, setFat] = useState(prefill?.fat ?? "");
  const [ingredients, setIngredients] = useState([{ name: "", amount: "" }]);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const canSave = name.trim() !== "" && (isRecipe || cal.trim() !== "");

  function setIng(i: number, key: "name" | "amount", val: string) {
    setIngredients((list) => list.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)));
  }
  const addIng = () => setIngredients((list) => [...list, { name: "", amount: "" }]);
  const removeIng = (i: number) => setIngredients((list) => list.filter((_, idx) => idx !== i));

  function save() {
    if (!canSave) return;
    setSaveError("");

    if (isRecipe) {
      const p = parseFloat(protein) || 0;
      const c = parseFloat(carbs) || 0;
      const f = parseFloat(fat) || 0;
      const calories = Math.round(p * 4 + c * 4 + f * 9);
      const rawName = name.trim();
      const recipeName = rawName.endsWith("- Recipe") ? rawName : `${rawName} - Recipe`;
      const recipe: Recipe = {
        id: createNegativeFoodId(),
        name: recipeName,
        brand: "Recipe",
        servingSize: serving.trim() || "1 serving",
        calories,
        protein: p,
        carbs: c,
        fat: f,
        fiber: 0,
        sugar: 0,
        sodium: 0,
        ingredients: [],
      };
      onSaveRecipe(recipe);
    } else {
      const { servingSize, servingUnit } = parseServingField(serving);
      const form: CustomFoodForm = {
        name: name.trim(),
        brand: "",
        servingSize,
        servingUnit,
        calories: cal,
        protein: protein || "0",
        carbs: carbs || "0",
        fat: fat || "0",
        fiber: "",
        sugar: "",
        sodium: "",
        notes: "",
      };
      const food = parseCustomFood(form);
      if (!food) {
        setSaveError("Check your entry — make sure name, serving size, and calories are filled in.");
        return;
      }
      onSaveFood(food);
    }

    setSaved(true);
    setTimeout(onClose, 950);
  }

  if (saved) {
    return (
      <div className="kit-addfood">
        <div className="kit-form-success">
          <div className="kit-form-success__mark">✓</div>
          <p className="kit-form-success__title">{isRecipe ? "Recipe saved" : "Food saved"}</p>
          <p className="kit-form-success__sub">"{name}" added to your library</p>
        </div>
      </div>
    );
  }

  const macros: Array<[string, string, (v: string) => void]> = [
    ["Protein", protein, setProtein],
    ["Carbs", carbs, setCarbs],
    ["Fat", fat, setFat],
  ];

  return (
    <div className="kit-addfood">
      <div className="kit-addfood__top">
        <div className="kit-addfood__bar">
          <div className="kit-addfood__bar-left">
            <button className="kit-icon-btn" aria-label="Back" onClick={back}>‹</button>
            <span className="kit-addfood__title">{isRecipe ? "New recipe" : "New food"}</span>
          </div>
          <button className="kit-icon-btn kit-icon-btn--ghost" aria-label="Close" onClick={onClose}>×</button>
        </div>
      </div>

      <div className="kit-addfood__body">
        <div className="kit-field">
          <span className="kit-field__label">{isRecipe ? "Recipe name" : "Food name"}</span>
          <input
            className="kit-input"
            placeholder={isRecipe ? "e.g. Veggie chili" : "e.g. Mom's chili"}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="kit-field">
          <span className="kit-field__label">{isRecipe ? "Makes (servings)" : "Serving size"}</span>
          <input
            className="kit-input"
            placeholder={isRecipe ? "e.g. 4 bowls" : "e.g. 1 bowl · 320g"}
            value={serving}
            onChange={(e) => setServing(e.target.value)}
          />
        </div>

        {isRecipe ? (
          <div className="kit-field">
            <span className="kit-field__label">Ingredients</span>
            <div className="kit-ing-list">
              {ingredients.map((row, i) => (
                <div className="kit-ing-row" key={i}>
                  <input
                    className="kit-ing-input"
                    placeholder="Ingredient"
                    value={row.name}
                    onChange={(e) => setIng(i, "name", e.target.value)}
                  />
                  <input
                    className="kit-ing-input"
                    placeholder="Amount"
                    value={row.amount}
                    onChange={(e) => setIng(i, "amount", e.target.value)}
                  />
                  <button
                    className="kit-ing-del"
                    aria-label="Remove ingredient"
                    onClick={() => removeIng(i)}
                    disabled={ingredients.length === 1}
                  >×</button>
                </div>
              ))}
            </div>
            <button className="kit-form-add" onClick={addIng}>+ Add ingredient</button>
          </div>
        ) : (
          <div className="kit-field">
            <span className="kit-field__label">Calories</span>
            <input
              className="kit-input"
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={cal}
              onChange={(e) => setCal(e.target.value)}
            />
          </div>
        )}

        <div className="kit-field">
          <span className="kit-field__label">
            Macros{isRecipe ? " (per serving)" : ""}
            {" "}<span className="kit-field__muted">· optional</span>
          </span>
          <div className="kit-form-macros">
            {macros.map(([lbl, val, set]) => (
              <label className="kit-form-macro" key={lbl}>
                <span>{lbl}</span>
                <div className="kit-form-macro__field">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                  />
                  <i>g</i>
                </div>
              </label>
            ))}
          </div>
        </div>

        {saveError && (
          <p style={{ color: "var(--color-danger, #f87171)", fontSize: "0.84rem", margin: 0 }}>
            {saveError}
          </p>
        )}
      </div>

      <div className="kit-addfood__foot">
        <button
          className="kit-btn kit-btn--primary"
          style={{ width: "100%" }}
          disabled={!canSave}
          onClick={save}
        >
          {isRecipe ? "Save recipe" : "Save food"}
        </button>
      </div>
    </div>
  );
}

// ── LibraryBarcodeScan ──────────────────────────────────────────

export function LibraryBarcodeScan({ onSaveFood, onClose, onBack, onManual }: LibraryBarcodeScanProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const back = onBack ?? onClose;
  const [status, setStatus] = useState<"starting" | "scanning" | "denied" | "found">("starting");
  const [manualCode, setManualCode] = useState("");
  const [found, setFound] = useState<PrefillData | null>(null);

  const handleCode = useCallback((code: string) => {
    setFound(lookupBarcode(code));
    setStatus("found");
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setStatus("denied");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        setStatus("scanning");

        if ("BarcodeDetector" in window) {
          const detector = new (window as unknown as { BarcodeDetector: new (opts: object) => { detect: (el: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
          });
          const tick = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes?.length) { handleCode(codes[0].rawValue); return; }
            } catch { /* frame not ready */ }
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }
      } catch {
        if (!cancelled) setStatus("denied");
      }
    }

    start();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [handleCode]);

  if (status === "found" && found) {
    return (
      <LibraryManualEntry
        kind="food"
        prefill={found}
        onSaveFood={onSaveFood}
        onSaveRecipe={() => {}}
        onClose={onClose}
        onBack={() => { setFound(null); setStatus("starting"); }}
      />
    );
  }

  const submitManual = () => { if (manualCode.trim()) handleCode(manualCode.trim()); };

  return (
    <div className="kit-addfood">
      <div className="kit-addfood__top">
        <div className="kit-addfood__bar">
          <div className="kit-addfood__bar-left">
            <button className="kit-icon-btn" aria-label="Back" onClick={back}>‹</button>
            <span className="kit-addfood__title">Scan barcode</span>
          </div>
          <button className="kit-icon-btn kit-icon-btn--ghost" aria-label="Close" onClick={onClose}>×</button>
        </div>
      </div>

      <div className="kit-bc">
        <div className="kit-bc__view">
          <video ref={videoRef} className="kit-bc__video" playsInline muted />
          {status !== "scanning" && (
            <div className="kit-bc__placeholder">
              <div className="kit-bc__placeholder-icon">▦</div>
              <p className="kit-bc__placeholder-text">
                {status === "denied" ? "Camera unavailable" : "Starting camera…"}
              </p>
              {status === "denied" && (
                <p className="kit-bc__placeholder-sub">
                  Enter the barcode below or simulate a scan
                </p>
              )}
            </div>
          )}
          <div className="kit-bc__reticle">
            <span className="kit-bc__corner tl" />
            <span className="kit-bc__corner tr" />
            <span className="kit-bc__corner bl" />
            <span className="kit-bc__corner br" />
            {status === "scanning" && <span className="kit-bc__line" />}
          </div>
        </div>

        <p className="kit-bc__hint">
          {status === "scanning"
            ? "Point the camera at a barcode"
            : "Point at a barcode to look it up automatically"}
        </p>

        <div className="kit-bc__manual">
          <input
            className="kit-input"
            placeholder="Enter barcode number"
            inputMode="numeric"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitManual()}
          />
          <button
            className="kit-btn kit-btn--secondary"
            onClick={submitManual}
            disabled={!manualCode.trim()}
          >
            Look up
          </button>
        </div>

        <div className="kit-bc__alt">
          <button className="kit-bc__sim" onClick={() => handleCode("0123456789012")}>
            Simulate scan
          </button>
          <span className="kit-bc__dot">·</span>
          <button className="kit-bc__sim" onClick={onManual}>
            Enter manually instead
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LibraryUrlImport ────────────────────────────────────────────

export function LibraryUrlImport({ onClose, onBack }: LibraryUrlImportProps) {
  const back = onBack ?? onClose;
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function importUrl() {
    if (!url.trim() || loading) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
      setTimeout(onClose, 950);
    }, 1100);
  }

  if (done) {
    return (
      <div className="kit-addfood">
        <div className="kit-form-success">
          <div className="kit-form-success__mark">✓</div>
          <p className="kit-form-success__title">Recipe imported</p>
          <p className="kit-form-success__sub">Parsed ingredients &amp; nutrition added</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kit-addfood">
      <div className="kit-addfood__top">
        <div className="kit-addfood__bar">
          <div className="kit-addfood__bar-left">
            <button className="kit-icon-btn" aria-label="Back" onClick={back}>‹</button>
            <span className="kit-addfood__title">Import from URL</span>
          </div>
          <button className="kit-icon-btn kit-icon-btn--ghost" aria-label="Close" onClick={onClose}>×</button>
        </div>
      </div>

      <div className="kit-addfood__body">
        <p style={{ color: "var(--text-secondary)", fontSize: "0.86rem", lineHeight: 1.5, margin: 0 }}>
          Paste a link to any recipe page. We'll pull the ingredients, steps, and nutrition automatically.
        </p>
        <div className="kit-field">
          <span className="kit-field__label">Recipe URL</span>
          <input
            className="kit-input"
            placeholder="https://…"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && importUrl()}
          />
        </div>
        <button
          className="kit-btn kit-btn--primary"
          style={{ width: "100%" }}
          disabled={!url.trim() || loading}
          onClick={importUrl}
        >
          {loading ? "Importing…" : "Import recipe"}
        </button>
      </div>
    </div>
  );
}
