import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { SEED_ORGS, SEED_PASSWORD } from "@/lib/seed-data";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function signIn(email: string) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw error;
  return client;
}

describe("RLS de review_analysis (Loop 3)", () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let orgAId: string;
  let assignedBranchId: string;
  let unassignedBranchId: string;
  let assignedReviewId: string;
  let unassignedReviewId: string;

  beforeAll(async () => {
    const { data: org } = await admin
      .from("organizations")
      .select("id")
      .eq("name", SEED_ORGS[0].name)
      .single();
    orgAId = org!.id;

    const { data: managerProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("org_id", orgAId)
      .eq("full_name", `Gerente ${SEED_ORGS[0].name}`)
      .single();

    const suffix = Math.random().toString(36).slice(2, 8);

    const { data: assignedBranch } = await admin
      .from("branches")
      .insert({ org_id: orgAId, name: `Sucursal analysis A ${suffix}`, google_place_id: `place-an-a-${suffix}` })
      .select("id")
      .single();
    assignedBranchId = assignedBranch!.id;

    const { data: unassignedBranch } = await admin
      .from("branches")
      .insert({ org_id: orgAId, name: `Sucursal analysis B ${suffix}`, google_place_id: `place-an-b-${suffix}` })
      .select("id")
      .single();
    unassignedBranchId = unassignedBranch!.id;

    await admin.from("branch_managers").insert({ branch_id: assignedBranchId, profile_id: managerProfile!.id });

    const { data: assignedReview } = await admin
      .from("reviews")
      .insert({
        org_id: orgAId,
        branch_id: assignedBranchId,
        provider_review_id: `rev-an-a-${suffix}`,
        rating: 5,
        text: "Buenísimo",
        review_date: "2026-06-01",
      })
      .select("id")
      .single();
    assignedReviewId = assignedReview!.id;

    const { data: unassignedReview } = await admin
      .from("reviews")
      .insert({
        org_id: orgAId,
        branch_id: unassignedBranchId,
        provider_review_id: `rev-an-b-${suffix}`,
        rating: 1,
        text: "Malísimo",
        review_date: "2026-06-02",
      })
      .select("id")
      .single();
    unassignedReviewId = unassignedReview!.id;

    await admin.from("review_analysis").insert([
      {
        review_id: assignedReviewId,
        sentiment: "positive",
        categories: [],
        severity: 1,
        mentions_compensation: false,
        summary: "Buenísimo",
        model: "test",
      },
      {
        review_id: unassignedReviewId,
        sentiment: "negative",
        categories: ["calidad_comida"],
        severity: 3,
        mentions_compensation: false,
        summary: "Malísimo",
        model: "test",
      },
    ]);
  });

  it("el manager solo lee análisis de reviews de sus sucursales asignadas", async () => {
    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);
    const { data, error } = await managerClient
      .from("review_analysis")
      .select("review_id")
      .in("review_id", [assignedReviewId, unassignedReviewId]);

    expect(error).toBeNull();
    const ids = data!.map((r) => r.review_id);
    expect(ids).toContain(assignedReviewId);
    expect(ids).not.toContain(unassignedReviewId);
  });

  it("el admin lee análisis de todas las reviews de su org", async () => {
    const adminClient = await signIn(`admin.${SEED_ORGS[0].slug}@contame.test`);
    // Acotado por review_id: un select sin filtro puede chocar con el
    // límite default de 1000 filas de PostgREST si la org acumula muchas
    // reviews de otros tests corriendo en paralelo.
    const { data } = await adminClient
      .from("review_analysis")
      .select("review_id")
      .in("review_id", [assignedReviewId, unassignedReviewId]);

    const ids = data!.map((r) => r.review_id);
    expect(ids).toContain(assignedReviewId);
    expect(ids).toContain(unassignedReviewId);
  });
});
