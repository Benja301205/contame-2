import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeOrgLoss } from "@/lib/loss/engine";
import { checkRateLimit } from "@/lib/rate-limit";

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

const bodySchema = z.object({
  orgId: z.string().uuid().optional(),
});

function rateLimited() {
  return NextResponse.json({ error: "Demasiadas solicitudes, reintentá más tarde." }, { status: 429 });
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
  if (!checkRateLimit("recompute-loss", 10, 60_000).allowed) {
    return rateLimited();
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return handleRecompute(parsed.data.orgId);
}

// Disparado por el cron mensual de Vercel: recalcula todas las orgs.
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!checkRateLimit("recompute-loss", 10, 60_000).allowed) {
    return rateLimited();
  }

  return handleRecompute(undefined);
}
