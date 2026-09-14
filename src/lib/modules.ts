// Optional features switched on club by club from the owner console (organisations.modules).
// A module that is not enabled for the club is invisible: no menu entry, and its pages redirect to the dashboard.
export type ModuleDef = {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: string;
  roles: string[];
};

export const MODULES: ModuleDef[] = [
  {
    key: "laboratoire",
    label: "Laboratoire",
    description: "Onglet d'essai pour tester une nouveauté sur un seul aéroclub avant de la proposer aux autres.",
    href: "/dashboard/laboratoire",
    icon: "FlaskConical",
    roles: ["superadmin", "coordinateur", "pilote", "gerant"],
  },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);
