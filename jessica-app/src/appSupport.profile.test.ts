import { describe, expect, it } from "vitest";
import { calculateProfile, getProfileValidationErrors, type ProfileForm } from "./appSupport";

const metricForm: ProfileForm = {
  name: "",
  units: "metric",
  trackCycle: false,
  age: "34",
  sex: "female",
  heightCm: "165",
  heightFeet: "5",
  heightInches: "4",
  weight: "70",
  goalWeight: "",
  activityLevel: "moderate",
  goal: "lose",
  weeklyRateKg: "0.5",
  useManualCalories: false,
  manualCalorieOverride: "",
  macroMode: "none",
  macroPreset: "custom",
  proteinPct: "30",
  carbPct: "40",
  fatPct: "30",
  proteinGrams: "",
  carbGrams: "",
  fatGrams: "",
};

describe("calculateProfile", () => {
  it("computes Mifflin-St Jeor for a metric female losing 0.5 kg/week", () => {
    expect(calculateProfile(metricForm)).toEqual({
      bmr: 1400,
      tdee: 2170,
      goalAdjustment: -550,
      calculatedCalories: 1620,
      activeCalories: 1620,
    });
  });

  it("computes an imperial male gaining 0.25 kg/week", () => {
    const form: ProfileForm = {
      ...metricForm,
      units: "imperial",
      sex: "male",
      age: "28",
      heightFeet: "5",
      heightInches: "10",
      weight: "180",
      activityLevel: "active",
      goal: "gain",
      weeklyRateKg: "0.25",
    };
    expect(calculateProfile(form)).toEqual({
      bmr: 1793,
      tdee: 3092,
      goalAdjustment: 275,
      calculatedCalories: 3367,
      activeCalories: 3367,
    });
  });

  it("applies no adjustment when maintaining", () => {
    const result = calculateProfile({ ...metricForm, goal: "maintain" });
    expect(result?.goalAdjustment).toBe(0);
    expect(result?.calculatedCalories).toBe(2170);
  });

  it("clamps the weight-loss deficit at 1000 kcal", () => {
    const result = calculateProfile({ ...metricForm, weeklyRateKg: "1" });
    expect(result?.goalAdjustment).toBe(-1000);
    expect(result?.calculatedCalories).toBe(1170);
  });

  it("uses the manual override as active calories without changing the calculation", () => {
    const result = calculateProfile({ ...metricForm, useManualCalories: true, manualCalorieOverride: "1800" });
    expect(result?.calculatedCalories).toBe(1620);
    expect(result?.activeCalories).toBe(1800);
  });

  it("returns null for out-of-range or non-integer inputs", () => {
    expect(calculateProfile({ ...metricForm, age: "12" })).toBeNull();
    expect(calculateProfile({ ...metricForm, age: "34.5" })).toBeNull();
    expect(calculateProfile({ ...metricForm, weight: "20" })).toBeNull();
    expect(calculateProfile({ ...metricForm, heightCm: "90" })).toBeNull();
  });

  it("accepts comma decimal separators", () => {
    const result = calculateProfile({ ...metricForm, weight: "70,0" });
    expect(result?.bmr).toBe(1400);
  });
});

describe("getProfileValidationErrors", () => {
  it("returns no errors for a valid form", () => {
    expect(getProfileValidationErrors(metricForm)).toEqual({});
  });

  it("requires age, height, and weight", () => {
    const errors = getProfileValidationErrors({ ...metricForm, age: "", heightCm: "", weight: "" });
    expect(errors.age).toBe("Age is required.");
    expect(errors.height).toBeDefined();
    expect(errors.weight).toBe("Current weight is required.");
  });

  it("requires macro percentages to total 100", () => {
    const errors = getProfileValidationErrors({
      ...metricForm,
      macroMode: "percentages",
      proteinPct: "30",
      carbPct: "40",
      fatPct: "31",
    });
    expect(errors.macros).toBe("Macro percentages must total exactly 100%.");
  });
});
