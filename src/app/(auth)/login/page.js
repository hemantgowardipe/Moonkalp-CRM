import { redirect } from "next/navigation";
import Link from "next/link";
import LoginForm from "./LoginForm";
import SetupNotice from "@/components/SetupNotice";
import { getCurrentProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const { invite } = await searchParams;
  const profile = await getCurrentProfile();
  if (profile) {
    redirect(profile.role === "client" ? "/client/portal" : "/admin/dashboard");
  }

  return (
    <main className="login-screen">
      <section className="login-aside">
        <Link className="brand brand-light" href="/">
          <span className="brand-mark">m.</span>
          <span>moonkalp<span className="brand-muted"> / studio</span></span>
        </Link>
        <div className="login-message">
          <span className="eyebrow eyebrow-light">THE CLIENT OPERATING SYSTEM</span>
          <h1>Good work.<br />Well managed.</h1>
          <p>One calm place for client relationships, creative work, and the business behind it.</p>
        </div>
        <span className="aside-index">01 — 04&nbsp;&nbsp; CLIENTS · WORK · BILLING</span>
      </section>
      <section className="login-panel">
        <div className="login-panel-inner">
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Sign in to your workspace</h2>
          <p className="login-subtitle">Use the email and password associated with your account.</p>
          <LoginForm inviteStatus={invite} />
          <p className="login-help">Client? Ask your agency contact to send you a portal invitation.</p>
        </div>
        <span className="login-footer">MOONKALP CRM <span>·</span> PRIVATE WORKSPACE</span>
      </section>
    </main>
  );
}
