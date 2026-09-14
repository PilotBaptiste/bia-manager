import { requireModulePage } from "@/lib/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModulePage("attestation_en_ligne", ["parent", "superadmin"]);
  return <>{children}</>;
}
