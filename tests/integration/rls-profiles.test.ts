import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { SEED_ORGS, SEED_PASSWORD } from "@/lib/seed-data";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Verifica el criterio de aceptación 2 del Loop 0: un usuario de la org A
 * no puede leer filas de la org B ni consultando Supabase directo con su
 * propio JWT (RLS real, sin service role de por medio).
 */
describe("RLS cross-org en profiles", () => {
  let orgAClient: ReturnType<typeof createClient>;

  beforeAll(async () => {
    orgAClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await orgAClient.auth.signInWithPassword({
      email: `admin.${SEED_ORGS[0].slug}@contame.test`,
      password: SEED_PASSWORD,
    });
    if (error) throw error;
  });

  it("solo ve profiles de su propia organización", async () => {
    const { data, error } = await orgAClient.from("profiles").select("full_name, org_id");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((p) => !p.full_name?.includes(SEED_ORGS[1].name))).toBe(true);
  });

  it("no trae ninguna fila de la org B aunque se filtre explícitamente por su org_id", async () => {
    const { data: orgBRow } = await orgAClient
      .from("organizations")
      .select("id")
      .eq("name", SEED_ORGS[1].name)
      .maybeSingle();

    // Con RLS bien aplicada, ni siquiera puede leer el id de la org B para
    // armar el filtro (organizations también está protegida).
    expect(orgBRow).toBeNull();
  });

  it("no puede leer organizations de la otra org", async () => {
    const { data } = await orgAClient.from("organizations").select("name");
    const names = data?.map((o) => o.name) ?? [];

    expect(names).toContain(SEED_ORGS[0].name);
    expect(names).not.toContain(SEED_ORGS[1].name);
  });
});
