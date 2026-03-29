import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/users-status
 * Returns a map of { [userId]: { confirmed: boolean } } using the service role.
 * "confirmed" = the user has set their password and activated their account.
 */
export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({});
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({});

  const statusMap: Record<string, { confirmed: boolean }> = {};
  for (const u of users) {
    statusMap[u.id] = {
      confirmed: !!(u.confirmed_at || u.email_confirmed_at),
    };
  }

  return NextResponse.json(statusMap);
}
