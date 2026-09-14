import { requireModulePage } from "@/lib/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModulePage("reglementation", ["superadmin", "coordinateur", "gerant", "pilote"]);
  return <>{children}</>;
}
