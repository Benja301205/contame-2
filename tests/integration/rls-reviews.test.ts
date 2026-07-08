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

describe("RLS de reviews / sync_jobs (Loop 2)", () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let orgAId: string;
  let assignedBranchId: string;
  let unassignedBranchId: string;

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

    const { data: assigned } = await admin
      .from("branches")
      .insert({ org_id: orgAId, name: `Sucursal reviews A ${suffix}`, google_place_id: `place-rev-a-${suffix}` })
      .select("id")
      .single();
    assignedBranchId = assigned!.id;

    const { data: unassigned } = await admin
      .from("branches")
      .insert({ org_id: orgAId, name: `Sucursal reviews B ${suffix}`, google_place_id: `place-rev-b-${suffix}` })
      .select("id")
      .single();
    unassignedBranchId = unassigned!.id;

    await admin
      .from("branch_managers")
      .insert({ branch_id: assignedBranchId, profile_id: managerProfile!.id });

    await admin.from("reviews").insert([
      {
        org_id: orgAId,
        branch_id: assignedBranchId,
        provider_review_id: `rev-assigned-${suffix}`,
        author_name: "Cliente A",
        rating: 5,
        text: "Bien",
        review_date: "2026-06-01",
      },
      {
        org_id: orgAId,
        branch_id: unassignedBranchId,
        provider_review_id: `rev-unassigned-${suffix}`,
        author_name: "Cliente B",
        rating: 2,
        text: "Mal",
        review_date: "2026-06-02",
      },
    ]);

    await admin.from("sync_jobs").insert({
      org_id: orgAId,
      branch_id: assignedBranchId,
      kind: "fetch",
      status: "success",
      stats: { fetched: 1, new: 1 },
    });
  });

  it("el manager solo lee reviews de sus sucursales asignadas", async () => {
    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);
    const { data, error } = await managerClient
      .from("reviews")
      .select("branch_id")
      .in("branch_id", [assignedBranchId, unassignedBranchId]);

    expect(error).toBeNull();
    const branchIds = data!.map((r) => r.branch_id);
    expect(branchIds).toContain(assignedBranchId);
    expect(branchIds).not.toContain(unassignedBranchId);
  });

  it("el admin lee reviews de todas las sucursales de su org", async () => {
    const adminClient = await signIn(`admin.${SEED_ORGS[0].slug}@contame.test`);
    // Se filtra explícitamente por las dos sucursales de este test: un
    // .select() sin acotar puede superar el límite default de PostgREST de
    // 1000 filas por respuesta si la org acumula muchas reviews de otros
    // tests corriendo en paralelo, y truncaría el resultado antes de
    // llegar a estas dos filas puntuales.
    const { data } = await adminClient
      .from("reviews")
      .select("branch_id")
      .in("branch_id", [assignedBranchId, unassignedBranchId]);

    const branchIds = data!.map((r) => r.branch_id);
    expect(branchIds).toContain(assignedBranchId);
    expect(branchIds).toContain(unassignedBranchId);
  });

  it("el admin lee sync_jobs de su org; el manager no", async () => {
    const adminClient = await signIn(`admin.${SEED_ORGS[0].slug}@contame.test`);
    const { data: adminJobs } = await adminClient.from("sync_jobs").select("id").eq("branch_id", assignedBranchId);
    expect(adminJobs!.length).toBeGreaterThan(0);

    const managerClient = await signIn(`manager.${SEED_ORGS[0].slug}@contame.test`);
    const { data: managerJobs } = await managerClient
      .from("sync_jobs")
      .select("id")
      .eq("branch_id", assignedBranchId);
    expect(managerJobs).toHaveLength(0);
  });
});
