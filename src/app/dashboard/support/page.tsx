import { getCurrentProfile } from "@/lib/auth";
import SupportClient from "./SupportClient";

// Les responsables du club voient en plus le formulaire de contact de l'équipe BIA Manager.
const RESPONSABLES = ["superadmin", "coordinateur", "gerant"];

export default async function SupportPage() {
  const profile = await getCurrentProfile();
  const roles: string[] = profile.roles || [];
  return <SupportClient estResponsable={roles.some((r) => RESPONSABLES.includes(r))} />;
}
