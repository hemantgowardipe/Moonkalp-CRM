import { redirect } from "next/navigation";
import Link from "next/link";
import PasswordForm from "@/app/client/setup-password/PasswordForm";
import SetupNotice from "@/components/SetupNotice";
import { getCurrentProfile, hasRecentEmailLinkSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { resetPassword } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a new password · Moonkalp CRM" };

export default async function ResetPasswordPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  // The emailed link signs the user in before landing here; without that
  // session the link was missing, already used, or expired.
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?invite=expired");
  if (profile.access_disabled_at) redirect("/login?access=disabled");
  if (!(await hasRecentEmailLinkSession())) redirect("/login?invite=expired");

  return (
    <main className="setup-screen">
      <section className="setup-card">
        <Link className="brand" href="/login">
          <span className="brand-mark">m.</span>
          <span>moonkalp<span className="brand-muted"> / studio</span></span>
        </Link>
        <div className="password-setup-copy">
          <span className="eyebrow">ACCOUNT / NEW PASSWORD</span>
          <h1>Choose a new password</h1>
          <p>Signed in as {profile.email}. Your new password replaces the old one, and other devices are signed out.</p>
        </div>
        <PasswordForm formAction={resetPassword} submitLabel="Save new password" />
      </section>
    </main>
  );
}
