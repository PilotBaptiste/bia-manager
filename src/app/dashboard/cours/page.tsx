import { requireModulePage } from "@/lib/auth";
import CoursClient from "./CoursClient";

const ROLES = ["superadmin", "coordinateur", "pilote", "gerant", "parent"];
const GESTIONNAIRES = ["superadmin", "coordinateur"];
// Un pilote ou un gérant n'a pas d'enfant inscrit : il consulte les cours sans progression.
const EQUIPE = ["superadmin", "coordinateur", "pilote", "gerant"];

export default async function CoursPage() {
  const profile = await requireModulePage("cours", ROLES);
  const roles: string[] = profile.roles || [];
  return (
    <CoursClient
      peutGerer={roles.some((r) => GESTIONNAIRES.includes(r))}
      estEquipe={roles.some((r) => EQUIPE.includes(r))}
    />
  );
}
