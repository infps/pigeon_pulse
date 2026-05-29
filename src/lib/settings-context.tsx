"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type VelocityUnit = "YPM" | "MPM";
export type SexTerminology = "traditional" | "neutral";

interface Settings {
  velocityUnit: VelocityUnit;
  sexTerminology: SexTerminology;
  setVelocityUnit: (v: VelocityUnit) => void;
  setSexTerminology: (v: SexTerminology) => void;
}

const SettingsContext = createContext<Settings>({
  velocityUnit: "YPM",
  sexTerminology: "traditional",
  setVelocityUnit: () => {},
  setSexTerminology: () => {},
});

const STORAGE_KEY = "pigeon-pulse-settings";

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [velocityUnit, setVelocityUnitState] = useState<VelocityUnit>("YPM");
  const [sexTerminology, setSexTerminologyState] = useState<SexTerminology>("traditional");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.velocityUnit === "YPM" || parsed.velocityUnit === "MPM") {
          setVelocityUnitState(parsed.velocityUnit);
        }
        if (parsed.sexTerminology === "traditional" || parsed.sexTerminology === "neutral") {
          setSexTerminologyState(parsed.sexTerminology);
        }
      }
    } catch {}
  }, []);

  const persist = (patch: Partial<{ velocityUnit: VelocityUnit; sexTerminology: SexTerminology }>) => {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
    } catch {}
  };

  const setVelocityUnit = (v: VelocityUnit) => {
    setVelocityUnitState(v);
    persist({ velocityUnit: v });
  };

  const setSexTerminology = (v: SexTerminology) => {
    setSexTerminologyState(v);
    persist({ sexTerminology: v });
  };

  return (
    <SettingsContext.Provider value={{ velocityUnit, sexTerminology, setVelocityUnit, setSexTerminology }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
