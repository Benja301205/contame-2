import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeOrgLoss } from "@/lib/loss/engine";

/**
 * Igual política que /api/sync-reviews y /api/analyze: solo CRON_SECRET.
 * El botón "Recalcular" de Settings no pasa por acá — es una Server Action
 * que llama a lib/loss/engine.ts directo con sesión de admin (ver
 * lib/actions/loss.ts). Este endpoint es para el cron mensual y scripts.
 */
function isAuthorized(request: Request): boolean {
  const expectedCronSecret = process.env.CRON_SECRET;
  if (!expectedCronSecret) return false;
  return request.headers.get("authorization") === `Bearer ${expectedCronSecret}`;
}

async function handleRecompute(orgId: string | undefined) {
  const admin = createAdminClient();

  if (orgId) {
    const results = await recomputeOrgLoss(admin, orgId);
    return NextResponse.json({ results });
  }

  const { data: orgs } = await admin.from("organizations").select("id");
  const results = [];
  for (const org of orgs ?? []) {
    results.push(...(await recomputeOrgLoss(admin, org.id)));
  }
  return NextResponse.json({ results });
}

// Disparado manualmente (scripts) con CRON_SECRET, filtrando por org.
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const orgId = typeof body.orgId === "string" ? body.orgId : undefined;

  return handleRecompute(orgId);
}

// Disparado por el cron mensual de Vercel: recalcula todas las orgs.
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return handleRecompute(undefined);
}
