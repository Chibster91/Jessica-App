# Streak Celebration Popup

**Trigger:** The "Done logging for today" switch at the bottom of the Log screen.  
**Source:** `ui_kits/foodvault_app/LogScreen.jsx` → `StreakCelebration`  
**CSS:** `ui_kits/foodvault_app/kit.css` → `.kit-streak*`

---

## Behavior

- Full-screen overlay (z-index 70), dark scrim, content centered.
- **Auto-dismisses after 2 600 ms.** Tap anywhere to dismiss early.
- Not a bottom sheet — centered card that springs in.

## Layout

```
[ DAY LOGGED ]          ← eyebrow, --accent, uppercase, 0.14em tracking
                        
    ┌──────────┐        
    │    14    │        ← 118px circle badge, 2 pulsing rings
    └──────────┘        
    DAY STREAK          ← uppercase label, --text-secondary
  Keep the chain        ← sub-copy, --text-muted
    going.
```

## Number roll-up

Props: `from` (streak before today) and `to` (new streak).

1. Mounts showing `from`, sub-copy: *"Locking in your day…"*
2. At **520 ms**: number swaps to `to`, `.is-bumped` class added → spring keyframe `cubic-bezier(0.34, 1.56, 0.64, 1)` 460 ms (slides up from below, slight overshoot). Sub-copy updates to *"Keep the chain going."*
3. Use `key={n}` on the number element so React remounts it and the animation retriggers.

## Animations

| Element | Keyframe | Duration | Easing |
|---|---|---|---|
| `.kit-streak__box` | scale(0.82)+Y(12px) → normal | 340 ms | `--ease-out` |
| `.kit-streak__num` (mount) | Y(0.55em)+scale(0.65) → normal | 380 ms | `--ease-out` |
| `.kit-streak__num.is-bumped` | same | 460 ms | spring `cubic-bezier(0.34,1.56,0.64,1)` |
| `.kit-streak__ring` (×2) | scale(1)→scale(1.55), opacity 0.55→0 | 1.9 s loop | `--ease-out` |
| `.kit-streak__ring--2` | same, delay 0.95 s | — | — |

**Reduced motion:** box + number fall back to 150 ms fade; rings hidden entirely.

## Streak persistence (`kitData.js`)

```js
K.logComplete.isDone(dayOffset)          // boolean — is this day marked done?
K.logComplete.setDone(dayOffset, true)   // mark a day done
K.logComplete.streak()                   // current consecutive-day count
```

Back this with `localStorage`. Streak = count how many consecutive days ending today have `isDone === true`.

## CSS tokens used

| Class | Key styles |
|---|---|
| `.kit-streak` | `position:absolute; inset:0; z-index:70; display:grid; place-items:center` |
| `.kit-streak__box` | `background:var(--surface-raised); border:1px solid var(--border-default); border-radius:var(--radius-lg); box-shadow:var(--shadow-popup); max-width:264px` |
| `.kit-streak__eyebrow` | `font-size:0.66rem; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:var(--accent)` |
| `.kit-streak__badge` | `width:118px; height:118px; border-radius:50%; background:var(--accent-bg); border:2px solid var(--accent-border)` |
| `.kit-streak__num` | `font-family:var(--font-mono); font-size:3.4rem; font-weight:800; color:var(--accent); font-variant-numeric:tabular-nums` |
| `.kit-streak__label` | `font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-secondary)` |
| `.kit-streak__sub` | `font-size:0.78rem; color:var(--text-muted)` |
