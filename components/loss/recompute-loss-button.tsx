"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recomputeLossAction } from "@/lib/actions/loss";
import { Button } from "@/components/ui/button";

export function RecomputeLossButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    const result = await recomputeLossAction();
    setLoading(false);

    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(`Recalculado: ${result.recomputed} snapshots.`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="outline" onClick={handleClick} disabled={loading}>
        {loading ? "Recalculando..." : "Recalcular pérdidas"}
      </Button>
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}
