# Moonkalp CRM — Project Handover

> Handover for continuing this project in a new chat. This document describes the intended product, current implementation, setup, prior decisions, known issues, and the next work to do. It deliberately contains no credentials or secret environment values.

## 1. Project at a glance

- **Project:** Moonkalp CRM
- **Repository/workspace:** `C:\Users\Hemant Gowaedipe\Downloads\Moonkalp_CRM`
- **Product goal:** A lightweight agency CRM where an agency team manages multiple client accounts, recurring services, creative/website deliverables, approvals, and billing, while each client sees only their own portal.
- **Stack:** Next.js App Router, JavaScript, React, Tailwind CSS v4, Supabase Auth, PostgreSQL, and Row-Level Security (RLS).
- **User roles:** `admin`, `team_member`, and `client`.
- **Current access model:** Agency staff create client records. A staff member then invites the client from that record; the invite is intended to attach the new Auth identity to that existing client record. Public client self-registration has been removed from the app.
- **Current state:** Main app routes and flows have been implemented, but invite delivery is currently being rate-limited by Supabase. The latest reported browser output also appears to show a raw Next.js server-action response; this needs investigation before calling the invite UI production-ready.

## 2. Product aim and intended workflow

### Agency staff

1. Staff sign in at `/login`.
2. Staff land on `/admin/dashboard`.
3. Admin/team members review agency metrics and the client directory.
4. Staff create a client record with contact name, company, email, and optional phone.
5. Staff open that client’s detail drawer, review services/deliverables/billing, and send a portal invitation.
6. Once the client accepts the invitation and sets a password, the client Auth user is associated with that existing client record.

### Client

1. Client receives the Supabase invitation email.
2. The invitation returns to `/auth/callback`.
3. The callback establishes the Supabase session and sends the client to `/client/setup-password`.
4. Client sets a password and continues to `/client/portal`.
5. Client can see their own services, deliverables/review queue, and payment history, and submit approval/revision requests for eligible deliverables.

### Business focus

- Website creation and management.
- Social media management (posts, reels, profile handling).
- Client service retainers and renewal dates.
- Content pipeline: Drafting → Pending Approval → Scheduled → Published.
- Payment ledger: Paid, Pending, Overdue.

## 3. What has been built

### Authentication and authorization

- Supabase SSR browser and server clients are configured in `src/lib/supabase/`.
- `/login` supports email/password sign-in.
- `src/lib/auth.js` loads the logged-in user’s app profile from `public.users` and exposes role enforcement.
- Root `proxy.js` refreshes auth cookies and blocks unauthenticated access to admin and client routes.
- Authenticated user profiles determine redirects: client users go to their portal; agency users go to the admin workspace.
- Admin/team roles are intended to be provisioned administratively, not through an open public registration form.

### Admin workspace

- `/admin/dashboard` loads client, service, deliverable, payment, and linked-user information.
- Metric cards show MRR, pending dues, active projects/services, and client counts.
- Client directory is searchable/filterable and opens a client detail drawer.
- Drawer includes Overview, Deliverables, and Billing tabs and shows portal-link status/invitation controls.
- “New Client” creates a row in `public.clients`; it **does not** create an Auth account or send an invitation by itself.
- Admin and team member actions are in `src/app/admin/dashboard/actions.js`.

### Client portal

- `/client/portal` is scoped to the logged-in client using the `client_id` in their app profile and RLS.
- Portal shows active services, deliverables/content requiring attention, and payment history.
- Clients can approve or request revisions for deliverables in the approval state.
- Review actions are recorded in `public.deliverable_reviews`; those actions do not directly update the agency-owned deliverable pipeline status.

### Invite and password setup

- `src/components/ClientPortalInvite.js` provides the invitation control in the client drawer.
- `inviteClientToPortal` checks the existing client/profile, records a pending server-created invitation, and calls Supabase Admin Auth invite.
- `src/lib/supabase/admin.js` creates a service-role Supabase client. It must remain server-only.
- `src/app/auth/callback/route.js` exchanges/validates the invite callback and redirects to password setup.
- `/client/setup-password` validates the client role and updates the Auth user password.
- Callback redirect URL is generated from `NEXT_PUBLIC_SITE_URL`.
- Invite emails are still subject to Supabase Auth rate limits and email provider configuration.

### UI and project setup

- Custom styling and responsive UI are in `src/app/globals.css`.
- Reusable UI is in `src/components/`.
- `README.md` documents the current setup and functionality.
- `.env.example` provides placeholders; `.gitignore` excludes real `.env*` files while allowing `.env.example`.
- A database/RLS diagnostic query exists at `supabase/diagnostics/client_save_check.sql`.

## 4. Database and migrations

SQL migrations live in `supabase/migrations/` and are currently applied manually through Supabase SQL Editor (unless the project has since adopted the Supabase CLI).

### `20261101182500_initial_schema.sql`

Creates enums and core tables:

- `clients`: name, company, email, phone, account status, timestamps.
- `users`: maps `auth.users.id` to app role and optional client; role/client constraints are enforced.
- `client_services`: service type, monthly retainer, start/renewal dates, status.
- `deliverables`: service, title, category, pipeline status, due date.
- `payments`: client, amount, payment status, due/paid dates, transaction reference.

Also creates `current_app_role()` and `current_client_id()` helper functions, grants, indexes, enables RLS, and adds admin/team management policies plus client-scoped read policies.

### `20261101192500_deliverable_reviews.sql`

Creates `deliverable_reviews` with approval/revision action, note, deliverable/client/user references, indexes, and RLS policies. Client inserts are limited to their own deliverables that are in `Pending Approval`.

### `20261101200000_client_self_signup.sql` (historical)

This migration originally supported public client registration, including creating a new client row/profile from signup metadata. That product direction was superseded by invite-only onboarding. Do not restore or use the public signup UI/behavior unless the user explicitly changes the product decision.

### `20261101203000_client_portal_invites.sql` (current invite flow)

Creates `client_portal_invitations`, locked down to service-role access, and replaces the Auth trigger with one that links a newly invited Auth user to an existing client only when there is a matching pending invitation and email. The migration is intended to supersede the historical self-signup trigger behavior.

**Important:** Do not assume this latest migration has been run in the user's Supabase project. The prior conversation did not confirm it was applied. Ask/check with the user before troubleshooting database state or sending another invitation. If not applied, it is required for invite linking.

### Database state known from user-provided diagnostics

The user ran diagnostics and reported:

- Their app profile matches an Auth user with role `admin`, and no `client_id`.
- RLS is enabled on `clients`.
- Authenticated users have the expected grants.
- The “Admins and team can manage clients” policy is present.
- The client-record insert was subsequently confirmed to work.

Therefore, the earlier “New Client not saving” issue was not ultimately an RLS/grant failure. Do not conflate client-row creation with Auth invitation email delivery.

## 5. Environment and local run instructions

Expected variables are listed in `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-or-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=server-only-service-role-key
```

- For local development, `NEXT_PUBLIC_SITE_URL=http://localhost:3000` is appropriate.
- In Supabase Auth URL Configuration, allow `http://localhost:3000/auth/callback` as a redirect URL for local testing.
- For clients outside the developer’s machine, localhost is not reachable; deploy the app and use its public HTTPS origin for `NEXT_PUBLIC_SITE_URL` and the Supabase allow-list.
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser or renamed with a `NEXT_PUBLIC_` prefix.
- `.env.local` exists locally. Never print, copy into docs, or disclose its contents.

Run from the workspace:

```powershell
npm install
npm run dev
```

The app is locally served at `http://localhost:3000` by default.

Useful checks:

```powershell
npm test
npm run lint
npm run build
```

## 6. Validation completed so far

The last recorded validation, after implementing invite/password setup, passed:

- `npm test`: 5 passing Node tests, including dashboard metrics/currency and invitation redirect URL helper.
- `npm run lint`: passed.
- `npm run build`: passed using Next.js 16.4.3.
- Local production-route smoke test: `/login` returned 200; `/client/setup-password` redirected unauthenticated visitors to `/login`; `/register` returned 404; malformed `/auth/callback` redirected to login with an invalid-invite message.

These are local code checks only. They do **not** prove that the user’s Supabase project has the latest migration applied, that SMTP delivers mail, or that a real invitation can complete successfully.

## 7. Current reported issue — invitation attempt

Most recent user report:

1. Clicking **Send invite** produced a Supabase rate-limit message: “Supabase is temporarily limiting invitation emails. Wait before retrying.”
2. The user then reported seeing this text after clicking:

   ```text
   0:{"a":"$@1","q":"","i":true,"b":"development"}
   1:D"$2"
   1:{"error":"Supabase is temporarily limiting invitation emails. Wait before retrying."}
   ```

Interpretation:

- The application action received/reported an invite-rate-limit error; this is separate from the admin client-row insert and does not prove a schema or RLS failure.
- The displayed `0:` / `1:` payload resembles a React/Next.js server-action response stream. It should normally be handled by the framework rather than shown as visible page content. If the user sees it in the browser page itself, investigate the client form hydration/action handling and browser console/network response rather than treating it as only a Supabase email configuration issue.
- The currently shared browser page is not available in the new chat; user will need to share it again if visual inspection is needed.
- Do not repeatedly retry invitations while the provider reports rate limiting. Do not remove/disable rate limits.

Recommended troubleshooting order:

1. Ask whether the payload is visible in the actual page, or only in DevTools Network/console. If visible in the page, reproduce and inspect `ClientPortalInvite.js`, the imported server action, hydration/build errors, and browser console/network.
2. Check Supabase Auth logs for the invitation failure and verify whether an Auth user or invitation was created before retrying.
3. Confirm whether `20261101203000_client_portal_invites.sql` has been run; if not, run it once, then verify tables/trigger.
4. Verify Supabase Auth SMTP configuration and rate-limit settings; use a configured SMTP provider for reliable invitation delivery. Do not claim SMTP removes every provider/Supabase limit.
5. Test using one controlled client email only after the cooldown/provider issue is resolved.

## 8. Important implementation notes and pitfalls

- Creating a client in the admin UI inserts `public.clients` only. It does not call Supabase Auth.
- Sending an invite calls Supabase Auth Admin API and therefore can trigger email sending limits.
- No live client Auth account or invitation success has been verified as part of local tests.
- Public `/register` route and self-signup JavaScript were removed; a route smoke check confirmed `/register` is 404.
- The old self-signup migration remains in the migration history. The new invite migration replaces its trigger, but the live database must have the invite migration applied for this intended behavior.
- Do not ask the user to paste service-role keys, passwords, or other credentials into chat.
- The user previously shared an admin password in an earlier conversation. It is not reproduced here and must not be used; recommend rotating it if it is still active.
- There is no confirmed deployment. Local `localhost` callbacks only work for testing on a machine that can reach the developer’s local app.
- Services, deliverables, and payments do not yet have complete admin CRUD forms; README directs users to authorized DB workflows/SQL until those screens are built.
- Read and preserve existing user data. Do not rerun initial schema migrations against a populated project.

## 9. Project structure

```text
src/
  app/
    (auth)/login/       Sign-in page, form, and action
    admin/dashboard/    Agency workspace, data loading, client actions
    auth/callback/      Supabase invitation callback
    client/portal/      Client workspace and review actions
    client/setup-password/ Invitee password setup
    globals.css         App styles
  components/           Directory, drawer, invite, forms, shell, review controls
  lib/
    auth.js             Current app profile and role enforcement
    agencyDashboard.mjs Dashboard metric calculation
    clientInvite.mjs    Invite callback URL validation
    formatCurrency.mjs  Currency formatting
    supabase/           Browser, server, config, and admin clients
supabase/
  diagnostics/          Client-save/RLS diagnostic SQL
  migrations/           Initial schema, reviews, historical signup, portal invites
tests/
  formatCurrency.test.mjs Dashboard metric and invite helper tests
proxy.js                Auth cookie refresh and route access guard
README.md               Setup and current feature guide
HANDOVER.md             This document
```

## 10. Suggested next milestones

### First: resolve the currently blocked invite workflow

- Confirm migration status.
- Investigate why the Next.js server-action stream may be displayed as page text.
- Establish whether Supabase created a pending Auth user before the 429.
- Configure and verify SMTP, then test a single invite and complete callback → password setup → portal.

### Then: complete core CRM operations

- Add admin forms for services, deliverables, and payments.
- Add edit/pause/churn client and service workflows, with confirmation and validation.
- Add deliverable pipeline transitions and ensure approval/revision review history is visible.
- Add billing filters and useful overdue/pending views.

### Production hardening

- Deploy to a public HTTPS host and configure production redirect URLs.
- Configure SMTP sender/domain and test invite/confirmation delivery.
- Review authorization/RLS policies against all user roles using tests and SQL checks.
- Add automated integration/E2E coverage for auth, client scoping, invite callback, and client review actions.
- Ensure database migrations are applied/reviewed via a repeatable migration process rather than ad-hoc manual SQL.

## 11. Prompt to continue in a new chat

Copy and paste this with the project opened:

> Continue work on the Moonkalp CRM in `C:\Users\Hemant Gowaedipe\Downloads\Moonkalp_CRM`. Read `HANDOVER.md` and `README.md` first. The goal is an agency CRM using Next.js App Router, JavaScript, Tailwind, and Supabase, with admin/team management and an RLS-scoped client portal. Client onboarding is invite-only: staff create the client record, then invite that existing client to activate a login. The current blocker is that Supabase is rate-limiting invitation emails, and clicking Send invite reportedly shows a raw Next.js server-action response (`0:...1:{"error":"Supabase is temporarily limiting invitation emails..."}`); investigate whether that payload is on-screen or just in the Network response, check the invite action/hydration, and do not bypass rate limits or repeatedly send invites. Confirm whether the latest portal-invite migration was applied before assuming database state. Do not read or expose `.env.local` secrets. Preserve user data and run `npm test`, `npm run lint`, and `npm run build` after code changes.
