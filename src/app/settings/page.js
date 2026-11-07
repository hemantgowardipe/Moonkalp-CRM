import Link from "next/link";
import Icon from "@/components/Icon";
import SetupNotice from "@/components/SetupNotice";
import SignOutButton from "@/components/SignOutButton";
import WorkspaceShell from "@/components/WorkspaceShell";
import { requireRole } from "@/lib/auth";
import { getCurrentOrganizationSettings, getUserPreferences } from "@/lib/settings";
import { describeAuditEntity, summarizeAuditChanges } from "@/lib/settingsRules.mjs";
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

const SECTIONS = [
  { key: "profile", label: "Profile", icon: "user", roles: ["admin", "team_member", "client"] },
  { key: "appearance", label: "Appearance", icon: "palette", roles: ["admin", "team_member", "client"] },
  { key: "security", label: "Security", icon: "shield", roles: ["admin", "team_member", "client"] },
  { key: "organization", label: "Organization", icon: "building", roles: ["admin", "team_member"] },
  { key: "team", label: "Team", icon: "users", roles: ["admin", "team_member"] },
  { key: "audit", label: "Audit log", icon: "history", roles: ["admin"] },
];

const AUDIT_PAGE_SIZE = 50;
const AUDIT_ENTITIES = ["clients", "client_services", "deliverables", "payments", "users", "organization_settings"];
const ROLE_LABELS = { admin: "Admin", team_member: "Team member", client: "Client" };

function formatDateTime(value) {
  return value
    ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : "Never";
}

function SectionHeader({ title, description }) {
  return (
    <header className="settings-header">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

async function AuditLogSection({ supabase, entity, before }) {
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
  const filterHref = (value) => (value ? `/settings?section=audit&entity=${value}` : "/settings?section=audit");

  return (
    <>
      <nav aria-label="Filter audit log" className="filter-chips">
        <Link aria-current={!entity ? "true" : undefined} className="filter-chip" href={filterHref(null)}>All</Link>
        {AUDIT_ENTITIES.map((value) => (
          <Link aria-current={entity === value ? "true" : undefined} className="filter-chip" href={filterHref(value)} key={value}>
            {describeAuditEntity(value)}
          </Link>
        ))}
      </nav>
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
          <Link className="button button-secondary" href={`/settings?section=audit${entity ? `&entity=${entity}` : ""}&before=${olderCursor}`}>
            Older entries
          </Link>
        </div>
      ) : null}
    </>
  );
}

async function TeamSection({ supabase }) {
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

export default async function SettingsPage({ searchParams }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const profile = await requireRole(["admin", "team_member", "client"]);
  const params = await searchParams;
  const sections = SECTIONS.filter((section) => section.roles.includes(profile.role));
  const active = sections.find((section) => section.key === params.section) ?? sections[0];
  const supabase = await createClient();

  let content;
  if (active.key === "profile") {
    content = (
      <>
        <SectionHeader description="How you appear across the CRM." title="Profile" />
        <div className="settings-card"><ProfileForm profile={profile} /></div>
      </>
    );
  } else if (active.key === "appearance") {
    const preferences = await getUserPreferences(supabase, profile.auth_id);
    content = (
      <>
        <SectionHeader description="Choose how the CRM looks on this and your other devices." title="Appearance" />
        <div className="settings-card"><AppearanceForm preferences={preferences} /></div>
      </>
    );
  } else if (active.key === "security") {
    const { data: { user } } = await supabase.auth.getUser();
    content = (
      <>
        <SectionHeader description="Keep your account safe." title="Security" />
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
  } else if (active.key === "organization") {
    const organization = await getCurrentOrganizationSettings();
    content = (
      <>
        <SectionHeader description="Your agency's details and service-level targets." title="Organization" />
        {organization.loadError ? (
          <div className="callout callout-danger"><Icon name="alert" /> Settings could not be loaded ({organization.loadError}). Run the settings migration.</div>
        ) : null}
        <div className="settings-card">
          <OrganizationForm canEdit={profile.role === "admin"} organization={organization} />
        </div>
        {organization.updated_at ? (
          <p className="settings-footnote">Last changed {formatDateTime(organization.updated_at)}. Every change is recorded in the audit log.</p>
        ) : null}
      </>
    );
  } else if (active.key === "team") {
    content = (
      <>
        <SectionHeader description="People with access to the agency workspace." title="Team" />
        <TeamSection supabase={supabase} />
      </>
    );
  } else {
    content = (
      <>
        <SectionHeader
          description="An append-only record of changes to clients, services, deliverables, payments, profiles, and settings."
          title="Audit log"
        />
        <AuditLogSection before={/^\d+$/.test(params.before ?? "") ? params.before : null} entity={AUDIT_ENTITIES.includes(params.entity) ? params.entity : null} supabase={supabase} />
      </>
    );
  }

  return (
    <WorkspaceShell active="settings" profile={profile} title="Settings">
      <div className="page">
        <header className="page-header page-header-compact">
          <div>
            <h1>Settings</h1>
            <p className="page-subtitle">Manage your account{profile.role === "client" ? "" : " and workspace"}.</p>
          </div>
        </header>
        <div className="settings-layout">
          <nav aria-label="Settings sections" className="settings-nav">
            {sections.map((section) => (
              <Link
                aria-current={section.key === active.key ? "page" : undefined}
                className="settings-nav-link"
                href={`/settings?section=${section.key}`}
                key={section.key}
              >
                <Icon name={section.icon} size={18} />
                <span>{section.label}</span>
              </Link>
            ))}
          </nav>
          <section className="settings-content">{content}</section>
        </div>
      </div>
    </WorkspaceShell>
  );
}
