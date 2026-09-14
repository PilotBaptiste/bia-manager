"use client";
import { createContext, useContext } from "react";
import type { ClubInfo } from "@/lib/club";

const ClubContext = createContext<ClubInfo>({
  nom: "BIA Manager",
  sigle: "",
  email: "",
  telephone: "",
  lieuVol: "",
  whatsapp: "",
  telephoneSupport: "",
});

export function ClubProvider({ club, children }: { club: ClubInfo; children: React.ReactNode }) {
  return <ClubContext.Provider value={club}>{children}</ClubContext.Provider>;
}

export function useClub() {
  return useContext(ClubContext);
}
