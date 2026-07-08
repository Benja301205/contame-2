import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReviewProvider } from "@/lib/providers/reviews";

type BranchRow = { id: string; org_id: string; google_place_id: string };

export type SyncResult =
  | { branchId: string; fetched: number; new: number }
  | { branchId: string; error: string };

/**
 * Núcleo de la sincronización, sin dependencias de Next (cookies/headers),
 * para poder testearlo directamente contra Supabase local con MockProvider.
 * El route handler solo agrega la autorización (sesión admin o cron secret).
 */
export async function runSyncForBranches(
  admin: SupabaseClient,
  provider: ReviewProvider,
  filters: { orgId?: string; branchId?: string },
): Promise<{ status: number; body: { results?: SyncResult[]; error?: string } }> {
  let branchesQuery = admin
    .from("branches")
    .select("id, org_id, google_place_id")
    .eq("is_active", true);

  if (filters.branchId) branchesQuery = branchesQuery.eq("id", filters.branchId);
  if (filters.orgId) branchesQuery = branchesQuery.eq("org_id", filters.orgId);

  const { data: branches, error: branchesError } = await branchesQuery.returns<BranchRow[]>();

  if (branchesError) {
    return { status: 500, body: { error: branchesError.message } };
  }
  if (filters.branchId && (!branches || branches.length === 0)) {
    return { status: 404, body: { error: "Sucursal no encontrada." } };
  }

  const results: SyncResult[] = [];

  for (const branch of branches ?? []) {
    const { data: job } = await admin
      .from("sync_jobs")
      .insert({ org_id: branch.org_id, branch_id: branch.id, kind: "fetch", status: "running" })
      .select("id")
      .single();

    try {
      const providerReviews = await provider.fetchReviews(branch.google_place_id);

      const { data: inserted, error: insertError } = await admin
        .from("reviews")
        .upsert(
          providerReviews.map((r) => ({
            org_id: branch.org_id,
            branch_id: branch.id,
            provider_review_id: r.providerReviewId,
            author_name: r.authorName,
            rating: r.rating,
            text: r.text,
            review_date: r.reviewDate,
            analysis_status: "pending" as const,
          })),
          { onConflict: "branch_id,provider_review_id", ignoreDuplicates: true },
        )
        .select("id");

      if (insertError) throw insertError;

      const stats = { fetched: providerReviews.length, new: inserted?.length ?? 0 };

      if (job) {
        await admin
          .from("sync_jobs")
          .update({ status: "success", finished_at: new Date().toISOString(), stats })
          .eq("id", job.id);
      }

      results.push({ branchId: branch.id, ...stats });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido.";

      if (job) {
        await admin
          .from("sync_jobs")
          .update({ status: "failed", finished_at: new Date().toISOString(), error: message })
          .eq("id", job.id);
      }

      results.push({ branchId: branch.id, error: message });
    }
  }

  return { status: 200, body: { results } };
}
