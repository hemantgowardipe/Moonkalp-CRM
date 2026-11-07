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
5. Run the remaining migrations in the SQL Editor, in filename order, each once:
   - `20261101203000_client_portal_invites.sql`: invite-only client onboarding.
   - `20261107120000_fix_invite_profile_link.sql`: links invited users to their client record.
   - `20261107140000_portal_access_controls.sql`: portal status, disable/enable access, and the portal activity log.

   `20261101200000_client_self_signup.sql` is historical (public sign-up was removed); the invite migrations replace its trigger. When deploying, **run new migrations before deploying the code that uses them**.

   In Supabase → Authentication → URL Configuration, set the Site URL and allow-list `<site>/auth/callback` as a redirect URL.
6. Add the values from `.env.example` to `.env.local`, including the server-only service role key. Restart the dev server after changing environment variables.
7. Install dependencies and start the app:

   ```powershell
   npm install
   npm run dev
   ```

   Open `http://localhost:3000`. Agency users sign in at `/login` and land on `/admin/dashboard`; client users land on `/client/portal`.

## Auth emails (invitations and password resets)

Supabase's built-in email sender is for testing only: it sends just a few emails per hour, its sender name is "Supabase Auth", and it does not allow editing templates. For real use:

1. **Connect your own SMTP provider** (e.g. Resend, Postmark, Amazon SES, Brevo) in Supabase → Authentication → Emails → SMTP Settings. Set the sender name to `Moonkalp CRM` and use an address on a domain you have verified with the provider (SPF/DKIM), so emails are not marked as spam.
2. **Install the branded templates** in Supabase → Authentication → Emails → Templates:

   | Template | Subject | Body |
   |---|---|---|
   | Invite user | `You're invited to your Moonkalp client portal` | `supabase/templates/invite.html` |
   | Reset password | `Reset your Moonkalp CRM password` | `supabase/templates/reset_password.html` |

   These templates link to `/auth/callback?token_hash=…`, which works even when the email is opened on a different device. The default templates also work (via `/auth/confirm`).
3. Review Authentication → Rate Limits; raise the email limit once SMTP is connected.

## Client portal access

Each client's drawer has a **Portal access** panel:

- **Not invited → Send invite.** Emails a one-time link; the client chooses their own password. The agency never sees or sets it.
- **Invited → Resend invite.** For clients who have not set a password yet (e.g. the link expired).
- **Active → Disable access.** Blocks the login in three layers: an RLS flag that hides all data immediately, a Supabase Auth ban that blocks sign-in, and revocation of every existing session. Data is kept.
- **Disabled → Re-enable access.**
- Setting a client to **Churned** disables portal access automatically. Re-enabling is always a manual step.
- Every invite, resend, disable, and enable is recorded in `client_portal_events` and shown in the panel.

**Forgot password** (`/forgot-password`) works for clients and staff. It never reveals whether an email has an account. The password screens only accept sessions that came from an emailed link in the last hour, so a signed-in but unattended browser cannot be used to change the password. After a reset, the user's other sessions are signed out.

## Current functionality

- Email/password Supabase sign-in, session refresh, and role-based route checks.
- Invite-only client onboarding, portal access controls, and password reset (see above).
- RLS-scoped agency dashboard, client directory, client detail drawer, MRR and dues summaries.
- Client drawer forms to add, edit, and delete services, deliverables, and payments; edit client details and status; and change pipeline stage and payment status inline.
- Client portal for active services, deliverables, and payment history.
- Client approval and revision submissions are stored in `deliverable_reviews`; review decisions do not change the agency-owned deliverable pipeline status.

## Validation

Run `npm test`, `npm run lint`, and `npm run build` to check the CRM metrics, lint rules, and production compilation.
