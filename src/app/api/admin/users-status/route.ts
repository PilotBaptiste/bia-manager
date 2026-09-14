import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;

/**
 * GET /api/admin/users-status
 * Returns a map of { [userId]: { confirmed: boolean } } using the service role.
 * "confirmed" = the user has set their password and activated their account.
 */
export async function GET() {
  const auth = await requireRole(["superadmin"]);
  if (auth instanceof NextResponse) return auth;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({});
  }

  const supabase = createServiceClient();

  const clubIds = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("organisation_id", auth.orgId!)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) return NextResponse.json({});
    for (const p of data ?? []) clubIds.add(p.id);
    if (!data || data.length < PAGE_SIZE) break;
  }

  const statusMap: Record<string, { confirmed: boolean }> = {};
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) return NextResponse.json(statusMap);
    const users = data.users ?? [];
    for (const u of users) {
      if (!clubIds.has(u.id)) continue;
      statusMap[u.id] = {
        confirmed: !!(u.confirmed_at || u.email_confirmed_at),
      };
    }
    if (users.length < PAGE_SIZE) break;
  }

  return NextResponse.json(statusMap);
}
