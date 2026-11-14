"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Annee {
  id: string;
  label: string;
  active: boolean;
  date_debut: string;
  date_fin: string;
  date_examen_bia: string | null;
}

interface YearContextType {
  annees: Annee[];
  /** Année affichée dans les vues (peut être n'importe quelle année) */
  selectedAnneeId: string;
  setSelectedAnneeId: (id: string) => void;
  selectedAnnee: Annee | null;
  /**
   * Année sur laquelle écrivent les créations faites depuis le tableau de bord :
   * élèves, créneaux, import. C'est celle du sélecteur, pas l'année active, pour
   * qu'un club puisse préparer l'année suivante pendant que l'année en cours tourne.
   */
  anneeDeTravail: string;
  /** Année en cours du club (marquée ★). Sert aux écrans sans sélecteur : inscription publique, emails. */
  activeAnneeId: string;
  /** Date de l'examen BIA de l'année active (null si non renseignée) */
  activeExamDate: string | null;
  loading: boolean;
  refreshAnnees: () => Promise<void>;
}

const YearContext = createContext<YearContextType>({
  annees: [],
  selectedAnneeId: "",
  setSelectedAnneeId: () => {},
  selectedAnnee: null,
  anneeDeTravail: "",
  activeAnneeId: "",
  activeExamDate: null,
  loading: true,
  refreshAnnees: async () => {},
});

const LS_KEY = "bia_selected_annee";

export function YearProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [annees, setAnnees] = useState<Annee[]>([]);
  const [selectedAnneeId, setSelectedAnneeIdState] = useState<string>("");
  const [activeAnneeId, setActiveAnneeId] = useState<string>("");
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    load();
  }, []);

  function setSelectedAnneeId(id: string) {
    setSelectedAnneeIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY, id);
  }

  const selectedAnnee = annees.find((a) => a.id === selectedAnneeId) ?? null;
  const activeExamDate = annees.find((a) => a.id === activeAnneeId)?.date_examen_bia ?? null;
  // Repli sur l'année en cours tant que le sélecteur n'est pas chargé.
  const anneeDeTravail = selectedAnneeId || activeAnneeId;

  return (
    <YearContext.Provider
      value={{ annees, selectedAnneeId, setSelectedAnneeId, selectedAnnee, anneeDeTravail, activeAnneeId, activeExamDate, loading, refreshAnnees: load }}
    >
      {children}
    </YearContext.Provider>
  );
}

export function useYear() {
  return useContext(YearContext);
}
