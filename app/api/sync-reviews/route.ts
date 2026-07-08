import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReviewProvider } from "@/lib/providers";
import { runSyncForBranches } from "@/lib/sync/run-sync";
import { checkRateLimit } from "@/lib/rate-limit";

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

const bodySchema = z.object({
  orgId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
});

function rateLimited() {
  return NextResponse.json({ error: "Demasiadas solicitudes, reintentá más tarde." }, { status: 429 });
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
  if (!checkRateLimit("sync-reviews", 5, 60_000).allowed) {
    return rateLimited();
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return handleSync(parsed.data.orgId, parsed.data.branchId);
}

// Disparado por el cron diario de Vercel (Authorization: Bearer CRON_SECRET), sincroniza todas las orgs.
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!checkRateLimit("sync-reviews", 5, 60_000).allowed) {
    return rateLimited();
  }

  return handleSync(undefined, undefined);
}
