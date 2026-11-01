# Moonkalp CRM

A Next.js App Router CRM starter for agency teams and their clients. It uses Supabase Auth and Postgres Row-Level Security for access control.

## Local setup

1. Copy `.env.example` to `.env.local`. Set the Supabase project URL, publishable (or legacy anon) key, and site URL. For admin portal invitations, also set `SUPABASE_SERVICE_ROLE_KEY`; it must remain server-only and must never use a `NEXT_PUBLIC_` prefix or be committed.
2. The initial schema is in `supabase/migrations/20261101182500_initial_schema.sql`. If it has already been run in the Supabase SQL Editor, do not run it again.
3. Run the deliverable-review migration in `supabase/migrations/20261101192500_deliverable_reviews.sql` in the SQL Editor. It adds client approval/revision requests with their own RLS policies. If you ran it already but the client portal says the relationship is missing, run `NOTIFY pgrst, 'reload schema';` in the SQL Editor and refresh the browser.
4. Create the initial admin Auth user in Supabase → Authentication → Users. Then create the matching application profile in the SQL Editor:

   ```sql
   insert into public.users (auth_id, email, full_name, role)
   values ('AUTH_USER_UUID', 'admin@example.com', 'Agency Admin', 'admin');
   ```

   Replace the UUID and values with the Auth user you created. Admins and team members are provisioned administratively; client portal access is invitation-only.
5. Run `supabase/migrations/20261101203000_client_portal_invites.sql` in the SQL Editor. Admins can then open a client record and send a portal invitation that links the account to that existing record. Set the Supabase Auth Site URL and allow-list `/auth/callback` as a redirect URL. Invitation emails remain subject to Supabase Auth rate limits and SMTP configuration.
6. Add the values from `.env.example` to `.env.local`, including the server-only service role key. Restart the dev server after changing environment variables.
7. Install dependencies and start the app:

   ```powershell
   npm install
   npm run dev
   ```

   Open `http://localhost:3000`. Agency users sign in at `/login` and land on `/admin/dashboard`; client users land on `/client/portal`.

## Current functionality

- Email/password Supabase sign-in, session refresh, and role-based route checks.
- Admin portal invitations link the invited account to its existing client record; clients set a password after accepting the invite.
- RLS-scoped agency dashboard, client directory, client detail drawer, MRR and dues summaries.
- Client portal for active services, deliverables, and payment history.
- Client approval and revision submissions are stored in `deliverable_reviews`; review decisions do not change the agency-owned deliverable pipeline status.

Client and service records are read according to the policies in the migrations. Add services, deliverables, and payments through an authorized admin workflow or the Supabase SQL Editor until those management forms are added.

## Validation

Run `npm test`, `npm run lint`, and `npm run build` to check the CRM metrics, lint rules, and production compilation.
