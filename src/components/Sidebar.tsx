"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Plane,
  LayoutDashboard,
  Users,
  Euro,
  School,
  Settings,
  Settings2,
  Archive,
  Shield,
  Menu,
  X,
  LogOut,
  Calendar,
  FileSignature,
  CalendarPlus,
  UserCheck,
  Upload,
  Mail,
} from "lucide-react";

const iconMap: Record<string, any> = {
  LayoutDashboard,
  Users,
  Plane,
  Euro,
  School,
  Settings,
  Settings2,
  Archive,
  Shield,
  Calendar,
  FileSignature,
  CalendarPlus,
  UserCheck,
  Upload,
  Mail,
};

function getNav(roles: string[]) {
  const items: { key: string; label: string; icon: string; href: string }[] =
    [];
  const add = (k: string, l: string, i: string, h: string, r: string[]) => {
    if (roles.some((x) => r.includes(x)))
      items.push({ key: k, label: l, icon: i, href: h });
  };

  // SuperAdmin
  add("dashboard", "Tableau de bord", "LayoutDashboard", "/dashboard", [
    "superadmin",
    "coordinateur",
    "pilote",
    "gerant",
    "parent",
  ]);
  add("eleves", "Élèves", "Users", "/dashboard/eleves", [
    "superadmin",
    "coordinateur",
    "gerant",
  ]);
  add("vols", "Planning vols", "Plane", "/dashboard/vols", [
    "superadmin",
    "coordinateur",
    "pilote",
    "gerant",
  ]);
  add("finances", "Finances", "Euro", "/dashboard/finances", ["superadmin"]);
  add(
    "etablissements",
    "Établissements",
    "School",
    "/dashboard/etablissements",
    ["superadmin", "coordinateur"],
  );
  add("pilotes", "Pilotes", "UserCheck", "/dashboard/pilotes", ["superadmin"]);
  add("aeronefs", "Aéronefs", "Settings", "/dashboard/aeronefs", [
    "superadmin",
  ]);
  add(
    "utilisateurs",
    "Utilisateurs & Rôles",
    "Shield",
    "/dashboard/utilisateurs",
    ["superadmin"],
  );
  add("parametres", "Paramètres", "Settings2", "/dashboard/parametres", [
    "superadmin",
  ]);
  add("import", "Import CSV", "Upload", "/dashboard/import", ["superadmin"]);
  add("messagerie", "Messagerie", "Mail", "/dashboard/messagerie", ["superadmin"]);
  add("archives", "Archives", "Archive", "/dashboard/archives", ["superadmin"]);

  // Parent specific
  add(
    "attestation",
    "Attestation parentale",
    "FileSignature",
    "/dashboard/attestation",
    ["parent"],
  );
  add(
    "reservation",
    "Réserver un vol",
    "CalendarPlus",
    "/dashboard/reservation",
    ["parent"],
  );
  add("profil", "Mon profil", "UserCheck", "/dashboard/profil", [
    "parent",
    "pilote",
    "gerant",
  ]);

  return items;
}

function getRoleLabel(roles: string[]): string {
  if (roles.includes("superadmin")) return "SuperAdmin";
  const labels: string[] = [];
  if (roles.includes("coordinateur")) labels.push("Coordinateur");
  if (roles.includes("pilote")) labels.push("Pilote");
  if (roles.includes("gerant")) labels.push("Gérant");
  if (roles.includes("parent")) labels.push("Parent");
  return labels.join(" · ") || "Utilisateur";
}

export default function Sidebar({ profile }: { profile: any }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const nav = getNav(profile.roles || []);
  const roleLabel = getRoleLabel(profile.roles || []);

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/auth/connexion");
    router.refresh();
  }

  const Nav = () => (
    <>
      <div className="flex items-center gap-3 px-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center shrink-0 shadow-sm">
          <Plane className="w-[18px] h-[18px] text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-brand-500">BIA Manager</p>
          <p className="text-[10px] text-gray-400">ACBA · {new Date().getFullYear()}</p>
        </div>
      </div>
      <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
        {nav.map((item) => {
          const Icon = iconMap[item.icon] || LayoutDashboard;
          const active = isActive(item.href);
          return (
            <button
              key={item.key}
              onClick={() => {
                router.push(item.href);
                setOpen(false);
              }}
              className={cn(
                "group relative flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-left",
                "transition-all duration-[120ms] cubic-bezier(.34,1.56,.64,1)",
                "active:scale-[0.96] active:transition-none",
                active
                  ? "bg-brand-50 text-brand-500 font-semibold shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800 hover:translate-x-0.5 active:bg-gray-100",
              )}
            >
              {/* Active accent strip */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-500 rounded-r-full" />
              )}
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0 transition-all duration-150",
                  active
                    ? "text-brand-500"
                    : "text-gray-400 group-hover:text-gray-600 group-hover:scale-110",
                )}
              />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-gray-100 pt-3 mt-3">
        <div className="px-3 mb-2">
          <p className="text-xs text-gray-400">Connecté</p>
          <p className="text-sm font-semibold text-gray-900 truncate">
            {profile.prenom} {profile.nom}
          </p>
          <p className="text-[11px] text-gray-400">{roleLabel}</p>
        </div>
        <button
          onClick={logout}
          className="group flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-gray-400 transition-all duration-[120ms] hover:text-red-600 hover:bg-red-50 active:scale-[0.96] active:bg-red-100 active:transition-none"
        >
          <LogOut className="w-3.5 h-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
          Déconnexion
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-50 px-4 flex items-center justify-between lg:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-brand-500">ACBA · BIA</span>
        </div>
        <button onClick={() => setOpen(!open)} className="p-1.5">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed top-14 left-0 bottom-0 w-[270px] bg-white border-r border-gray-200 z-50 p-4 flex flex-col transition-transform lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Nav />
      </aside>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[240px] bg-white border-r border-gray-200 p-4 sticky top-0 h-screen shrink-0 overflow-y-auto">
        <Nav />
      </aside>
    </>
  );
}
