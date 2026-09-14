"use client";
import { createContext, useContext } from "react";

const ModulesContext = createContext<string[]>([]);

export function ModulesProvider({ modules, children }: { modules: string[]; children: React.ReactNode }) {
  return <ModulesContext.Provider value={modules}>{children}</ModulesContext.Provider>;
}

export function useModule(key: string) {
  return useContext(ModulesContext).includes(key);
}
