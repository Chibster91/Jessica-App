# Jessica App — Import File Format

This document is a reference for generating valid JSON import files for the Jessica food tracking app.

---

## Two formats

### Single-day (one day per file)

```json
{
  "date": "2026-06-17",
  "meals": [
    {
      "name": "Breakfast",
      "items": [
        {
          "name": "Greek Yogurt",
          "brand": "Chobani",
          "serving": "1 cup",
          "servings": 1,
          "calories": 150,
          "protein": 17,
          "carbs": 9,
          "fat": 0
        }
      ]
    }
  ]
}
```

### Multi-day (array of day objects)

```json
[
  {
    "date": "2026-06-16",
    "meals": [ ... ]
  },
  {
    "date": "2026-06-17",
    "meals": [ ... ]
  }
]
```

---

## Field reference

### Day object

| Field | Required | Type | Notes |
|---|---|---|---|
| `date` | **yes** | string | `YYYY-MM-DD` format only |
| `meals` | yes (if no weightEntry) | array | List of meal objects |
| `weightEntry` | no | object | `{ "weight": 145.5 }` — weight **in lbs** |

> **Completion is automatic.** Any day where at least one food item is successfully imported is automatically flagged as completed for the logged-days streak. Do not add a `completed` field — it is ignored.

### Meal object

| Field | Required | Accepted alternatives | Notes |
|---|---|---|---|
| `name` | **yes** | `meal`, `mealName` | Any string — "Breakfast", "Lunch", "Dinner", "Snacks", or a custom name |
| `items` | **yes** | `foods` | Array of food objects |

### Food object

| Field | Required | Accepted alternatives | Type | Notes |
|---|---|---|---|---|
| `name` | **yes** | `food`, `foodName` | string | Food name |
| `serving` | **yes** | `servingSize`, `portion` | string | The size of **one serving** (see serving formats below) |
| `calories` | **yes** | `kcal` | number | Total calories **for the amount eaten** |
| `brand` | no | `brandName` | string | Brand name |
| `servings` | no | `quantity`, `servingCount` | number | Number of servings eaten — default `1` |
| `protein` | no | — | number | Grams — default `0` |
| `carbs` | no | `carbohydrates` | number | Grams — default `0` |
| `fat` | no | — | number | Grams — default `0` |
| `notes` | no | `note` | string | Free text |
| `source` | no | — | string | Where the data came from |

Macros can also be nested under a `macros` key:

```json
{
  "name": "Chicken Breast",
  "serving": "4 oz",
  "calories": 185,
  "macros": {
    "protein": 35,
    "carbs": 0,
    "fat": 4
  }
}
```

---

## How calories and macros work

**All numbers are for the total amount eaten, not per-serving.**

If someone ate 2 cups of oatmeal:
- `"serving": "1 cup"` — one serving is 1 cup
- `"servings": 2` — they ate 2 servings
- `"calories": 300` — total calories (150 × 2)
- `"protein": 10` — total protein (5 × 2)

The app divides the totals by `servings` to store per-serving values internally. If `servings` is omitted, it defaults to 1, meaning the numbers you provide are treated as the per-serving values.

---

## Serving size formats

The serving field accepts these units (singular or plural):

| Unit | Examples |
|---|---|
| Weight | `"100 g"`, `"3.5 oz"`, `"1 kg"` |
| Volume | `"1 cup"`, `"2 tbsp"`, `"1 tsp"`, `"8 fl oz"`, `"250 ml"`, `"1 l"` |
| Count | `"1 large"`, `"1 medium"`, `"1 small"`, `"1 whole"`, `"1 piece"`, `"1 slice"` |
| Generic | `"1 serving"`, `"1 container"`, `"1 bottle"`, `"1 can"`, `"1 bar"`, `"1 packet"` |

The serving is used to match imported foods to existing ones in the library. Using standard units (g, oz, cup, tbsp) gives the best matching results.

---

## Weight entry

Add a weight entry for that day alongside the food log:

```json
{
  "date": "2026-06-17",
  "weightEntry": {
    "weight": 152.4
  },
  "meals": [ ... ]
}
```

Weight is **always in lbs**. The app converts to kg internally if the user's display unit is metric.

---

## Validation rules

The importer will reject the file if any of these are violated:

- `date` must be `YYYY-MM-DD` and a real calendar date
- `name` cannot be blank
- `serving` cannot be blank
- `calories` must be a non-negative number
- `protein`, `carbs`, `fat` must be non-negative numbers (if provided)
- `servings` must be a positive number (if provided)
- The file must contain at least one food item or one weight entry

---

## Full single-day example

```json
{
  "date": "2026-06-17",
  "weightEntry": {
    "weight": 152.4
  },
  "meals": [
    {
      "name": "Breakfast",
      "items": [
        {
          "name": "Oatmeal",
          "serving": "1 cup",
          "servings": 1.5,
          "calories": 225,
          "protein": 7.5,
          "carbs": 40.5,
          "fat": 3
        },
        {
          "name": "Blueberries",
          "serving": "1 cup",
          "servings": 0.5,
          "calories": 42,
          "protein": 0.5,
          "carbs": 10.5,
          "fat": 0
        }
      ]
    },
    {
      "name": "Lunch",
      "items": [
        {
          "name": "Grilled Chicken Breast",
          "serving": "4 oz",
          "calories": 185,
          "protein": 35,
          "carbs": 0,
          "fat": 4
        },
        {
          "name": "Brown Rice",
          "serving": "1 cup",
          "calories": 216,
          "protein": 5,
          "carbs": 45,
          "fat": 1.8
        }
      ]
    },
    {
      "name": "Dinner",
      "items": [
        {
          "name": "Salmon",
          "brand": "Wild Caught",
          "serving": "6 oz",
          "calories": 280,
          "protein": 40,
          "carbs": 0,
          "fat": 13
        }
      ]
    },
    {
      "name": "Snacks",
      "items": [
        {
          "name": "Greek Yogurt",
          "brand": "Chobani",
          "serving": "1 container",
          "calories": 150,
          "protein": 17,
          "carbs": 9,
          "fat": 0
        }
      ]
    }
  ]
}
```

## Full multi-day example

```json
[
  {
    "date": "2026-06-15",
    "meals": [
      {
        "name": "Breakfast",
        "items": [
          {
            "name": "Scrambled Eggs",
            "serving": "2 large",
            "servings": 1,
            "calories": 182,
            "protein": 12,
            "carbs": 1.4,
            "fat": 13.7
          }
        ]
      }
    ]
  },
  {
    "date": "2026-06-16",
    "weightEntry": { "weight": 153.0 },
    "meals": [
      {
        "name": "Lunch",
        "items": [
          {
            "name": "Turkey Sandwich",
            "serving": "1 sandwich",
            "calories": 380,
            "protein": 28,
            "carbs": 42,
            "fat": 10
          }
        ]
      }
    ]
  }
]
```

---

## Tips for Claude generating these files

- Use `YYYY-MM-DD` dates always — no slashes, no ambiguity.
- Meal names: "Breakfast", "Lunch", "Dinner", "Snacks" are the standard four. Any other string becomes a custom meal category.
- When the user says "I had X grams of Y" — set `serving` to `"1 g"` and `servings` to the gram amount, **or** set `serving` to `"Xg"` and `servings` to `1`. Either works; the first is more importable.
- When macros aren't known, omit them — don't guess. The app accepts files with calories only.
- Calories are **required**; protein/carbs/fat are **optional** but strongly recommended.
- Don't include `id` fields — the app generates those on import.
- File must be saved as `.json`.
