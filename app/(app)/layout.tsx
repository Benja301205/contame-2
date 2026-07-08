import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { getCurrentProfile } from "@/lib/auth/current-profile";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <Nav profile={profile} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
