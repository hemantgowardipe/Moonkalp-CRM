import { redirect } from "next/navigation";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import PasswordForm from "./PasswordForm";
import { setClientPassword } from "./actions";
import SetupNotice from "@/components/SetupNotice";
import { getCurrentProfile, hasRecentEmailLinkSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function SetupPasswordPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.access_disabled_at) redirect("/login?access=disabled");
  if (profile.role !== "client") redirect("/admin/dashboard");
  if (!(await hasRecentEmailLinkSession())) redirect("/login?invite=expired");

  return (
    <main className="setup-screen">
      <section className="setup-card">
        <Link className="brand" href="/client/portal">
          <BrandLogo height={40} priority />
        </Link>
        <div className="password-setup-copy">
          <span className="eyebrow">CLIENT PORTAL / FIRST VISIT</span>
          <h1>Set your password</h1>
          <p>Choose a password for future sign-ins, then continue to your client portal.</p>
        </div>
        <PasswordForm formAction={setClientPassword} />
      </section>
    </main>
  );
}
