import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

export default function WorkspaceShell({
  children,
  activeSection,
  profile,
  clientMode = false,
}) {
  const nav = clientMode
    ? [{ label: "My portal", href: "/client/portal", icon: "⌂" }]
    : [
        { label: "Overview", href: "/admin/dashboard", icon: "◫" },
        { label: "Clients", href: "/admin/dashboard#clients", icon: "◉" },
        { label: "Deliverables", href: "/admin/dashboard#deliverables", icon: "▧" },
        { label: "Billing", href: "/admin/dashboard#billing", icon: "◇" },
      ];

  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link className="brand sidebar-brand" href={clientMode ? "/client/portal" : "/admin/dashboard"}>
          <span className="brand-mark">m.</span>
          <span>moonkalp<span className="brand-muted"> / studio</span></span>
        </Link>
        <div className="workspace-label">{clientMode ? "CLIENT SPACE" : "WORKSPACE"}</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {nav.map((item) => (
            <a
              aria-current={item.label === activeSection ? "page" : undefined}
              className={item.label === activeSection ? "nav-link selected" : "nav-link"}
              href={item.href}
              key={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.label === "Clients" && !clientMode ? <span className="nav-trailing">↗</span> : null}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-divider" />
          <div className="user-card">
            <div className="user-avatar">{profile.full_name.slice(0, 1).toUpperCase()}</div>
            <div className="user-meta">
              <strong>{profile.full_name}</strong>
              <span>{profile.role.replace("_", " ")}</span>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="workspace-main">{children}</main>
    </div>
  );
}
