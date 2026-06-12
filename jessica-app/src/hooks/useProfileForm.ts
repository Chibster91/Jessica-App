import { useState, type Dispatch, type SetStateAction } from "react";
import {
  calculateProfile,
  cmToTotalInches,
  formatProfileNumber,
  getProfileGoalWeightKg,
  getProfileHeightCm,
  getProfileValidationErrors,
  getProfileWeightKg,
  getSavedGoals,
  getSavedProfile,
  kgToLb,
  macroPresets,
  profileFormFromLegacyGoals,
  profileFormToProfile,
  profileToForm,
  profileToGoals,
  setStorageJson,
  type AppView,
  type Goals,
  type Profile,
  type ProfileForm,
} from "../appSupport";

type UseProfileFormArgs = {
  profile: Profile | null;
  setProfile: Dispatch<SetStateAction<Profile | null>>;
  setGoals: Dispatch<SetStateAction<Goals | null>>;
  setAppView: Dispatch<SetStateAction<AppView>>;
  hasSavedLocalAppData: () => boolean;
};

export function useProfileForm({
  profile,
  setProfile,
  setGoals,
  setAppView,
  hasSavedLocalAppData,
}: UseProfileFormArgs) {
  const [profileForm, setProfileForm] = useState<ProfileForm>(() => {
    const savedProfile = getSavedProfile();
    return savedProfile ? profileToForm(savedProfile) : profileFormFromLegacyGoals(getSavedGoals());
  });
  const [profileSaveStatus, setProfileSaveStatus] = useState("");
  const [profileWizardStep, setProfileWizardStep] = useState(0);
  const [isProfileWizardOpen, setIsProfileWizardOpen] = useState(() => !hasSavedLocalAppData());

  function updateProfileForm(updates: Partial<ProfileForm>) {
    setProfileForm((current) => {
      const next = { ...current, ...updates };

      if (updates.units && updates.units !== current.units) {
        const currentHeightCm = getProfileHeightCm(current);
        const currentWeightKg = getProfileWeightKg(current);
        const currentGoalWeightKg = getProfileGoalWeightKg(current);

        if (currentHeightCm !== null) {
          const totalInches = cmToTotalInches(currentHeightCm);
          next.heightCm = formatProfileNumber(currentHeightCm, 1);
          next.heightFeet = String(Math.floor(totalInches / 12));
          next.heightInches = formatProfileNumber(totalInches % 12, 1);
        }

        if (currentWeightKg !== null) {
          next.weight = updates.units === "metric"
            ? formatProfileNumber(currentWeightKg, 1)
            : formatProfileNumber(kgToLb(currentWeightKg), 1);
        }

        if (currentGoalWeightKg !== null) {
          next.goalWeight = updates.units === "metric"
            ? formatProfileNumber(currentGoalWeightKg, 1)
            : formatProfileNumber(kgToLb(currentGoalWeightKg), 1);
        }
      }

      if (updates.goal === "maintain") {
        next.weeklyRateKg = "0.5";
      }

      if (updates.macroPreset && updates.macroPreset !== "custom") {
        const preset = macroPresets[updates.macroPreset];
        next.macroMode = "percentages";
        next.proteinPct = preset.proteinPct;
        next.carbPct = preset.carbPct;
        next.fatPct = preset.fatPct;
      }

      if (updates.macroPreset === "custom") {
        next.macroMode = "percentages";
      }

      return next;
    });
    setProfileSaveStatus("");
  }

  function cancelProfileChanges() {
    if (!profile) return;
    setProfileForm(profileToForm(profile));
    setProfileSaveStatus("");
    setIsProfileWizardOpen(false);
    setProfileWizardStep(0);
  }

  function saveProfile() {
    const errors = getProfileValidationErrors(profileForm);
    if (Object.keys(errors).length > 0) return;

    const nextProfile = profileFormToProfile(profileForm, profile);
    if (!nextProfile) return;

    if (profile) setStorageJson("profile_backup", profile);
    const savedProfile = setStorageJson("profile", nextProfile);
    if (!savedProfile) {
      setProfileSaveStatus("Profile could not be saved in this browser.");
      return;
    }

    const nextGoals = profileToGoals(nextProfile);
    setStorageJson("goals", nextGoals);
    setProfile(nextProfile);
    setProfileForm(profileToForm(nextProfile));
    setGoals(nextGoals);
    setProfileSaveStatus("Profile saved.");
    setIsProfileWizardOpen(false);
    setProfileWizardStep(0);
    setAppView("profile");
  }

  function setCycleTrackingPreference(trackCycle: boolean) {
    setProfileForm((current) => ({ ...current, trackCycle }));
    if (!profile) return;

    const nextProfile: Profile = {
      ...profile,
      trackCycle,
      profileUpdatedAt: new Date().toISOString(),
    };
    const savedProfile = setStorageJson("profile", nextProfile);
    if (!savedProfile) {
      setProfileSaveStatus("Profile could not be saved in this browser.");
      return;
    }

    setProfile(nextProfile);
    setProfileForm(profileToForm(nextProfile));
    setProfileSaveStatus("Profile saved.");
  }

  const profileCalculation = calculateProfile(profileForm);
  const profileErrors = getProfileValidationErrors(profileForm);
  const profileHasBlockingErrors = Object.keys(profileErrors).length > 0 || profileCalculation === null;
  const profileLowCalorieThreshold = profileForm.sex === "female" ? 1200 : 1500;
  const profileLowCalorieWarning =
    profileCalculation && profileCalculation.activeCalories < profileLowCalorieThreshold
      ? `This target is below ${profileLowCalorieThreshold} kcal/day. Consider a slower rate.`
      : "";

  return {
    profileForm,
    setProfileForm,
    profileSaveStatus,
    setProfileSaveStatus,
    profileWizardStep,
    setProfileWizardStep,
    isProfileWizardOpen,
    setIsProfileWizardOpen,
    updateProfileForm,
    cancelProfileChanges,
    saveProfile,
    setCycleTrackingPreference,
    profileCalculation,
    profileErrors,
    profileHasBlockingErrors,
    profileLowCalorieWarning,
  };
}
