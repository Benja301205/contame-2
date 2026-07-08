import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReviewProvider } from "@/lib/providers";
import { runSyncForBranches } from "@/lib/sync/run-sync";

/**
 * Las syncs de reviews consumen una API paga (Apify) y quedan reguladas por
 * el equipo de Contame, no por el admin del cliente: el único acceso es con
 * CRON_SECRET (cron de Vercel o scripts/sync.ts). Ver PROGRESS.md.
 */
function isAuthorized(request: Request): boolean {
  const expectedCronSecret = process.env.CRON_SECRET;
  if (!expectedCronSecret) return false;
  return request.headers.get("authorization") === `Bearer ${expectedCronSecret}`;
}

async function handleSync(orgId: string | undefined, branchId: string | undefined) {
  const { status, body } = await runSyncForBranches(createAdminClient(), getReviewProvider(), {
    orgId,
    branchId,
  });
  return NextResponse.json(body, { status });
}

// Disparado por scripts/sync.ts (operación interna de Contame): Authorization: Bearer CRON_SECRET.
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const orgId = typeof body.orgId === "string" ? body.orgId : undefined;
  const branchId = typeof body.branchId === "string" ? body.branchId : undefined;

  return handleSync(orgId, branchId);
}

// Disparado por el cron diario de Vercel (Authorization: Bearer CRON_SECRET), sincroniza todas las orgs.
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return handleSync(undefined, undefined);
}
