import type { ComponentProps, ReactNode } from "react";
import { FoodLibraryView } from "./FoodLibraryView";
import { HomeView } from "./HomeView";
import { LogView, type LogViewProps } from "./LogView";
import { ProfileView } from "./ProfileView";
import { WeightView } from "./WeightView";
import CycleView from "./CycleView";
import type { AppView } from "../appSupport";

type AppViewRouterProps = {
  appView: string;
  onNavigate: (view: AppView) => void;
  bottomNav: ReactNode;
  homeProps: Omit<ComponentProps<typeof HomeView>, "bottomNav">;
  profileProps: Omit<ComponentProps<typeof ProfileView>, "bottomNav">;
  weightProps: Omit<ComponentProps<typeof WeightView>, "bottomNav" | "healthTabs">;
  libraryProps: Omit<ComponentProps<typeof FoodLibraryView>, "bottomNav">;
  logProps: Omit<LogViewProps, "bottomNav">;
};

export function AppViewRouter({
  appView,
  onNavigate,
  bottomNav,
  homeProps,
  profileProps,
  weightProps,
  libraryProps,
  logProps,
}: AppViewRouterProps) {
  const showCycleInHealth = profileProps.profile?.trackCycle !== false;
  const healthTabs = (
    <div className="health-tabs" role="tablist" aria-label="Health views">
      <button
        type="button"
        className={appView === "weight" ? "active" : ""}
        onClick={() => onNavigate("weight")}
        role="tab"
        aria-selected={appView === "weight"}
      >
        Weight
      </button>
      {showCycleInHealth && (
        <button
          type="button"
          className={appView === "egg-oracle" ? "active" : ""}
          onClick={() => onNavigate("egg-oracle")}
          role="tab"
          aria-selected={appView === "egg-oracle"}
        >
          Cycle
        </button>
      )}
    </div>
  );

  if (appView === "home") {
    return <HomeView bottomNav={bottomNav} {...homeProps} />;
  }

  if (appView === "egg-oracle") {
    return <CycleView bottomNav={bottomNav} healthTabs={healthTabs} />;
  }

  if (appView === "profile") {
    return <ProfileView bottomNav={bottomNav} {...profileProps} />;
  }

  if (appView === "weight") {
    return <WeightView bottomNav={bottomNav} healthTabs={healthTabs} {...weightProps} />;
  }

  if (appView === "library") {
    return <FoodLibraryView bottomNav={bottomNav} {...libraryProps} />;
  }

  return <LogView bottomNav={bottomNav} {...logProps} />;
}
