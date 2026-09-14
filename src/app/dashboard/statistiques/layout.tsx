import { requireModulePage } from "@/lib/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModulePage("statistiques", ["superadmin"]);
  return <>{children}</>;
}
