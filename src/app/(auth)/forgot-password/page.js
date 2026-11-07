import Link from "next/link";
import ForgotPasswordForm from "./ForgotPasswordForm";
import SetupNotice from "@/components/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Reset your password · Moonkalp CRM" };

export default function ForgotPasswordPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  return (
    <main className="setup-screen">
      <section className="setup-card">
        <Link className="brand" href="/login">
          <span className="brand-mark">m.</span>
          <span>moonkalp<span className="brand-muted"> / studio</span></span>
        </Link>
        <div className="password-setup-copy">
          <span className="eyebrow">ACCOUNT / PASSWORD RESET</span>
          <h1>Forgot your password?</h1>
          <p>Enter the email you sign in with and we&apos;ll send you a link to choose a new one.</p>
        </div>
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
