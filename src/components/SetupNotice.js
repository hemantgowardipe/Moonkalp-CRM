export default function SetupNotice() {
  return (
    <main className="setup-screen">
      <section className="setup-card">
        <span className="eyebrow">MOONKALP CRM / SETUP</span>
        <h1>Connect your Supabase project</h1>
        <p>
          Add your project URL and publishable anon key to{" "}
          <code>.env.local</code>, then restart the development server.
        </p>
        <pre>{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key`}</pre>
        <p className="setup-footnote">
          Find these in Supabase under Project Settings → API. Never use a
          service-role key in the browser or commit credentials.
        </p>
      </section>
    </main>
  );
}
