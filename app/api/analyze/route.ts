import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAnthropicClient } from "@/lib/analysis/client";
import { runAnalyzeForPending } from "@/lib/analysis/run-analyze";
import { checkRateLimit } from "@/lib/rate-limit";

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

const bodySchema = z.object({
  orgId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
});

function rateLimited() {
  return NextResponse.json({ error: "Demasiadas solicitudes, reintentá más tarde." }, { status: 429 });
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
  if (!checkRateLimit("analyze", 5, 60_000).allowed) {
    return rateLimited();
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return handleAnalyze(parsed.data.orgId, parsed.data.branchId);
}

// Disparado por el cron diario de Vercel (offset después del cron de sync).
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!checkRateLimit("analyze", 5, 60_000).allowed) {
    return rateLimited();
  }

  return handleAnalyze(undefined, undefined);
}
