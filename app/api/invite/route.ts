import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  branchIds: z.array(z.string().uuid()).default([]),
});

export async function POST(request: Request) {
  const profile = await getCurrentProfile();

  if (!profile) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Solo un admin puede invitar." }, { status: 403 });
  }

  const parsed = inviteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, fullName, branchIds } = parsed.data;

  const admin = createAdminClient();

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      data: { org_id: profile.orgId, role: "manager", full_name: fullName },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  );

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  if (branchIds.length > 0) {
    const supabase = await createClient();
    const { error: assignError } = await supabase.from("branch_managers").insert(
      branchIds.map((branchId) => ({ branch_id: branchId, profile_id: invited.user.id })),
    );

    if (assignError) {
      return NextResponse.json({ error: assignError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ userId: invited.user.id });
}
