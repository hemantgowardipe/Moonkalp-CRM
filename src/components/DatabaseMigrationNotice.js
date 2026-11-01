export default function DatabaseMigrationNotice() {
  return (
    <main className="setup-screen">
      <section className="setup-card">
        <span className="eyebrow">MOONKALP CRM / DATABASE SETUP</span>
        <h1>One database update is needed</h1>
        <p>
          The client approval feature needs the deliverable reviews table. In
          your Supabase project, open <strong>SQL Editor → New query</strong>,
          run the follow-up migration, then refresh this page.
        </p>
        <p className="setup-footnote">
          File: <code>supabase/migrations/20261101192500_deliverable_reviews.sql</code>
        </p>
        <p className="setup-footnote">
          If you already ran that migration, refresh the Supabase API schema
          cache by running <code>NOTIFY pgrst, &apos;reload schema&apos;;</code> in
          the SQL Editor, then refresh this page.
        </p>
      </section>
    </main>
  );
}
