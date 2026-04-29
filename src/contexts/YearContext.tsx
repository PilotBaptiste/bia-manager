"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Annee {
  id: string;
  label: string;
  active: boolean;
  date_debut: string;
  date_fin: string;
}

interface YearContextType {
  annees: Annee[];
  /** Année affichée dans les vues (peut être n'importe quelle année) */
  selectedAnneeId: string;
  setSelectedAnneeId: (id: string) => void;
  selectedAnnee: Annee | null;
  /** Année active = celle où on crée les nouveaux élèves/créneaux */
  activeAnneeId: string;
  loading: boolean;
}

const YearContext = createContext<YearContextType>({
  annees: [],
  selectedAnneeId: "",
  setSelectedAnneeId: () => {},
  selectedAnnee: null,
  activeAnneeId: "",
  loading: true,
});

const LS_KEY = "bia_selected_annee";

export function YearProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [annees, setAnnees] = useState<Annee[]>([]);
  const [selectedAnneeId, setSelectedAnneeIdState] = useState<string>("");
  const [activeAnneeId, setActiveAnneeId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("annees")
        .select("*")
        .order("date_debut", { ascending: false });
      const list = (data || []) as Annee[];
      setAnnees(list);

      const active = list.find((a) => a.active);
      if (active) setActiveAnneeId(active.id);

      // Restore last selection from localStorage if still valid
      const stored = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
      const storedValid = stored && list.find((a) => a.id === stored);
      if (storedValid) {
        setSelectedAnneeIdState(stored);
      } else {
        // Default to active year (or first in list)
        const defaultId = active?.id || list[0]?.id || "";
        setSelectedAnneeIdState(defaultId);
        if (defaultId && typeof window !== "undefined") {
          localStorage.setItem(LS_KEY, defaultId);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  function setSelectedAnneeId(id: string) {
    setSelectedAnneeIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY, id);
  }

  const selectedAnnee = annees.find((a) => a.id === selectedAnneeId) ?? null;

  return (
    <YearContext.Provider
      value={{ annees, selectedAnneeId, setSelectedAnneeId, selectedAnnee, activeAnneeId, loading }}
    >
      {children}
    </YearContext.Provider>
  );
}

export function useYear() {
  return useContext(YearContext);
}
