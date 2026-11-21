import { Suspense } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { AuditTimelineSkeleton, SettingsSectionSkeleton } from "@/components/LoadingSkeletons";
import { LinkPendingIndicator, PendingRegion } from "@/components/NavigationFeedback";
import SettingsSectionHeader from "@/components/SettingsSectionHeader";
import SetupNotice from "@/components/SetupNotice";
import SignOutButton from "@/components/SignOutButton";
import WorkspaceShell, { preloadWorkspaceShell } from "@/components/WorkspaceShell";
import { getAuthUser, requireRole } from "@/lib/auth";
import { getCurrentOrganizationSettings, getUserPreferences } from "@/lib/settings";
import { describeAuditEntity, summarizeAuditChanges } from "@/lib/settingsRules.mjs";
import { AUDIT_FILTER_ENTITIES, settingsSectionHref, settingsSectionsFor, settingsSubtitle } from "@/lib/settingsSections.mjs";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import {
  AppearanceForm,
  OrganizationForm,
  PasswordChangeForm,
  ProfileForm,
  SignOutOthersForm,
} from "./SettingsForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Moonkalp CRM" };

const AUDIT_PAGE_SIZE = 50;
const ROLE_LABELS = { admin: "Admin", team_member: "Team member", client: "Client" };

function formatDateTime(value) {
  return value
    ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : "Never";
}

function auditHref(entity, before = null) {
  return `/settings?section=audit${entity ? `&entity=${entity}` : ""}${before ? `&before=${before}` : ""}`;
}

// Identifies one view of the audit log (filter plus page) for loading feedback.
function auditView(entity, before = null) {
  return `${entity ?? "all"}:${before ?? "latest"}`;
}

async function AppearanceSettings({ supabase, authId }) {
  const preferences = await getUserPreferences(supabase, authId);
  return <div className="settings-card"><AppearanceForm preferences={preferences} /></div>;
}

async function SecuritySettings({ profile }) {
  // Already fetched (and cached for this request) by requireRole.
  const { data: { user } } = await getAuthUser();
  return (
    <>
      <div className="settings-card">
        <h3 className="settings-subheading">Change password</h3>
        <PasswordChangeForm />
      </div>
      <div className="settings-card">
        <h3 className="settings-subheading">Sessions</h3>
        <p className="settings-text">
          Signed in as <strong>{profile.email}</strong>. Last sign-in {formatDateTime(user?.last_sign_in_at)}.
          If you used a shared or lost device, sign out everywhere else.
        </p>
        <SignOutOthersForm />
      </div>
      <div className="settings-card settings-card-mobile-only">
        <h3 className="settings-subheading">Sign out</h3>
        <SignOutButton className="button button-secondary" />
      </div>
    </>
  );
}

async function OrganizationSettings({ canEdit }) {
  // Shared with the workspace shell, which started loading it with the page.
  const organization = await getCurrentOrganizationSettings();
  return (
    <>
      {organization.loadError ? (
        <div className="callout callout-danger"><Icon name="alert" /> Settings could not be loaded ({organization.loadError}). Run the settings migration.</div>
      ) : null}
      <div className="settings-card">
        <OrganizationForm canEdit={canEdit} organization={organization} />
      </div>
      {organization.updated_at ? (
        <p className="settings-footnote">Last changed {formatDateTime(organization.updated_at)}. Every change is recorded in the audit log.</p>
      ) : null}
    </>
  );
}

async function TeamSettings({ supabase }) {
  const { data: staff, error } = await supabase
    .from("users")
    .select("id, full_name, email, role, access_disabled_at, created_at")
    .in("role", ["admin", "team_member"])
    .order("created_at");

  if (error) {
    return <div className="callout callout-danger"><Icon name="alert" /> Could not load the team: {error.message}</div>;
  }

  return (
    <>
      <ul className="list-box">
        {staff.map((member) => (
          <li className="member-row" key={member.id}>
            <span className="avatar">{member.full_name.slice(0, 1).toUpperCase()}</span>
            <div className="member-main">
              <strong>{member.full_name}</strong>
              <span>{member.email}</span>
            </div>
            <span className={member.access_disabled_at ? "status-pill status-overdue" : "status-pill status-neutral"}>
              {member.access_disabled_at ? "Disabled" : ROLE_LABELS[member.role]}
            </span>
          </li>
        ))}
      </ul>
      <div className="callout">
        <Icon name="shield" />
        <p>Staff accounts are provisioned by an administrator (see the README). Client logins are managed from each client&apos;s Portal access panel.</p>
      </div>
    </>
  );
}

async function AuditTimeline({ supabase, entity, before }) {
  let query = supabase
    .from("audit_log")
    .select("id, occurred_at, actor_auth_id, actor_role, entity, entity_id, action, changes")
    .order("id", { ascending: false })
    .limit(AUDIT_PAGE_SIZE + 1);
  if (entity) query = query.eq("entity", entity);
  if (before) query = query.lt("id", before);

  const [{ data: entries, error }, { data: people }] = await Promise.all([
    query,
    supabase.from("users").select("auth_id, full_name"),
  ]);

  if (error) {
    return <div className="callout callout-danger"><Icon name="alert" /> Could not load the audit log: {error.message}</div>;
  }

  const names = new Map((people ?? []).map((person) => [person.auth_id, person.full_name]));
  const page = (entries ?? []).slice(0, AUDIT_PAGE_SIZE);
  const olderCursor = entries?.length > AUDIT_PAGE_SIZE ? page.at(-1).id : null;

  return (
    <>
      {page.length ? (
        <ol className="timeline">
          {page.map((entry) => {
            const lines = summarizeAuditChanges(entry, { names });
            const actor = entry.actor_auth_id ? names.get(entry.actor_auth_id) ?? "Former user" : "System";
            return (
              <li className="timeline-item" key={entry.id}>
                <span className={`timeline-dot timeline-${entry.action}`} aria-hidden="true" />
                <div className="timeline-body">
                  <p>
                    <strong>{actor}</strong>{" "}
                    <span className="timeline-verb">{entry.action === "insert" ? "created" : entry.action === "update" ? "updated" : "deleted"}</span>{" "}
                    {describeAuditEntity(entry.entity).toLowerCase()}
                    {entry.actor_role && entry.actor_role !== "system" ? <span className="timeline-role"> · {ROLE_LABELS[entry.actor_role] ?? entry.actor_role}</span> : null}
                  </p>
                  {lines.length ? (
                    <ul className="timeline-changes">
                      {lines.map((line) => <li key={line}>{line}</li>)}
                    </ul>
                  ) : null}
                  <time dateTime={entry.occurred_at}>{formatDateTime(entry.occurred_at)}</time>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="empty-card"><p>No changes recorded{entity ? " for this type yet" : " yet"}.</p></div>
      )}
      {olderCursor ? (
        <div className="form-actions form-actions-start">
          <Link className="button button-secondary" href={auditHref(entity, olderCursor)}>
            Older entries
            <LinkPendingIndicator scope="audit" target={auditView(entity, olderCursor)} />
          </Link>
        </div>
      ) : null}
    </>
  );
}

function AuditLog({ supabase, entity, before }) {
  const view = auditView(entity, before);
  return (
    <>
      <nav aria-label="Filter audit log" className="filter-chips">
        {[null, ...AUDIT_FILTER_ENTITIES].map((value) => (
          <Link aria-current={entity === value ? "true" : undefined} className="filter-chip" href={auditHref(value)} key={value ?? "all"}>
            {value ? describeAuditEntity(value) : "All"}
            <LinkPendingIndicator scope="audit" target={auditView(value)} />
          </Link>
        ))}
      </nav>
      <PendingRegion current={view} fallback={<AuditTimelineSkeleton />} scope="audit">
        <Suspense fallback={<AuditTimelineSkeleton />} key={view}>
          <AuditTimeline before={before} entity={entity} supabase={supabase} />
        </Suspense>
      </PendingRegion>
    </>
  );
}

function SectionContent({ section, profile, supabase, audit }) {
  switch (section) {
    case "appearance":
      return <AppearanceSettings authId={profile.auth_id} supabase={supabase} />;
    case "security":
      return <SecuritySettings profile={profile} />;
    case "organization":
      return <OrganizationSettings canEdit={profile.role === "admin"} />;
    case "team":
      return <TeamSettings supabase={supabase} />;
    case "audit":
      return <AuditLog before={audit.before} entity={audit.entity} supabase={supabase} />;
    default:
      return <div className="settings-card"><ProfileForm profile={profile} /></div>;
  }
}

export default async function SettingsPage({ searchParams }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  preloadWorkspaceShell();
  const profile = await requireRole(["admin", "team_member", "client"]);
  const params = await searchParams;
  const sections = settingsSectionsFor(profile.role);
  const active = sections.find((section) => section.key === params.section) ?? sections[0];
  const supabase = await createClient();
  const audit = {
    entity: AUDIT_FILTER_ENTITIES.includes(params.entity) ? params.entity : null,
    before: /^\d+$/.test(params.before ?? "") ? params.before : null,
  };

  // Shown the instant a section tab is clicked, until that section arrives.
  const sectionSkeletons = Object.fromEntries(
    sections.map((section) => [
      section.key,
      <>
        <SettingsSectionHeader description={section.description} title={section.label} />
        <SettingsSectionSkeleton section={section.key} />
      </>,
    ]),
  );

  return (
    <WorkspaceShell active="settings" profile={profile} title="Settings">
      <div className="page">
        <header className="page-header page-header-compact">
          <div>
            <h1>Settings</h1>
            <p className="page-subtitle">{settingsSubtitle(profile.role)}</p>
          </div>
        </header>
        <div className="settings-layout">
          <nav aria-label="Settings sections" className="settings-nav">
            {sections.map((section) => (
              <Link
                aria-current={section.key === active.key ? "page" : undefined}
                className="settings-nav-link"
                href={settingsSectionHref(section.key)}
                key={section.key}
              >
                <Icon name={section.icon} size={18} />
                <span>{section.label}</span>
                <LinkPendingIndicator scope="settings" target={section.key} />
              </Link>
            ))}
          </nav>
          <section className="settings-content">
            <PendingRegion current={active.key} fallbacks={sectionSkeletons} scope="settings">
              <SettingsSectionHeader description={active.description} title={active.label} />
              {/* Section data streams in; the header and tabs above render straight away. */}
              <Suspense fallback={<SettingsSectionSkeleton section={active.key} />} key={active.key}>
                <SectionContent audit={audit} profile={profile} section={active.key} supabase={supabase} />
              </Suspense>
            </PendingRegion>
          </section>
        </div>
      </div>
    </WorkspaceShell>
  );
}
