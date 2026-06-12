import type { ActivityLevel, CalculatorInputs, GoalType, Goals, MacroPreset, Profile, ProfileActivityLevel, ProfileCalculation, ProfileForm, ProfileUnits, WeightUnit } from "./types";
import { cmToTotalInches, convertWeightValue, formatProfileNumber, kgToLb, lbToKg, parseDecimalInput, poundsPerKilogram } from "./format";

export const defaultCalculatorInputs: CalculatorInputs = {
  age: "",
  sex: "female",
  height: "",
  heightFeet: "",
  heightInches: "",
  heightUnit: "ftIn",
  weight: "",
  weightUnit: "lb",
  activityLevel: "moderate",
  goal: "maintain",
  rate: "moderate",
};

export const profileActivityMultipliers: Record<ProfileActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const profileActivityLabels: Record<ProfileActivityLevel, { title: string; detail: string }> = {
  sedentary: { title: "Sedentary", detail: "Little or no exercise, desk job" },
  light: { title: "Lightly Active", detail: "Light exercise 1-3 days/week" },
  moderate: { title: "Moderately Active", detail: "Moderate exercise 3-5 days/week" },
  active: { title: "Active", detail: "Hard exercise 6-7 days/week" },
  very_active: { title: "Very Active", detail: "Physical job or twice-daily training" },
};

export const profileActivityOptions = Object.keys(profileActivityLabels) as ProfileActivityLevel[];

export const profilePaceOptions = [
  { label: "Maintain", goal: "maintain" as GoalType, weeklyRateKg: 0 },
  { label: "Lose 0.5 lb/week", goal: "lose" as GoalType, weeklyRateKg: 0.5 / poundsPerKilogram },
  { label: "Lose 1 lb/week", goal: "lose" as GoalType, weeklyRateKg: 1 / poundsPerKilogram },
  { label: "Lose 1.5 lb/week", goal: "lose" as GoalType, weeklyRateKg: 1.5 / poundsPerKilogram },
] as const;

export const profileWizardSteps = [
  "Basics",
  "Activity",
  "Plan",
  "Macros",
] as const;

export const macroPresets: Record<Exclude<MacroPreset, "custom">, { label: string; proteinPct: string; carbPct: string; fatPct: string }> = {
  balanced: { label: "Balanced", proteinPct: "30", carbPct: "40", fatPct: "30" },
  high_protein: { label: "High protein", proteinPct: "40", carbPct: "30", fatPct: "30" },
};

export const maxHeightInches = 108;

export const maxHeightCm = maxHeightInches * 2.54;

export const minProfileHeightCm = 100;

export const maxProfileHeightCm = 250;

export const minProfileWeightKg = 30;

export const maxProfileWeightKg = 300;

export function toProfileActivityLevel(level: ActivityLevel | ProfileActivityLevel | undefined): ProfileActivityLevel {
  if (level === "veryActive") return "very_active";
  if (level === "sedentary" || level === "light" || level === "moderate" || level === "active" || level === "very_active") {
    return level;
  }
  return "moderate";
}

export function toCalculatorActivityLevel(level: ProfileActivityLevel): ActivityLevel {
  return level === "very_active" ? "veryActive" : level;
}

export function profileToForm(profile: Profile): ProfileForm {
  const totalInches = cmToTotalInches(profile.heightCm);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches - feet * 12;

  return {
    name: profile.name,
    units: profile.units,
    trackCycle: profile.trackCycle ?? true,
    age: String(profile.age),
    sex: profile.sex,
    heightCm: formatProfileNumber(profile.heightCm, 1),
    heightFeet: String(feet),
    heightInches: formatProfileNumber(inches, 1),
    weight: profile.units === "metric"
      ? formatProfileNumber(profile.weightKg, 1)
      : formatProfileNumber(kgToLb(profile.weightKg), 1),
    goalWeight: profile.goalWeightKg
      ? profile.units === "metric"
        ? formatProfileNumber(profile.goalWeightKg, 1)
        : formatProfileNumber(kgToLb(profile.goalWeightKg), 1)
      : "",
    activityLevel: toProfileActivityLevel(profile.activityLevel),
    goal: profile.goal,
    weeklyRateKg: String(profile.weeklyRateKg || 0.5),
    useManualCalories: profile.useManualCalories,
    manualCalorieOverride: profile.manualCalorieOverride ? String(profile.manualCalorieOverride) : "",
    macroMode: profile.macroMode,
    macroPreset: "custom",
    proteinPct: String(profile.macros.proteinPct ?? 30),
    carbPct: String(profile.macros.carbPct ?? 40),
    fatPct: String(profile.macros.fatPct ?? 30),
    proteinGrams: String(profile.macros.proteinGrams ?? ""),
    carbGrams: String(profile.macros.carbGrams ?? ""),
    fatGrams: String(profile.macros.fatGrams ?? ""),
  };
}

export function profileFormFromLegacyGoals(goals: Goals | null): ProfileForm {
  const inputs = calculatorInputsToForm(goals);
  const heightCm = getHeightCm(inputs);
  const weight = Number(inputs.weight);
  const weightKg =
    Number.isFinite(weight) && weight > 0
      ? inputs.weightUnit === "kg"
        ? weight
        : lbToKg(weight)
      : 0;
  const units: ProfileUnits = inputs.weightUnit === "kg" || inputs.heightUnit === "cm" ? "metric" : "imperial";
  const totalInches = heightCm ? cmToTotalInches(heightCm) : 0;
  const feet = totalInches ? Math.floor(totalInches / 12) : 5;
  const inches = totalInches ? totalInches - feet * 12 : 4;
  const goalWeightKg = goals?.goalWeight
    ? goals.goalWeightUnit
      ? convertWeightValue(goals.goalWeight, goals.goalWeightUnit, "kg")
      : units === "metric"
        ? goals.goalWeight
        : lbToKg(goals.goalWeight)
    : null;

  return {
    name: "",
    units,
    trackCycle: true,
    age: inputs.age,
    sex: inputs.sex,
    heightCm: heightCm ? formatProfileNumber(heightCm, 1) : "",
    heightFeet: String(feet),
    heightInches: formatProfileNumber(inches, 1),
    weight: weightKg
      ? units === "metric"
        ? formatProfileNumber(weightKg, 1)
        : formatProfileNumber(kgToLb(weightKg), 1)
      : "",
    goalWeight: goals?.goalWeight
      ? units === "metric"
        ? formatProfileNumber(goalWeightKg ?? 0, 1)
        : formatProfileNumber(kgToLb(goalWeightKg ?? 0), 1)
      : "",
    activityLevel: toProfileActivityLevel(inputs.activityLevel),
    goal: inputs.goal,
    weeklyRateKg: inputs.goal === "maintain" ? "0.5" : inputs.rate === "mild" ? "0.25" : inputs.rate === "aggressive" ? "0.75" : "0.5",
    useManualCalories: false,
    manualCalorieOverride: goals ? String(goals.calories) : "",
    macroMode: goals ? "grams" : "none",
    macroPreset: "custom",
    proteinPct: "30",
    carbPct: "40",
    fatPct: "30",
    proteinGrams: goals ? String(goals.protein) : "",
    carbGrams: goals ? String(goals.carbs) : "",
    fatGrams: goals ? String(goals.fat) : "",
  };
}

export function getProfileHeightCm(form: ProfileForm) {
  if (form.units === "metric") {
    const height = parseDecimalInput(form.heightCm);
    return Number.isFinite(height) ? height : null;
  }

  const feet = parseDecimalInput(form.heightFeet || "0");
  const inches = parseDecimalInput(form.heightInches || "0");
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;

  return (feet * 12 + inches) * 2.54;
}

export function getProfileWeightKg(form: ProfileForm) {
  const weight = parseDecimalInput(form.weight);
  if (!Number.isFinite(weight)) return null;
  return form.units === "metric" ? weight : lbToKg(weight);
}

export function getProfileGoalWeightKg(form: ProfileForm) {
  const goalWeight = form.goalWeight ?? "";
  if (!goalWeight.trim()) return null;
  const weight = parseDecimalInput(goalWeight);
  if (!Number.isFinite(weight)) return null;
  return form.units === "metric" ? weight : lbToKg(weight);
}

export function calculateProfile(form: ProfileForm): ProfileCalculation | null {
  const age = parseDecimalInput(form.age);
  const heightCm = getProfileHeightCm(form);
  const weightKg = getProfileWeightKg(form);

  if (
    !Number.isInteger(age) ||
    age < 13 ||
    age > 100 ||
    heightCm === null ||
    heightCm < minProfileHeightCm ||
    heightCm > maxProfileHeightCm ||
    weightKg === null ||
    weightKg < minProfileWeightKg ||
    weightKg > maxProfileWeightKg
  ) {
    return null;
  }

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (form.sex === "female" ? -161 : 5);
  const tdee = bmr * profileActivityMultipliers[form.activityLevel];
  const weeklyRateKg = Number(form.weeklyRateKg) || 0;
  const rawAdjustment = form.goal === "maintain" ? 0 : weeklyRateKg * 1100 * (form.goal === "lose" ? -1 : 1);
  const goalAdjustment = form.goal === "lose" ? Math.max(rawAdjustment, -1000) : rawAdjustment;
  const calculatedCalories = Math.round(tdee + goalAdjustment);
  const manualCalories = parseDecimalInput(form.manualCalorieOverride);
  const activeCalories =
    form.useManualCalories && Number.isFinite(manualCalories) && manualCalories > 0
      ? Math.round(manualCalories)
      : calculatedCalories;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    goalAdjustment: Math.round(goalAdjustment),
    calculatedCalories,
    activeCalories,
  };
}

export function getProfileValidationErrors(form: ProfileForm): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = form.name.trim();
  const age = parseDecimalInput(form.age);
  const heightCm = getProfileHeightCm(form);
  const weightKg = getProfileWeightKg(form);
  const goalWeightKg = getProfileGoalWeightKg(form);
  const manualCalories = parseDecimalInput(form.manualCalorieOverride);
  const proteinPct = parseDecimalInput(form.proteinPct);
  const carbPct = parseDecimalInput(form.carbPct);
  const fatPct = parseDecimalInput(form.fatPct);
  const proteinGrams = parseDecimalInput(form.proteinGrams || "0");
  const carbGrams = parseDecimalInput(form.carbGrams || "0");
  const fatGrams = parseDecimalInput(form.fatGrams || "0");

  if (name && (name.length < 2 || name.length > 40)) errors.name = "Display name must be 2-40 characters.";
  if (!form.age) errors.age = "Age is required.";
  else if (!Number.isInteger(age) || age < 13 || age > 100) errors.age = "Age must be 13-100.";
  if (heightCm === null) errors.height = "Height is required.";
  else if (heightCm < minProfileHeightCm || heightCm > maxProfileHeightCm) errors.height = "Height must be 100-250 cm.";
  if (!form.weight) errors.weight = "Current weight is required.";
  else if (weightKg === null || weightKg < minProfileWeightKg || weightKg > maxProfileWeightKg) {
    errors.weight = "Weight must be 30-300 kg.";
  }
  if (form.goalWeight && (goalWeightKg === null || goalWeightKg < minProfileWeightKg || goalWeightKg > maxProfileWeightKg)) {
    errors.goalWeight = "Goal weight must be 30-300 kg.";
  }
  if (form.useManualCalories && (!Number.isFinite(manualCalories) || manualCalories <= 0)) {
    errors.manualCalories = "Manual calorie goal is required.";
  }
  if (form.macroMode === "percentages") {
    if (![proteinPct, carbPct, fatPct].every((value) => Number.isInteger(value) && value >= 0 && value <= 100)) {
      errors.macros = "Macro percentages must be whole numbers from 0-100.";
    } else if (proteinPct + carbPct + fatPct !== 100) {
      errors.macros = "Macro percentages must total exactly 100%.";
    }
  }
  if (form.macroMode === "grams" && ![proteinGrams, carbGrams, fatGrams].every((value) => Number.isFinite(value) && value >= 0)) {
    errors.macros = "Macro grams must be 0 or higher.";
  }

  return errors;
}

export function profileFormToProfile(form: ProfileForm, existingProfile: Profile | null): Profile | null {
  const calculation = calculateProfile(form);
  const age = parseDecimalInput(form.age);
  const heightCm = getProfileHeightCm(form);
  const weightKg = getProfileWeightKg(form);
  const goalWeightKg = getProfileGoalWeightKg(form);

  if (!calculation || heightCm === null || weightKg === null || !Number.isInteger(age)) return null;

  const now = new Date().toISOString();
  const manualCalories = parseDecimalInput(form.manualCalorieOverride);

  return {
    name: form.name.trim(),
    age,
    sex: form.sex,
    heightCm,
    weightKg,
    ...(goalWeightKg !== null ? { goalWeightKg } : {}),
    activityLevel: form.activityLevel,
    goal: form.goal,
    weeklyRateKg: form.goal === "maintain" ? 0 : Number(form.weeklyRateKg),
    calculatedCalories: calculation.calculatedCalories,
    manualCalorieOverride:
      form.useManualCalories && Number.isFinite(manualCalories) && manualCalories > 0
        ? Math.round(manualCalories)
        : null,
    useManualCalories: form.useManualCalories,
    macroMode: form.macroMode,
    macros: {
      proteinPct: Math.round(parseDecimalInput(form.proteinPct || "30")),
      carbPct: Math.round(parseDecimalInput(form.carbPct || "40")),
      fatPct: Math.round(parseDecimalInput(form.fatPct || "30")),
      proteinGrams: Math.round(parseDecimalInput(form.proteinGrams || "0")),
      carbGrams: Math.round(parseDecimalInput(form.carbGrams || "0")),
      fatGrams: Math.round(parseDecimalInput(form.fatGrams || "0")),
    },
    units: form.units,
    trackCycle: form.trackCycle,
    startingWeightKg: existingProfile?.startingWeightKg ?? weightKg,
    profileCreatedAt: existingProfile?.profileCreatedAt ?? now,
    profileUpdatedAt: now,
  };
}

export function profileToGoals(profile: Profile): Goals {
  const activeCalories = profile.useManualCalories && profile.manualCalorieOverride
    ? profile.manualCalorieOverride
    : profile.calculatedCalories;
  const macroGoals =
    profile.macroMode === "grams"
      ? {
          calories: activeCalories,
          protein: profile.macros.proteinGrams ?? 0,
          carbs: profile.macros.carbGrams ?? 0,
          fat: profile.macros.fatGrams ?? 0,
        }
      : profile.macroMode === "percentages"
        ? {
            calories: activeCalories,
            protein: Math.round((activeCalories * profile.macros.proteinPct) / 100 / 4),
            carbs: Math.round((activeCalories * profile.macros.carbPct) / 100 / 4),
            fat: Math.round((activeCalories * profile.macros.fatPct) / 100 / 9),
          }
        : getMacroGoals(activeCalories);

  return {
    calories: Math.round(activeCalories),
    protein: Math.round(macroGoals.protein),
    carbs: Math.round(macroGoals.carbs),
    fat: Math.round(macroGoals.fat),
    ...(profile.goalWeightKg
      ? {
          goalWeight: profile.units === "metric" ? profile.goalWeightKg : kgToLb(profile.goalWeightKg),
          goalWeightUnit: profile.units === "metric" ? "kg" as WeightUnit : "lb" as WeightUnit,
        }
      : {}),
    calculatorInputs: {
      age: String(profile.age),
      sex: profile.sex,
      height: String(profile.heightCm),
      heightFeet: "",
      heightInches: "",
      heightUnit: "cm",
      weight: profile.units === "imperial" ? String(kgToLb(profile.weightKg)) : String(profile.weightKg),
      weightUnit: profile.units === "imperial" ? "lb" as WeightUnit : "kg" as WeightUnit,
      activityLevel: toCalculatorActivityLevel(profile.activityLevel),
      goal: profile.goal,
      rate: profile.weeklyRateKg <= 0.25 ? "mild" : profile.weeklyRateKg >= 0.75 ? "aggressive" : "moderate",
    },
  };
}

export function calculatorInputsToForm(goals: Goals | null): CalculatorInputs {
  const inputs = goals?.calculatorInputs;
  if (!inputs) return defaultCalculatorInputs;

  if (inputs.heightUnit === "in") {
    const totalInches = Number(inputs.height);

    if (Number.isFinite(totalInches) && totalInches > 0) {
      return {
        ...inputs,
        heightFeet: String(Math.floor(totalInches / 12)),
        heightInches: String(Number((totalInches % 12).toFixed(1))),
        heightUnit: "ftIn",
      };
    }

    return {
      ...inputs,
      heightUnit: "ftIn",
    };
  }

  return inputs;
}

export function getMacroGoals(goalCalories: number) {
  return {
    calories: Math.round(goalCalories),
    protein: Math.round((goalCalories * 0.3) / 4),
    carbs: Math.round((goalCalories * 0.4) / 4),
    fat: Math.round((goalCalories * 0.3) / 9),
  };
}

export function getHeightCm(inputs: CalculatorInputs) {
  if (inputs.heightUnit === "cm") {
    const height = Number(inputs.height);
    return Number.isFinite(height) && height > 0 && height <= maxHeightCm ? height : null;
  }

  if (inputs.heightUnit === "in") {
    const height = Number(inputs.height);
    return Number.isFinite(height) && height > 0 && height <= maxHeightInches
      ? height * 2.54
      : null;
  }

  const feet = Number(inputs.heightFeet || 0);
  const inches = Number(inputs.heightInches || 0);

  if (!Number.isFinite(feet) || !Number.isFinite(inches) || feet < 0 || inches < 0) return null;

  const totalInches = feet * 12 + inches;
  return totalInches > 0 && totalInches <= maxHeightInches ? totalInches * 2.54 : null;
}
