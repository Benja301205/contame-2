import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { SEED_ORGS } from "@/lib/seed-data";
import { MockProvider } from "@/lib/providers/mock";
import { runSyncForBranches } from "@/lib/sync/run-sync";
import fixtures from "@/lib/providers/fixtures/reviews.json";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe("runSyncForBranches con MockProvider", () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let orgId: string;
  let branchId: string;

  beforeAll(async () => {
    const { data: org } = await admin
      .from("organizations")
      .select("id")
      .eq("name", SEED_ORGS[0].name)
      .single();
    orgId = org!.id;

    const suffix = Math.random().toString(36).slice(2, 8);
    const { data: branch } = await admin
      .from("branches")
      .insert({
        org_id: orgId,
        name: `Sucursal sync ${suffix}`,
        google_place_id: `place-sync-${suffix}`,
      })
      .select("id")
      .single();
    branchId = branch!.id;
  });

  it("inserta las reviews de fixture", async () => {
    const { status, body } = await runSyncForBranches(admin, new MockProvider(), { branchId });

    expect(status).toBe(200);
    expect(body.results).toHaveLength(1);
    const [result] = body.results!;
    expect(result).toMatchObject({ branchId, fetched: fixtures.length, new: fixtures.length });

    const { data: reviews } = await admin.from("reviews").select("id").eq("branch_id", branchId);
    expect(reviews).toHaveLength(fixtures.length);
  });

  it("una segunda corrida no inserta duplicados", async () => {
    const { body } = await runSyncForBranches(admin, new MockProvider(), { branchId });
    const [result] = body.results!;

    expect(result).toMatchObject({ branchId, fetched: fixtures.length, new: 0 });

    const { data: reviews } = await admin.from("reviews").select("id").eq("branch_id", branchId);
    expect(reviews).toHaveLength(fixtures.length);
  });

  it("registra la corrida en sync_jobs con stats correctas", async () => {
    const { data: jobs } = await admin
      .from("sync_jobs")
      .select("status, stats")
      .eq("branch_id", branchId)
      .order("started_at", { ascending: false })
      .limit(1);

    expect(jobs![0].status).toBe("success");
    expect(jobs![0].stats).toMatchObject({ fetched: fixtures.length, new: 0 });
  });

  it("un error en una sucursal no rompe la corrida de las demás", async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const { data: brokenBranch } = await admin
      .from("branches")
      .insert({
        org_id: orgId,
        name: `Sucursal rota ${suffix}`,
        google_place_id: `place-rota-${suffix}`,
      })
      .select("id, google_place_id")
      .single();

    const failingProvider = {
      async fetchReviews(placeId: string) {
        if (placeId === brokenBranch!.google_place_id) {
          throw new Error("Provider caído");
        }
        return new MockProvider().fetchReviews(placeId);
      },
    };

    const { body } = await runSyncForBranches(admin, failingProvider, { orgId });
    const results = body.results!;

    const brokenResult = results.find((r) => r.branchId === brokenBranch!.id);
    const okResult = results.find((r) => r.branchId === branchId);

    expect(brokenResult).toMatchObject({ error: "Provider caído" });
    expect(okResult).toMatchObject({ fetched: fixtures.length, new: 0 });
  });
});
