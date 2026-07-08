import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAnthropicClient } from "@/lib/analysis/client";
import { runAnalyzeForPending } from "@/lib/analysis/run-analyze";

/**
 * Igual que /api/sync-reviews: consume una API paga (Claude), regulada por
 * el equipo de Contame — solo CRON_SECRET, sin sesión de admin. Ver
 * PROGRESS.md (cambio de scope documentado en el Loop 2).
 */
function isAuthorized(request: Request): boolean {
  const expectedCronSecret = process.env.CRON_SECRET;
  if (!expectedCronSecret) return false;
  return request.headers.get("authorization") === `Bearer ${expectedCronSecret}`;
}

async function handleAnalyze(orgId: string | undefined, branchId: string | undefined) {
  const { status, body } = await runAnalyzeForPending(createAdminClient(), createAnthropicClient(), {
    orgId,
    branchId,
  });
  return NextResponse.json(body, { status });
}

// Disparado por scripts/sync.ts al final de una sync, o manualmente por el equipo de Contame.
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const orgId = typeof body.orgId === "string" ? body.orgId : undefined;
  const branchId = typeof body.branchId === "string" ? body.branchId : undefined;

  return handleAnalyze(orgId, branchId);
}

// Disparado por el cron diario de Vercel (offset después del cron de sync).
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return handleAnalyze(undefined, undefined);
}
