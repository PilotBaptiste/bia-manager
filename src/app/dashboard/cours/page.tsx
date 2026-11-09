import { requireModulePage } from "@/lib/auth";
import CoursClient from "./CoursClient";

const ROLES = ["superadmin", "coordinateur", "pilote", "gerant", "parent"];
const GESTIONNAIRES = ["superadmin", "coordinateur"];

export default async function CoursPage() {
  const profile = await requireModulePage("cours", ROLES);
  const roles: string[] = profile.roles || [];
  return <CoursClient peutGerer={roles.some((r) => GESTIONNAIRES.includes(r))} />;
}
