# Handoff: Jessica — Home + Log Layout Restyle

## Overview
A restyled layout proposal for the **Home** and **Log** screens of the Jessica nutrition-tracking PWA. The design preserves the existing information hierarchy from the production app while restructuring how data is presented:

- **Home** moves from a single-day dashboard to a **week-based dashboard** with a hero calorie card, a 7-day macro strip, and a 4-up summary grid (Streak, Goals with daily/weekly toggle, Weight, Today).
- **Log** consolidates the day's calorie/macro summary into a single card with a circular gauge, meal-type breakdown, and a stacked macro segment bar — followed by per-meal cards with expandable food rows and a finish-day toggle.

Both screens are shown side-by-side in a single HTML preview so the proposal can be reviewed at a glance.

## About the Design Files
The files in this bundle are **design references created in HTML** — a static prototype showing the intended look and behavior, not production code to copy directly.

The Jessica app is a **React 18 PWA** (the source kit in this project uses React via CDN + Babel for prototyping; the production repo is `Chibster91/Jessica-App`). The task is to **recreate these layouts as React components** in the existing Jessica codebase, reusing its established components (`CaloriePanel`, `MacroBar`, `FoodCard`, `MealGroup`, `StatCard`, `Streak`, etc.) and the design tokens already defined in `colors_and_type.css`.

## Fidelity
**High-fidelity (hifi).** All colors, spacing, typography, and radii come from the existing Jessica design tokens in `colors_and_type.css`. Recreate pixel-perfectly using the codebase's existing components and CSS variables. No new colors or fonts are introduced.

## Files in this bundle

- `proposal-home-log.html` — the runnable static prototype. Open this in a browser to see the target layouts.
- `colors_and_type.css` — the design tokens (CSS custom properties) the layout consumes. Already present in the Jessica codebase; included for reference.
- `styles.css` — base UI-kit styles the prototype layers on top of (sourced from the existing `ui_kits/jessica-app/styles.css`).
- `README.md` — this document.

> Source paths in the project: `ui_kits/jessica-app/proposal-home-log.html`, `colors_and_type.css`, `ui_kits/jessica-app/styles.css`.

---

## Design Tokens

All values come from `colors_and_type.css`. Use the CSS variables, not raw hex.

### Colors
| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#15161A` | App background |
| `--surface` | `#1E2026` | Panels, cards |
| `--surface-2` | `#262932` | Inner cards, inputs, food rows |
| `--border` | `#343845` | Hairlines, card outlines |
| `--fg` | `#F2F2F0` | Primary text |
| `--fg-2` | `#B7BCC7` | Secondary / muted text |
| `--accent` | `#B46CFF` | Primary purple — active states, gauge fill, CTAs |
| `--accent-soft` | `rgba(180,108,255,0.22)` | Hover/focus fills |
| `--macro-protein` | `#80ED99` | Protein (green) |
| `--macro-carbs` | `#4CC9F0` | Carbs (blue) |
| `--macro-fat` | `#FFB86B` | Fat (orange) |
| `--danger-warm` | `#F87171` | Over-budget calorie fill |

### Typography
- **Sans / Heading**: `Nunito` (400, 500, 600, 700, 800) via Google Fonts
- **Mono**: `ui-monospace, Consolas, monospace` — used for percentages and calorie counts in compact contexts
- Base: `16px / 1.45`

### Radii
- `--radius-md` 10px — food rows, small buttons
- `--radius-lg` 12px — secondary cards
- `--radius-2xl` 18px — primary panels (Home cards, Log summary, meal cards)
- `--radius-pill` 999px — toggle track

### Spacing scale
`0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 2.5 / 3 rem` — `--space-1` through `--space-8`.

---

## Screens / Views

### 1. Home (week-based dashboard)

**Purpose:** At-a-glance view of the user's week — calories spent vs. budget, daily macro mix across the week, streak, daily/weekly goals, current weight, and today's progress.

**Layout (top to bottom):**
1. Week navigator row — `‹` arrow · "Week of: Apr 27 – May 3" centered · `›` arrow.
2. **Calories card** (full width).
3. **Macros card** (full width).
4. **Bottom 4-up grid** — 2-column CSS grid: `[Streak] [Goals]` / `[Weight] [Today]`.

The whole stack uses `gap: 12px` between cards. Outer card uses `var(--surface)` with `1px solid var(--border)` and `border-radius: 18px` (`--radius-2xl`), padding `14px 16px`.

#### 1a. Calories card
- **Eyebrow label** "Calories" — uppercase, 0.65rem, weight 700, letter-spacing 0.1em, color `--fg-2`.
- **Hero block** (centered):
  - Background bar: `rgba(52,56,69,0.35)` filled `width: 62%` with `rgba(128,237,153,0.28)` (semi-transparent protein green) — the bar visualizes the week's calorie progress.
  - **Big number** `8,724` — 2.4rem, weight 700, line-height 1.
  - **Sub** `"5,276 remaining this week"` — 0.8rem, color `--fg-2`.
- **7-day bar strip** below: CSS grid `repeat(7, 1fr)` × `gap: 4px`, height 90px.
  - Each column: a 70px bar wrapper (`var(--surface-2)`, 1px border, radius 6px) + day letter `M T W T F S S` underneath.
  - **Today** column (`F` in mock): wrapper border becomes `var(--accent)`; the fill below uses `var(--macro-protein)` at full opacity. Other days use the same green at `opacity: 0.6`.
  - **Budget marker**: 1px horizontal line at `bottom: 75%` of each bar, color `rgba(180,108,255,0.4)` — represents the daily calorie budget.
  - Over-budget overflow uses `--danger-warm` (`#F87171`) — class `dash-cal-over-fill`.

#### 1b. Macros card
- Eyebrow `"Macros"`.
- Two-column layout: `100px 1fr` with `gap: 14px`, items center-aligned.
- **Left**: SVG donut/pie chart, ~100px square. Three slices in macro colors:
  - Protein `#80ED99`, Carbs `#4CC9F0`, Fat `#FFB86B`.
  - Slices are simple SVG `<path>` arcs from a 100×100 viewBox. Use real data — the prototype hardcodes one example.
- **Right**: 7-day macro stack strip (`repeat(7, 1fr)`, height 60px). Each column is a 50px-tall meter (`--surface-2` bg, 1px border, radius 4px) with a stacked vertical fill — protein/carbs/fat in `flex-direction: column-reverse` so protein is at the bottom. Today's meter (`.sel`) has `border-color: var(--accent)`.
- **Summary line** under the strip: `Protein 96g · Carbs 155g · Fat 71g` with the macro labels colored by macro token, weight 700 on the labels, 0.78rem.

#### 1c. Bottom 4-up grid

Each mini-card uses the same `var(--surface)` panel chrome, padding `10px 12px`.

**Streak (top-left, special tall card):**
- Vertically centered, min-height 140px.
- Eyebrow `"Streak"` → giant number `5` at 4rem, weight 700, color `--accent` → sub `"days completed"`.

**Goals (top-right):**
- Header row: eyebrow `"Goals"` left · segmented toggle right (`Daily` / `Weekly`, active state = `--accent` bg, white text, 0.65rem). The toggle is a row of two buttons in a pill container.
- List of 3 macro progress rows. Each row:
  - Header: label (e.g. "Protein", color `--fg-2`) + percent/total (e.g. `"68% / 96g"`, mono font, color `--fg`).
  - Track: 5px tall, `var(--border)` background, `border-radius: 3px`, `overflow: hidden`.
  - Fill: macro-colored, `width` = current %.
  - **Goal marker**: a 1px vertical line at `left: 80%` of the track, colored `rgba(180,108,255,0.45)`. Marks the target.

**Weight (bottom-left):**
- Eyebrow `"Weight"` → `74.5 kg` (number 2rem weight 700 in `--fg`; `kg` unit at 0.6em color `--fg-2`) → sub `"↓ 0.8 kg lost"` colored `#80ED99` (protein green) for loss. Use `--danger-warm-2` (`#FF7B7B`) if weight gained.

**Today (bottom-right):**
- Eyebrow `"Today"` → `1,247` (2rem, in `--fg`, **not** accent) → sub `"cal · 753 left"`.

---

### 2. Log (day-detail screen)

**Purpose:** View, add, edit, and remove logged foods for a specific day. Show day totals, per-meal totals, and finish-day toggle.

**Layout (top to bottom):**
1. **Date row**: prev `‹` button · centered date `"Friday, May 1"` (1rem, weight 700) · next `›` button. Buttons are 32×32, `var(--surface-2)`, 1px border, radius 8px.
2. **File actions row** (centered, wraps): `[Import JSON] [Import File] [Export Day]` — small buttons, `--surface-2` bg, 0.75rem font.
3. **Summary card** (single card holding 4 stacked sub-rows).
4. **Meal cards** — one per meal type (Breakfast, Lunch, Dinner, Snacks). Show all meal cards regardless of whether they have food.
5. **Finish Logging row** — bottom toggle.

#### 2a. Summary card
Single panel (`--surface`, 18px radius, 14px padding) containing **all** of the following stacked via CSS grid:

**Top row** — 3 columns `1fr auto 1fr`, items center-aligned, gap 10px:
- **Left stat**: `"Logged"` label (uppercase 0.65rem, `--fg-2`) above bold number `1,247` (1.3rem, weight 700).
- **Center gauge ring** (110×110):
  - A circular conic-gradient ring: `conic-gradient(var(--accent) calc(var(--p)*1%), var(--border) 0)` masked by an inner `radial-gradient` to leave a thin ring (`--p` is the percent, e.g. 62).
  - Inside: `"Remaining"` (0.6rem `--fg-2`) → `753` (1.4rem weight 700) → `"cal"` (0.65rem `--fg-2`).
- **Right stat**: `"Total"` label above `2,000`.

**Below the top row, all spanning the full card width with `border-top: 1px solid var(--border)` separators:**

**Meal breakdown** — `grid-template-columns: repeat(4, 1fr)`, gap 6px. Four buttons, each: small uppercase label (`Breakfast`, `Lunch`, `Dinner`, `Snacks`) above mono-font calorie number (0.95rem). Tapping a button presumably scrolls to or expands that meal card.

**Macro legend row** — 3 inline items, gap 14px, font 0.78rem:
- Color dot (8×8 circle in macro color) + macro name (`--fg-2`) + bold value (`--fg`). E.g. `● Protein 96g`.

**Stacked macro bar** — 6px tall, radius 3px, `var(--border)` background. Three full-height segments side-by-side using protein/carbs/fat colors with `width` = each macro's % of total grams (the prototype shows `30% / 48% / 22%`).

#### 2b. Meal card
One card per meal. Padding `12px 14px`, gap 10px.

**Header** — 3-column grid `24px 1fr 24px`:
- Left: expand chevron `▾` (expanded) or `▸` (collapsed) — color `--fg-2`, 1rem.
- Middle: title block — `<h3>Breakfast: 335</h3>` (1rem, weight 600) + macro line below (`Fat 4g · Carbs 65g · Protein 8g`, 0.7rem, `--fg-2`, gap 10px).
- Right: `⋯` menu button.

**Food rows** (when expanded) — gap 6px:
- 5-column grid `32px 1fr auto 24px 24px`, gap 10px, padding `8px 10px`, `var(--surface-2)` bg, 1px border, radius 10px.
- **Icon** (28×28 food avatar — apple/banana/coffee SVGs from the existing `assets/` folder).
- **Main**: name (0.88rem weight 600) + serving (0.7rem `--fg-2`).
- **Calories** (right-aligned): mono `225` (0.9rem) + `cal` label below (0.6rem `--fg-2`).
- **Edit** ✎ and **Remove** × buttons.

**Add Food button** — full width, `--surface-2` bg, 1px border, color `--accent`, weight 600, padding 8px, radius 10px. On hover: `border-color: var(--accent)`.

When a meal is collapsed, only the header + Add Food button render (no food rows).

#### 2c. Finished Logging row
Single panel (`--surface`, 18px radius, padding `12px 14px`), flex row with `space-between`:
- Left: `"Finish Logging"` label, weight 600.
- Right: pill toggle, 56×28, radius 999px.
  - Off: `--surface-2` bg, 1px border. Indicator (22×22 circle, `--fg`) on the left.
  - On: `--accent` bg + border. Indicator translates `28px` right. Transition `0.2s`.

---

## Interactions & Behavior

| Action | Result |
|---|---|
| **Home › week arrow ‹/›** | Shift the week window by 7 days; refetch/recompute the 7-day calorie + macro arrays and the headline totals. |
| **Home › day bar tap** | Selects that day (border becomes `--accent`); Today and Goals cards update to that day's data. |
| **Home › Goals Daily/Weekly toggle** | Swap the progress denominators between daily targets and weekly (×7) targets. |
| **Home › calorie hero** | Width of green fill = `(consumed_this_week / weekly_budget) * 100%`. Cap at 100% visually; show overflow in `--danger-warm` if over. |
| **Log › date arrows** | Move ±1 day; refetch foods/totals for that date. |
| **Log › Import JSON / Import File / Export Day** | File pickers — already implemented in the existing app's `ShareSheet` / data layer; reuse those handlers. |
| **Log › meal-breakdown button** | Scroll to (or expand) the corresponding meal card. |
| **Log › meal expand chevron** | Toggle the food list visibility for that meal. Persist expanded state per meal in component state (or localStorage if existing patterns do). |
| **Log › Add Food** | Opens the existing `AddFoodModal`. |
| **Log › edit ✎ / remove × on food row** | Edit opens an inline serving editor or modal (match existing `EditFoodModal` if present). Remove deletes immediately (existing pattern is no-confirm). |
| **Log › Finish Logging toggle** | Same as the existing "Log Day" action — flips `dayFinished` and triggers the streak popover (already wired in the codebase). |

### Animations & transitions
- Toggle indicator: `transform 0.2s` ease.
- Calorie bar fill: `width 0.4s ease`.
- Meal expand/collapse: respect existing animation conventions in the codebase (suggest `max-height` or simple show/hide; the prototype uses no animation).

---

## State Management

Reuse the existing app state. Specifically:

- **Selected week** (Home only) — derive from a `weekStart: Date`. Add a setter wired to the week arrows.
- **Selected day** (Home) — index 0–6 within the current week, defaults to today.
- **Goals view** (Home) — `'daily' | 'weekly'`.
- **Selected date** (Log) — already exists in the app as `selectedDate`.
- **Per-meal expanded** (Log) — `Record<MealType, boolean>`, default all expanded.
- **Day finished** (Log) — already exists; reuse.

Data fetching: the existing `data.js` (mock) and the production data layer already expose per-day food entries and totals. The new Home screen needs a **weekly aggregation** — sum each day's calories/macros across `weekStart … weekStart + 6` days. If this aggregator isn't already in the codebase, add it next to the existing day-totals util.

---

## Components to reuse / refactor

These already exist in `ui_kits/jessica-app/Components.jsx` (and the production app):

- `CaloriePanel` — likely fork into a `WeekCaloriePanel` for the new hero+strip layout, or extend with a `mode="week" | "day"` prop.
- `MacroBar` — the stacked segment bar at the bottom of the Log summary card uses the same logic; reuse with new props.
- `FoodCard` / `MealGroup` — the food rows and meal cards in Log. The new design tightens spacing and adds the macro line under each meal title; either extend or write a new `LogMealCard`.
- `StatCard` — Weight / Today mini-cards in the Home grid.
- `Streak` — the giant streak number in Home.
- `Modal` — for `AddFoodModal`, edit-food sheet.

New components to add:
- `WeekNav` — the `‹ Week of: … ›` row.
- `DayBars` — the 7-day calorie bars with budget marker.
- `MacroDayStrip` — the 7-day stacked macro meters.
- `GoalProgressList` — the Daily/Weekly goal rows with the marker line.
- `LogSummaryCard` — the all-in-one summary card with gauge ring + meal breakdown + macro segment.
- `GaugeRing` — the conic-gradient circular ring (110px).
- `FinishLoggingToggle` — the bottom pill toggle (likely a thin wrapper over an existing toggle).

---

## Assets

Food avatars used in the Log food rows come from the existing `assets/` folder at the design-system root: `Apple.svg`, `banana.svg`, `bread.svg`, `coffee` etc. (the prototype uses `Apple.png` as a placeholder for all rows — wire the real per-food icons in production using the existing icon mapping).

No new icon or image assets are introduced.

---

## Responsive behavior

The prototype is presented in a **2-column desktop preview** (Home left, Log right) for review. The screens themselves are designed for **phone width** (~390px) and should render full-width as the primary mobile UI. The existing app's chrome (`Header`, `BottomNav`) wraps these screens unchanged.

At ≤760px (rare on this app, but for desktop preview shrink), the two preview frames stack.

---

## Implementation notes

- **Don't** ship the prototype's `<style>` block as production CSS. Translate the rules into the codebase's existing CSS module / styled-component pattern. Class names in the prototype (`dash-card`, `log-meal-card`, etc.) are just hooks for the static demo.
- All measurements above are direct from the prototype; treat them as authoritative for hifi parity.
- The pie chart in the Macros card is hand-rolled SVG paths in the prototype. Production should use a real SVG donut renderer (or the existing chart util if one exists).
- Calorie bar overflow (over-budget) uses `--danger-warm`; the prototype only shows the under-budget state.
