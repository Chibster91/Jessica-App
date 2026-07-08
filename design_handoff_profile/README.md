# Handoff: Profile Screen

## Overview

The Profile screen is the user's personal hub in FoodVault. It is split into two tabs:

- **Info tab** — view and edit biometric data, goal settings, and auto-calculated nutrition targets (calories + macros). All fields open a dedicated bottom-sheet editor.
- **Settings tab** — app preferences: theme, units, feature visibility, notifications, and data/account links.

The screen is a full-height native-style mobile view, scoped to a `390 × 844 px` viewport (iPhone 14). It has **no** top navigation bar — the screen title and tab bar are self-contained.

---

## About the Design Files

The files in this bundle are **high-fidelity design references built in HTML/React** — they show the exact intended look and behavior of the Profile screen but are **not production code to copy directly**. Your task is to recreate these designs in your target codebase (React Native, SwiftUI, Kotlin, web React, etc.) using its established patterns and component library — or, if no environment exists yet, to choose the most appropriate framework and implement the designs there.

---

## Fidelity

**High-fidelity.** Colors, typography, spacing, interactions, and copy are all final. Implement pixel-accurately using the design tokens listed in the [Design Tokens](#design-tokens) section below.

---

## Screens / Views

### 1. Profile Root

The root is a full-height flex column with `overflow: hidden`. It contains:

1. **Screen header** — `padding: 5px 14px 0`. Flex row, space-between.
   - Title: `"Profile"` — `font-size: 1.25rem`, `font-weight: 800`, font: Nunito.
2. **Tab bar** — immediately below the header, `margin: 0 2px 2px`. Two underline-style tabs: `"Info"` and `"Settings"`.
   - Tab pill: `padding: 7px 4px 9px`, `font-size: 0.84rem`, `font-weight: 700`, `color: var(--text-muted)`.
   - Active tab: `color: var(--text-primary)`, `border-bottom: 2px solid var(--accent)`, `margin-bottom: -1px` (overlaps the container's bottom border).
   - Container has `border-bottom: 1px solid var(--border-default)`.
   - Tabs are separated by `margin-left: 14px` on the second tab.
3. **Tab content** — fills remaining height, `overflow-y: auto`, `padding: 9px 10px`.

---

### 2. Info Tab

Scrollable list of section groups. Each group is a label + card pair with `gap: 5px` between them.

#### Avatar Header (above all sections)

Flex row, `gap: 14px`, `padding: 4px 2px 2px`.

| Element | Spec |
|---|---|
| Avatar circle | `50 × 50 px`, `border-radius: 50%`, `background: var(--accent-bg)` |
| Avatar letter | User's first initial, uppercase. `font-size: 20px`, `font-weight: 800`, `color: var(--accent)` |
| Name | `font-size: 1.1rem`, `font-weight: 800` |
| Member since | `"Member since Jan 2026"` — `font-size: 0.7rem`, `color: var(--text-muted)`, `margin-top: 1px` |

#### Section Labels

`font-size: 0.62rem`, `font-weight: 800`, `letter-spacing: 0.1em`, `text-transform: uppercase`, `color: var(--text-muted)`, `padding: 4px 1px 0`.

#### Section Cards

`background: var(--surface-card)` (`#1e2026`), `border: 1px solid var(--border-default)` (`#343845`), `border-radius: var(--radius-card)` (`clamp(10px, 4vw, 18px)`). Use `clip-path: inset(0 round var(--radius-card))` to clip hover backgrounds without triggering BFC min-content collapse.

Divider between consecutive rows: `border-top: 1px solid var(--border-default)`.

#### Info Row

Used for all display rows. Two variants: **static** (div) and **tappable** (button).

| Part | Spec |
|---|---|
| Container | `display: flex`, `align-items: center`, `padding: 10px 14px`, `gap: 8px`, `width: 100%`, `box-sizing: border-box` |
| Hover (tappable) | `background: var(--surface-raised)` — transition `0.12s var(--ease-out)` |
| Active (tappable) | `background: var(--accent-bg)` |
| Label | `flex: 1`, `font-size: 0.875rem`, `font-weight: 600`, `color: var(--text-secondary)` |
| Right group | `display: flex`, `align-items: baseline`, `gap: 5px` |
| Value | `font-size: 0.875rem`, `font-weight: 700`, `color: var(--text-primary)`, `text-align: right`, `white-space: nowrap` |
| Accent value | `color: var(--accent)` (used for calorie target and goal date) |
| Sub label | `font-size: 0.62rem`, `color: var(--text-muted)`, `white-space: nowrap` |
| Chevron `›` | `font-size: 1.05rem`, `color: var(--text-muted)`, `flex-shrink: 0` (only on tappable rows) |

#### Sections in Order

| Section label | Rows | Tappable? | Edit sheet |
|---|---|---|---|
| About you | Name · Age · Sex · Height | ✓ all | name / personal / personal / height |
| Cycle *(hidden if showCycle is off)* | Cycle length (avg) · Period length (avg) · Fertile & ovulation | ✓ all | cycle |
| Body | Start weight · Goal weight · Weekly rate | ✓ all | startWeight / goalWeight / goal |
| Goal | Goal type · Activity | ✓ all | goal / activity |
| Targets | Daily calories *(accent)* · Protein · Carbs · Fat | ✓ all | calories / macros / macros / macros |
| Estimates | BMR (sub: "Basal metabolic rate") · TDEE (sub: "Total daily energy") · Est. goal date *(accent)* | ✗ static | — |

**Calculated values** — computed from profile data:

```
BMR  = Mifflin-St Jeor formula (sex-aware)
TDEE = BMR × activity multiplier
Daily target = TDEE ± weekly-rate deficit/surplus (500 cal per lb/wk)
Macros:
  Lose:     protein 30% · carbs 40% · fat 30%
  Maintain: protein 25% · carbs 45% · fat 30%
  Gain:     protein 25% · carbs 50% · fat 25%
  (divide protein/carbs by 4 kcal/g, fat by 9 kcal/g)
Goal date = today + (|currentWeight − goalWeight| / weeklyRate) weeks
```

---

### 3. Settings Tab

Same scroll container. Sections use the same label + card structure.

#### Switch Row

Full-width button (`cursor: pointer`). Flex row, space-between.

| Element | Spec |
|---|---|
| Label | `font-size: 0.88rem`, `font-weight: 600`, `color: var(--text-primary)`, `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap` |
| Toggle pill (off) | `44 × 26 px`, `border-radius: 13px`, `background: var(--surface-raised)`, `border: 1px solid var(--border-default)`, thumb left |
| Toggle pill (on) | `background: var(--accent)`, `border: none`, thumb right |
| Thumb | `20 × 20 px`, `border-radius: 50%`, `background: #fff`, `box-shadow: 0 1px 3px rgba(0,0,0,0.3)` |
| Transition | `background 0.18s` on pill |

#### Segmented Control Row (Appearance / Units)

Flex row, space-between, `padding: 8px 14px`. Label at left, `SegmentedControl` component at right with `size="sm"`.

- **Theme** options: `Dark` · `Light` · `System` — controls `data-theme` attribute on `:root`.
- **Weight** options: `lb` · `kg`
- **Energy** options: `cal` · `kJ`

#### Settings Sections

| Section | Contents |
|---|---|
| Appearance | Theme — segmented (Dark · Light · System) |
| Units | Weight — segmented (lb · kg) · Energy — segmented (cal · kJ) |
| Home screen | Show streak counter (switch) · Show macro breakdown (switch) |
| Food logging | Quick-add calories (switch) · Barcode scanner (switch) |
| Cycle tracking | Show cycle tab (switch) |
| Notifications | Push notifications (switch) · Daily log reminder (switch) · Weight check-in reminder (switch) |
| Data & account | Export my data · Connected apps · Privacy & data · Help & support · **Delete account** *(danger color)* — all are tappable link rows with `›` chevron |

**Link row** variant: `color: var(--text-primary)` on label. Danger row: label and chevron use `color: var(--danger)` (`#f87171`).

---

## Edit Sheets (Bottom Sheets)

All edit flows open as a bottom-sheet overlay:

- **Scrim**: `position: absolute; inset: 0; z-index: 50`, `background: rgba(6, 8, 12, 0.55)`. Tap scrim to dismiss.
- **Sheet**: `background: var(--surface-card)`, `border-top: 1px solid var(--border-default)`, `border-top-left-radius: 18px`, `border-top-right-radius: 18px`, `box-shadow: var(--shadow-popup)`, `padding: 10px 16px 18px`, `max-height: 86%`, `overflow-y: auto`.
- **Grab handle**: `38 × 4 px`, `border-radius: 2px`, `background: var(--border-strong)`, centered, `margin: 2px 0 4px`.
- **Sheet header**: flex row space-between. Title: `font-size: 1.15rem`, `font-weight: 800`. Close button: icon button (×), `variant="raised"`, `size="sm"`.
- **Sheet body**: `display: grid`, `gap: 14-18px`.
- **Sheet footer**: Primary button full-width — `"Save"`.
- **Entry animation**: `translateY(24px) → none` over `240ms var(--ease-out)`.

### Sheet: Edit Name
Single text input (`Display name` label). Input: full-width, left-aligned text.

### Sheet: Personal Info
- **Age**: NumStepper (−/+ buttons with `48 × 48 px` round buttons, `font-size: 3rem` center value). Min 13, max 99.
- **Biological sex**: OptionList — Female / Male. Note: `"Used only for BMR calculation."` in `font-size: 0.7rem`, `color: var(--text-muted)`.

### Sheet: Height
2-column grid (`gap: 12px`): Feet stepper (min 3, max 8) + Inches stepper (min 0, max 11). Below: cm conversion in centered muted text.

### Sheet: Start Weight / Goal Weight
WtStepper: `−` / `+` buttons increment by `0.2 lb`. Center value is a typeable input:
- `font-size: 3rem`, `font-weight: 800`, `border: none`, `border-bottom: 2px solid var(--border-default)`, `width: 110px`, centered.
- Focus state: `border-bottom-color: var(--accent)`.
- Below input: `"June 15, 2026"` in `font-size: var(--text-xs)`, `color: var(--text-muted)`, centered. (Start weight sheet only.)

### Sheet: Activity Level
OptionList with 5 options:

| Value | Label | Description | Multiplier |
|---|---|---|---|
| sedentary | Sedentary | Little or no exercise | 1.2 |
| light | Lightly active | Light exercise 1–3 days/wk | 1.375 |
| moderate | Moderately active | Moderate exercise 3–5 days/wk | 1.55 |
| active | Active | Hard exercise 6–7 days/wk | 1.725 |
| very_active | Very active | Hard daily training or physical job | 1.9 |

**Option button**: `background: var(--surface-raised)`, `border: 1px solid var(--border-default)`, `border-radius: 12px`, `padding: 10px 14px`. Selected: `background: var(--accent-bg)`, `border-color: var(--accent-border)`. Label `font-weight: 700`. Description below in `font-size: 0.7rem`, `color: var(--text-muted)`. Checkmark `✓` at right in `color: var(--accent)` when selected.

### Sheet: Goal
- **Goal type**: OptionList — Lose weight / Maintain weight / Gain weight.
- **Weekly rate** *(hidden when Maintain)*: chip row.
  - Lose options: `−0.5 lb/wk`, `−1 lb/wk`, `−1.5 lb/wk`, `−2 lb/wk`
  - Gain options: `+0.25 lb/wk`, `+0.5 lb/wk`, `+0.75 lb/wk`, `+1 lb/wk`
  - Chip: `background: var(--surface-raised)`, `border: 1px solid var(--border-default)`, `border-radius: var(--radius-control)`, `padding: 7px 14px`, `font-size: 0.875rem`, `font-weight: 600`. Active: `background: var(--accent-bg)`, `border-color: var(--accent-border)`, `color: var(--accent)`.

### Sheet: Calorie Target
Top info card shows the auto-calculated value:
- `background: var(--surface-raised)`, `border: 1px solid var(--border-default)`, `border-radius: 12px`, `padding: 13px 14px`.
- Eyebrow: `"AUTO-CALCULATED"` — `font-size: 0.62rem`, `font-weight: 800`, `letter-spacing: 0.08em`, `text-transform: uppercase`, `color: var(--text-muted)`.
- Number: `font-size: 1.8rem`, `font-weight: 800`, `font-variant-numeric: tabular-nums`.
- Sub: `"TDEE 2,xxx − xxx cal deficit"` in `font-size: 0.7rem`, `color: var(--text-muted)`.

Below: Switch row — `"Override manually"`. When on: shows a numeric input (`width: 120px`) for custom calorie value.

### Sheet: Macro Targets
Switch row — `"Set manually"`.

Three rows (Protein · Carbs · Fat):
- Macro label: `width: 52px`, `font-size: 0.8rem`, `font-weight: 800`, `color: var(--macro-protein/carbs/fat)`.
- Input: `flex: 1`, `text-align: right`, `font-weight: 700`, disabled (and `opacity: 0.45`) when not in manual mode.
- Unit label: `"g"`, `font-size: 0.82rem`, `font-weight: 700`, `color: var(--text-muted)`, `width: 16px`.

When in manual mode, shows total calories approximation below: `"≈ x,xxx cal total"`, `font-size: 0.72rem`, `color: var(--text-muted)`, centered.

### Sheet: Cycle
- **Average cycle length**: NumStepper, min 20, max 45, unit `"days"`. Helper text below explains the textbook 28-day default.
- **Average period length**: NumStepper, min 1, max 10, unit `"days"`.
- **Show fertile window & ovulation**: Switch row (inline, not inside a card).

### Confirm Dialog: Delete Account
Centered modal (not a bottom sheet). `z-index: 60`.

- Box: `max-width: 300px`, `background: var(--surface-raised)`, `border: 1px solid var(--border-default)`, `border-radius: 18px`, `box-shadow: var(--shadow-popup)`, `padding: 18px 18px 16px`, entry animation `scale(0.94) → none` over `180ms var(--ease-out)`.
- Title: `"Delete account?"` — `font-size: 1.05rem`, `font-weight: 800`.
- Message: `"All your data will be permanently deleted. This cannot be undone."` — `font-size: 0.875rem`, `color: var(--text-secondary)`.
- Buttons: 2-column grid, `gap: 9px`. Cancel = `variant="secondary"`. Delete = `variant="danger"`.

---

## Interactions & Behavior

### Navigation
- Tapping any row on the Info tab opens the corresponding edit sheet from the bottom.
- The scrim (or the × button) dismisses the sheet without saving.
- Tapping "Save" in a sheet footer commits the change and closes.

### State persistence
All profile data is persisted to `localStorage` under the key `"fv.profile2"`. Every save dispatches `window.dispatchEvent(new CustomEvent("fv:profilechange"))` so other screens can react.

### Theme switching
When the user changes the Theme setting:
- `"dark"` → remove `data-theme` attribute from `:root` (default).
- `"light"` → set `data-theme="light"` on `:root`.
- `"system"` → use `prefers-color-scheme` media query to choose.

### Cycle section visibility
The **Cycle** section in the Info tab is hidden when `profile.showCycle === false` (controlled by the "Show cycle tab" toggle in Settings → Cycle tracking).

### BMR / TDEE recalculation
Recalculated any time `startWeight`, `heightFt`, `heightIn`, `age`, `sex`, or `activityLevel` changes. Result is memoized and displayed read-only in the **Estimates** section.

### Manual overrides
- Calorie target: if `manualCalories !== null`, display and use the manual value. Otherwise use the calculated `dailyTarget`.
- Macros: if `manualProtein/manualCarbs/manualFat !== null`, display and use the manual values. Otherwise use the calculated macro split.

### Animations
| Trigger | Animation |
|---|---|
| Sheet open | `translateY(24px) → none`, `240ms var(--ease-out)` |
| Confirm dialog open | `scale(0.94) → none`, `180ms var(--ease-out)` |
| Scrim fade in | `opacity: 0 → 1`, `150ms var(--ease-out)` |
| Row hover | `background` transition, `120ms var(--ease-out)` |
| Toggle pill | `background` transition, `180ms` linear |

---

## State Management

### Profile object (persisted)

```ts
interface Profile {
  // Identity
  name: string;          // default: "Jessica"
  age: number;           // default: 28
  sex: "female" | "male"; // default: "female"
  heightFt: number;      // default: 5
  heightIn: number;      // default: 6
  
  // Weight & goal
  startWeight: number;   // lbs, default: 161.1
  goalWeight: number;    // lbs, default: 141
  weeklyRate: number;    // lbs/week, default: 1
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active"; // default: "moderate"
  goalType: "lose" | "maintain" | "gain"; // default: "lose"
  
  // Manual overrides (null = use calculated value)
  manualCalories: number | null;
  manualProtein: number | null;
  manualCarbs: number | null;
  manualFat: number | null;
  
  // Cycle
  cycleLength: number;    // days, default: 28
  periodLength: number;   // days, default: 5
  trackFertile: boolean;  // default: true
  
  // Settings
  theme: "dark" | "light" | "system";
  weightUnit: "lb" | "kg";
  energyUnit: "cal" | "kj";
  showCycle: boolean;
  showStreak: boolean;
  showMacros: boolean;
  logReminder: boolean;
  weightReminder: boolean;
  notifications: boolean;
  quickAdd: boolean;
  barcodeScanner: boolean;
}
```

### Computed (derived, not stored)

```ts
interface Computed {
  bmr: number;          // Mifflin-St Jeor
  tdee: number;         // BMR × activity multiplier
  dailyTarget: number;  // manualCalories ?? calcTarget(tdee, goalType, weeklyRate)
  macros: { protein: number; carbs: number; fat: number }; // grams
  goalDate: string;     // formatted date string or "—" / "Almost there!"
}
```

---

## Design Tokens

### Colors

| Token | Value | Usage |
|---|---|---|
| `--surface-app` | `#15161a` | Page background |
| `--surface-card` | `#1e2026` | Section cards, sheet background |
| `--surface-raised` | `#262932` | Input fields, chip background, option buttons |
| `--border-default` | `#343845` | All borders |
| `--border-strong` | `#4a4f5e` | Sheet grab handle |
| `--text-primary` | `#f2f2f0` | Row values, headings |
| `--text-secondary` | `#b7bcc7` | Row labels, sheet body copy |
| `--text-muted` | `#7c828f` | Sub labels, meta text, chevrons, section headers |
| `--accent` | `#b46cff` | Active tabs, accent values, selected states, avatar letter |
| `--accent-bg` | `rgba(180,108,255,0.15)` | Avatar circle, active rows/chips |
| `--accent-border` | `rgba(180,108,255,0.50)` | Selected option borders |
| `--macro-protein` | `#80ed99` | Protein label color |
| `--macro-carbs` | `#4cc9f0` | Carbs label color |
| `--macro-fat` | `#ffb86b` | Fat label color |
| `--danger` | `#f87171` | Delete account row |
| `--shadow-popup` | `0 20px 48px rgba(0,0,0,0.42)` | Sheets, confirm dialog |

### Typography

| Token | Value |
|---|---|
| `--font-sans` | `"Nunito", system-ui, sans-serif` |
| `--font-mono` | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` |
| Screen title | `1.25rem / 800` |
| Tab label | `0.84rem / 700` |
| Section label | `0.62rem / 800 / uppercase / tracking 0.1em` |
| Row label | `0.875rem / 600` |
| Row value | `0.875rem / 700` |
| Sheet title | `1.15rem / 800` |
| Stepper number | `3rem / 800` |

### Spacing & Radii

| Token | Value |
|---|---|
| `--radius-card` | `clamp(10px, 4vw, 18px)` |
| `--radius-md` | `12px` |
| `--radius-control` | `10px` |
| `--radius-lg` | `18px` |
| `--ease-out` | `cubic-bezier(0.22, 0.61, 0.36, 1)` |
| `--dur-fast` | `120ms` |
| Row padding | `10px 14px` |
| Control row padding | `8px 14px` |
| Section card gap | `5px below label` |
| Scroll container padding | `9px 10px` |

---

## Assets

- **Avatar**: generated from the user's display name initial — no image file required. Circle with `background: var(--accent-bg)`, letter in `var(--accent)`.
- **Chevron** (`›`): plain Unicode character, not an icon asset.
- **Checkmark** (`✓`): plain Unicode, used in OptionList selected state.
- **Close button** (`×`): rendered by the `IconButton` design system component.
- **Font**: Nunito — loaded via Google Fonts. Weights used: 600, 700, 800.

---

## Files

| File | Description |
|---|---|
| `ProfileScreen.jsx` | Full React component tree for the Profile screen, including all edit sheets |
| `kit.css` (see design system) | App-scoped CSS classes for profile rows, cards, section labels, option lists, weight stepper, and bottom-sheet chrome |
| `styles.css` → `tokens/*.css` | Design tokens: colors, typography, spacing, radii, shadows, motion |
| `Overlays.jsx` (reference) | `Sheet` and `ConfirmDialog` wrapper components used by edit sheets |

The component uses `window.FoodVaultDesignSystem_fb9669` for: `Button`, `IconButton`, `Switch`, `SegmentedControl`. In your implementation, replace these with the equivalent components from your own design system or component library.
