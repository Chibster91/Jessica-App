import { useCallback, useEffect, useRef, useState } from "react";
import "../styles/overlays.css";
import {
  createNegativeFoodId,
  fetchProductByBarcode,
  getAmountUnitsForFood,
  getRecipeTotals,
  importRecipeFromUrl,
  ingredientServingsFromAmount,
  matchIngredientToFoods,
  parseCustomFood,
  parseIngredientAmount,
  parseRecipe,
  parseRecipeScreenshotText,
  recipeIngredientSearchTerm,
  type AmountUnit,
  type CustomFoodForm,
  type Food,
  type PrefillData,
  type Recipe,
  type RecipeIngredient,
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
  onSaveRecipe: (recipe: Recipe) => void;
  onClose: () => void;
  onBack?: () => void;
};

type LibraryPhotoImportProps = {
  customFoods: Food[];
  onSaveRecipe: (recipe: Recipe) => void;
  onClose: () => void;
  onBack?: () => void;
};

type IngredientRow = {
  id: string;
  line: string;
  candidates: Food[];
  selectedId: number | null;
  amount: string;
  unit: AmountUnit;
  searchQuery: string;
  searching: boolean;
};

function formatAmount(n: number): string {
  return String(Math.round(n * 100) / 100);
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
  const [status, setStatus] = useState<"starting" | "scanning" | "denied" | "looking-up" | "found" | "not-found">("starting");
  const [manualCode, setManualCode] = useState("");
  const [found, setFound] = useState<PrefillData | null>(null);
  const [lastCode, setLastCode] = useState("");

  const handleCode = useCallback(async (code: string) => {
    setLastCode(code);
    setStatus("looking-up");
    try {
      const product = await fetchProductByBarcode(code);
      if (product) {
        setFound(product);
        setStatus("found");
      } else {
        setStatus("not-found");
      }
    } catch {
      setStatus("not-found");
    }
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

  if (status === "not-found") {
    return (
      <div className="kit-addfood">
        <div className="kit-addfood__top">
          <div className="kit-addfood__bar">
            <div className="kit-addfood__bar-left">
              <button className="kit-icon-btn" aria-label="Back" onClick={() => { setStatus("starting"); setManualCode(""); }}>‹</button>
              <span className="kit-addfood__title">No match</span>
            </div>
            <button className="kit-icon-btn kit-icon-btn--ghost" aria-label="Close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="kit-addfood__body">
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.5, margin: 0 }}>
            We couldn't find a product for barcode <strong>{lastCode}</strong>. You can scan again or add it by hand.
          </p>
          <button className="kit-btn kit-btn--secondary" style={{ width: "100%" }} onClick={() => { setStatus("starting"); setManualCode(""); }}>
            Scan another
          </button>
          <button className="kit-btn kit-btn--primary" style={{ width: "100%" }} onClick={onManual}>
            Add manually
          </button>
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
                {status === "denied" ? "Camera unavailable" : status === "looking-up" ? "Looking up…" : "Starting camera…"}
              </p>
              {status === "denied" && (
                <p className="kit-bc__placeholder-sub">
                  Enter the barcode below to look it up
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
            disabled={!manualCode.trim() || status === "looking-up"}
          >
            {status === "looking-up" ? "Looking up…" : "Look up"}
          </button>
        </div>

        <div className="kit-bc__alt">
          <button className="kit-bc__sim" onClick={onManual}>
            Enter manually instead
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LibraryUrlImport ────────────────────────────────────────────

export function LibraryUrlImport({ onSaveRecipe, onClose, onBack }: LibraryUrlImportProps) {
  const back = onBack ?? onClose;
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ name: string; ingredientCount: number } | null>(null);
  const [error, setError] = useState("");

  async function importUrl() {
    if (!url.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const imported = await importRecipeFromUrl(url.trim());
      const p = imported.protein || 0;
      const c = imported.carbs || 0;
      const f = imported.fat || 0;
      const calories = imported.calories || Math.round(p * 4 + c * 4 + f * 9);
      const rawName = imported.name.trim() || "Imported recipe";
      const recipeName = rawName.endsWith("- Recipe") ? rawName : `${rawName} - Recipe`;
      const noteParts: string[] = [];
      if (imported.servings) noteParts.push(`Makes ${imported.servings}.`);
      if (imported.ingredients.length) {
        noteParts.push(`Ingredients:\n${imported.ingredients.map((i) => `• ${i}`).join("\n")}`);
      }
      noteParts.push(`Imported from ${url.trim()}`);
      const recipe: Recipe = {
        id: createNegativeFoodId(),
        name: recipeName,
        brand: "Recipe",
        servingSize: "1 serving",
        calories,
        protein: p,
        carbs: c,
        fat: f,
        fiber: 0,
        sugar: 0,
        sodium: 0,
        notes: noteParts.join("\n\n"),
        ingredients: [],
      };
      onSaveRecipe(recipe);
      setLoading(false);
      setDone({ name: rawName, ingredientCount: imported.ingredients.length });
      setTimeout(onClose, 1100);
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : "Could not import that recipe.");
    }
  }

  if (done) {
    return (
      <div className="kit-addfood">
        <div className="kit-form-success">
          <div className="kit-form-success__mark">✓</div>
          <p className="kit-form-success__title">Recipe imported</p>
          <p className="kit-form-success__sub">
            {done.ingredientCount > 0
              ? `${done.name} · ${done.ingredientCount} ingredients`
              : done.name}
          </p>
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
          Paste a link to a recipe page. We'll pull the name, ingredients, and nutrition automatically.
        </p>
        <div className="kit-field">
          <span className="kit-field__label">Recipe URL</span>
          <input
            className="kit-input"
            placeholder="https://…"
            inputMode="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && importUrl()}
          />
        </div>
        {error && (
          <p style={{ color: "var(--danger, #d33)", fontSize: "0.82rem", margin: 0 }}>{error}</p>
        )}
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

// ── LibraryPhotoImport ──────────────────────────────────────────

export function LibraryPhotoImport({ customFoods, onSaveRecipe, onClose, onBack }: LibraryPhotoImportProps) {
  const back = onBack ?? onClose;
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "edit" | "matching" | "review">("idle");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [draftText, setDraftText] = useState("");
  const [rows, setRows] = useState<IngredientRow[]>([]);

  async function handleFile(file: File) {
    setStatus("scanning");
    setError("");
    try {
      const { recognize } = await import("tesseract.js");
      const result = await recognize(file, "eng");
      const parsed = parseRecipeScreenshotText(result.data.text);
      setName(parsed.name);
      setDraftText(parsed.ingredients.join("\n"));
      setStatus("edit");
    } catch {
      setError("Couldn't read that image. Try a clearer screenshot, or add the recipe by hand.");
      setStatus("idle");
    }
  }

  async function matchIngredients() {
    const lines = draftText.split("\n").map((l) => l.trim()).filter(Boolean);
    setStatus("matching");
    const built = await Promise.all(
      lines.map(async (line, i): Promise<IngredientRow> => {
        const candidates = await matchIngredientToFoods(recipeIngredientSearchTerm(line), customFoods);
        const parsedAmount = parseIngredientAmount(line);
        return {
          id: `ing-${i}`,
          line,
          candidates,
          selectedId: candidates[0]?.id ?? null,
          amount: parsedAmount ? formatAmount(parsedAmount.amount) : "1",
          unit: parsedAmount?.unit ?? "serving",
          searchQuery: "",
          searching: false,
        };
      })
    );
    setRows(built);
    setStatus("review");
  }

  function updateRow(id: string, patch: Partial<IngredientRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function searchRow(row: IngredientRow) {
    const query = row.searchQuery.trim();
    if (!query) return;
    updateRow(row.id, { searching: true });
    const candidates = await matchIngredientToFoods(query, customFoods);
    updateRow(row.id, { candidates, selectedId: candidates[0]?.id ?? null, searching: false });
  }

  const selectedIngredients: RecipeIngredient[] = rows
    .map((row) => {
      const food = row.candidates.find((c) => c.id === row.selectedId);
      if (!food) return null;
      const amount = parseFloat(row.amount) || 0;
      const quantity = ingredientServingsFromAmount(food, amount, row.unit) ?? amount;
      return { food, quantity };
    })
    .filter((i): i is RecipeIngredient => i !== null);

  const totals = getRecipeTotals(selectedIngredients);
  const matchedCount = selectedIngredients.length;

  function save() {
    const skipped = rows.filter((row) => row.selectedId === null).map((row) => row.line);
    const notes = skipped.length ? `Couldn't match:\n${skipped.map((l) => `• ${l}`).join("\n")}` : "";

    if (selectedIngredients.length > 0) {
      const recipe = parseRecipe(
        { name: name.trim() || "Imported recipe", servingSize: "1", servingUnit: "serving", notes },
        selectedIngredients
      );
      if (recipe) { onSaveRecipe(recipe); return; }
    }

    // No matched ingredients — save a shell recipe with the lines kept as notes.
    const allLines = rows.map((row) => row.line);
    onSaveRecipe({
      id: createNegativeFoodId(),
      name: (name.trim() || "Imported recipe").endsWith("- Recipe") ? name.trim() : `${name.trim() || "Imported recipe"} - Recipe`,
      brand: "Recipe",
      servingSize: "1 serving",
      calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0,
      notes: allLines.length ? `Ingredients:\n${allLines.map((l) => `• ${l}`).join("\n")}` : undefined,
      ingredients: [],
    });
  }

  return (
    <div className="kit-addfood">
      <div className="kit-addfood__top">
        <div className="kit-addfood__bar">
          <div className="kit-addfood__bar-left">
            <button className="kit-icon-btn" aria-label="Back" onClick={back}>‹</button>
            <span className="kit-addfood__title">Import from screenshot</span>
          </div>
          <button className="kit-icon-btn kit-icon-btn--ghost" aria-label="Close" onClick={onClose}>×</button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      {(status === "idle" || status === "scanning") && (
        <div className="kit-addfood__body">
          <p className="kit-photo-hint">
            Take a screenshot of a recipe and pick it here. We'll read it on your device, then let you tidy up the ingredients before matching them to foods.
          </p>
          {error && <p className="kit-photo-error">{error}</p>}
          <button
            className="kit-btn kit-btn--primary kit-btn--block"
            disabled={status === "scanning"}
            onClick={() => fileRef.current?.click()}
          >
            {status === "scanning" ? "Reading screenshot…" : "Choose screenshot"}
          </button>
        </div>
      )}

      {(status === "edit" || status === "matching") && (
        <div className="kit-addfood__body">
          <div className="kit-field">
            <span className="kit-field__label">Recipe name</span>
            <input className="kit-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipe name" />
          </div>
          <div className="kit-field">
            <span className="kit-field__label">Ingredients <span className="kit-field__muted">(one per line)</span></span>
            <p className="kit-photo-hint">
              Clean up anything the scan got wrong — fix typos, delete junk lines, simplify names (e.g. "Granny Smith apples" → "apples"). Then match them to foods.
            </p>
            <textarea
              className="kit-input kit-photo-textarea"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder={"2 1/4 lbs apples\n1 1/2 tsp cinnamon\n8 Tbsp butter\n…"}
            />
          </div>
          <button
            className="kit-btn kit-btn--primary kit-btn--block"
            disabled={status === "matching" || !draftText.trim()}
            onClick={matchIngredients}
          >
            {status === "matching" ? "Matching…" : "Match ingredients →"}
          </button>
          <button className="kit-btn kit-btn--secondary kit-btn--block" onClick={() => { setStatus("idle"); setDraftText(""); setError(""); }}>
            Try another screenshot
          </button>
        </div>
      )}

      {status === "review" && (
        <div className="kit-addfood__body">
          <div className="kit-field">
            <span className="kit-field__label">Recipe name</span>
            <input className="kit-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipe name" />
          </div>

          <p className="kit-photo-hint">
            Each ingredient is matched to a food. Pick a different match, set the amount, or skip ones we got wrong. The amount is in <strong>servings of the matched food</strong> — the line under each shows what that works out to.
          </p>

          {rows.length === 0 && (
            <p className="kit-photo-hint">No ingredients to match.</p>
          )}

          {rows.map((row) => {
            const selected = row.candidates.find((c) => c.id === row.selectedId) ?? null;
            const amount = parseFloat(row.amount) || 0;
            const servings = selected ? (ingredientServingsFromAmount(selected, amount, row.unit) ?? amount) : 0;
            const rowCal = selected ? Math.round(selected.calories * servings) : 0;
            const unitOptions = selected
              ? (getAmountUnitsForFood(selected).includes(row.unit)
                  ? getAmountUnitsForFood(selected)
                  : [row.unit, ...getAmountUnitsForFood(selected)])
              : [];
            return (
              <div key={row.id} className={`kit-ing${selected ? "" : " kit-ing--skipped"}`}>
                <div className="kit-ing__line">{row.line}</div>

                <select
                  className="kit-input kit-ing__select"
                  value={row.selectedId ?? ""}
                  onChange={(e) => updateRow(row.id, { selectedId: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">— Skip (no match) —</option>
                  {row.candidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.calories} cal / {c.servingSize}</option>
                  ))}
                </select>

                {selected && (
                  <div className="kit-ing__row">
                    <input
                      className="kit-input kit-ing__qty"
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(e) => updateRow(row.id, { amount: e.target.value.replace(/[^\d.]/g, "") })}
                      aria-label="Amount"
                    />
                    <select
                      className="kit-input kit-ing__unit"
                      value={row.unit}
                      onChange={(e) => updateRow(row.id, { unit: e.target.value as AmountUnit })}
                      aria-label="Unit"
                    >
                      {unitOptions.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                    <span className="kit-ing__calc kit-ing__calc--inline">≈ {rowCal.toLocaleString()} cal</span>
                  </div>
                )}

                <div className="kit-ing__row">
                  <input
                    className="kit-input kit-ing__search"
                    placeholder="Search for a different food"
                    value={row.searchQuery}
                    onChange={(e) => updateRow(row.id, { searchQuery: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && searchRow(row)}
                  />
                  <button className="kit-btn kit-btn--secondary" disabled={row.searching || !row.searchQuery.trim()} onClick={() => searchRow(row)}>
                    {row.searching ? "…" : "Search"}
                  </button>
                </div>
              </div>
            );
          })}

          <div className="kit-recipe-summary">
            <div className="kit-recipe-summary__count">{matchedCount} ingredient{matchedCount === 1 ? "" : "s"} matched</div>
            <div className="kit-recipe-summary__macros">
              ≈ {Math.round(totals.calories).toLocaleString()} cal · {Math.round(totals.protein)}p / {Math.round(totals.carbs)}c / {Math.round(totals.fat)}f
            </div>
          </div>

          <button className="kit-btn kit-btn--primary kit-btn--block" disabled={!name.trim()} onClick={save}>
            Save recipe
          </button>
          <button className="kit-btn kit-btn--secondary kit-btn--block" onClick={() => setStatus("edit")}>
            ‹ Back to edit text
          </button>
        </div>
      )}
    </div>
  );
}
