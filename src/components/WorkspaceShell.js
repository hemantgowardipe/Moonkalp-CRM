import Link from "next/link";
import Icon from "@/components/Icon";
import SignOutButton from "@/components/SignOutButton";
import { getCurrentOrganizationSettings } from "@/lib/settings";

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
  const organization = await getCurrentOrganizationSettings();
  const roleLabel = { admin: "Admin", team_member: "Team member", client: "Client" }[profile.role];

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>

      <aside className="sidebar" aria-label="Sidebar">
        <Link className="brand" href={home}>
          <span className="brand-mark">{organization.agency_name.slice(0, 1).toUpperCase()}</span>
          <span className="brand-text">
            <strong>{organization.agency_name}</strong>
            <span>{clientMode ? "Client portal" : "CRM workspace"}</span>
          </span>
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
          <span className="brand-mark">{organization.agency_name.slice(0, 1).toUpperCase()}</span>
        </Link>
        <span className="appbar-title">{title ?? organization.agency_name}</span>
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
