"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "fluid-mode";

interface FluidModeContextValue {
  fluid: boolean;
  setFluid: (value: boolean) => void;
}

const FluidModeContext = createContext<FluidModeContextValue | null>(null);

export function FluidModeProvider({ children }: { children: React.ReactNode }) {
  const [fluid, setFluidState] = useState(false);

  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      // ignore, keep default
    }
    setFluidState(stored);
    document.documentElement.classList.toggle("fluid", stored);
  }, []);

  function setFluid(value: boolean) {
    setFluidState(value);
    document.documentElement.classList.toggle("fluid", value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // ignore quota errors
    }
  }

  return (
    <FluidModeContext.Provider value={{ fluid, setFluid }}>{children}</FluidModeContext.Provider>
  );
}

export function useFluidMode(): FluidModeContextValue {
  const ctx = useContext(FluidModeContext);
  if (!ctx) throw new Error("useFluidMode must be used within FluidModeProvider");
  return ctx;
}
