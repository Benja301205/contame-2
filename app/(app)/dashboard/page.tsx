import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Dashboard consolidado</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          KPIs y ranking de sucursales — se implementan en loops siguientes.
        </CardContent>
      </Card>
      <Card className="max-w-md">
        <CardContent className="py-4">
          <Link href="/dashboard/compliance" className="text-sm underline underline-offset-2">
            Cumplimiento de check-ins
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
