import { createClient } from "@supabase/supabase-js";
import { SEED_ORGS, SEED_PASSWORD } from "../lib/seed-data";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (ver .env.local)",
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function upsertOrg(name: string) {
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function upsertUser(
  email: string,
  fullName: string,
  role: "admin" | "manager",
  orgId: string,
) {
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers();
  const existing = users.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { org_id: orgId, role, full_name: fullName },
  });

  if (error) throw error;
  return data.user.id;
}

async function seed() {
  for (const [i, org] of SEED_ORGS.entries()) {
    const orgId = await upsertOrg(org.name);

    await upsertUser(
      `admin.${org.slug}@contame.test`,
      `Admin ${org.name}`,
      "admin",
      orgId,
    );
    await upsertUser(
      `manager.${org.slug}@contame.test`,
      `Gerente ${org.name}`,
      "manager",
      orgId,
    );

    console.log(`✔ ${org.name} (${i + 1}/${SEED_ORGS.length}) — org_id=${orgId}`);
  }

  console.log(`\nListo. Password para todos los usuarios: ${SEED_PASSWORD}`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
