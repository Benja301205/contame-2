"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Branch = { id: string; name: string };

export function InviteManagerForm({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleBranch(id: string) {
    setBranchIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fullName, branchIds }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "No se pudo invitar.");
      return;
    }

    setSuccess(`Invitación enviada a ${email}.`);
    setEmail("");
    setFullName("");
    setBranchIds([]);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-name">Nombre</Label>
        <Input
          id="invite-name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Sucursales asignadas</Label>
        <div className="space-y-1">
          {branches.map((branch) => (
            <label key={branch.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={branchIds.includes(branch.id)}
                onChange={() => toggleBranch(branch.id)}
              />
              {branch.name}
            </label>
          ))}
          {branches.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Creá una sucursal primero para poder asignarla.
            </p>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Invitando..." : "Invitar gerente"}
      </Button>
    </form>
  );
}
