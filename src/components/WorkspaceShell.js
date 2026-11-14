import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import Icon from "@/components/Icon";
import NotificationsBell from "@/components/NotificationsBell";
import SignOutButton from "@/components/SignOutButton";
import { getCurrentOrganizationSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

async function getNotifications(authId) {
  const supabase = await createClient();
  const [{ data: notifications, error }, { count, error: countError }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, title, body, href, created_at, read_at")
      .eq("recipient_auth_id", authId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_auth_id", authId)
      .is("read_at", null),
  ]);

  // A missing table (migration not run yet) must not take down the shell.
  if (error || countError) {
    console.error("[notifications] Could not load inbox", (error ?? countError).message);
    return { notifications: [], unreadCount: 0 };
  }
  return { notifications: notifications ?? [], unreadCount: count ?? 0 };
}

const STAFF_NAV = [
  { key: "overview", label: "Overview", href: "/admin/dashboard", icon: "home" },
  { key: "clients", label: "Clients", href: "/admin/dashboard#clients", icon: "users" },
  { key: "pipeline", label: "Pipeline", href: "/admin/dashboard#deliverables", icon: "layers" },
  { key: "settings", label: "Settings", href: "/settings", icon: "settings" },
];

const CLIENT_NAV = [
  { key: "overview", label: "Home", href: "/client/portal", icon: "home" },
  { key: "reviews", label: "Reviews", href: "/client/portal#deliverables", icon: "inbox" },
  { key: "billing", label: "Billing", href: "/client/portal#billing", icon: "card" },
  { key: "settings", label: "Settings", href: "/settings", icon: "settings" },
];

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export default async function WorkspaceShell({ children, active = "overview", profile, title }) {
  const clientMode = profile.role === "client";
  const nav = clientMode ? CLIENT_NAV : STAFF_NAV;
  const home = clientMode ? "/client/portal" : "/admin/dashboard";
  const [organization, inbox] = await Promise.all([
    getCurrentOrganizationSettings(),
    getNotifications(profile.auth_id),
  ]);
  const roleLabel = { admin: "Admin", team_member: "Team member", client: "Client" }[profile.role];

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>

      <aside className="sidebar" aria-label="Sidebar">
        <Link aria-label={`${organization.agency_name} home`} className="brand" href={home}>
          <BrandLogo height={40} priority />
          <span className="brand-caption">{clientMode ? "Client portal" : "Workspace"}</span>
        </Link>
        <nav aria-label="Main navigation" className="sidebar-nav">
          {nav.map((item) => (
            <Link
              aria-current={item.key === active ? "page" : undefined}
              className="nav-link"
              href={item.href}
              key={item.key}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <NotificationsBell notifications={inbox.notifications} placement="sidebar" unreadCount={inbox.unreadCount} />
          <Link className="user-chip" href="/settings">
            <span className="avatar">{initials(profile.full_name)}</span>
            <span className="user-chip-text">
              <strong>{profile.full_name}</strong>
              <span>{roleLabel}</span>
            </span>
          </Link>
          <SignOutButton />
        </div>
      </aside>

      <header className="appbar">
        <Link aria-label={`${organization.agency_name} home`} className="brand brand-compact" href={home}>
          <BrandLogo height={30} />
        </Link>
        <span className="appbar-title">{title ?? organization.agency_name}</span>
        <NotificationsBell notifications={inbox.notifications} placement="appbar" unreadCount={inbox.unreadCount} />
        <Link aria-label="Account settings" className="avatar avatar-button" href="/settings">
          {initials(profile.full_name)}
        </Link>
      </header>

      <main className="app-main" id="main">{children}</main>

      <nav aria-label="Main navigation" className="bottom-nav">
        {nav.map((item) => (
          <Link
            aria-current={item.key === active ? "page" : undefined}
            className="bottom-nav-item"
            href={item.href}
            key={item.key}
          >
            <span className="bottom-nav-icon"><Icon name={item.icon} size={22} /></span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
