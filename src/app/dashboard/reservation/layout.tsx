import { requireRolePage } from "@/lib/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireRolePage(["parent", "superadmin"]);
  return <>{children}</>;
}
