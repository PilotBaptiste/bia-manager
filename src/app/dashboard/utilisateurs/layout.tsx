import { requireRolePage } from "@/lib/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRolePage(["superadmin", "coordinateur"]);
  return <>{children}</>;
}
