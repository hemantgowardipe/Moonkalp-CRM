const EVERYONE = ["admin", "team_member", "client"];
const STAFF = ["admin", "team_member"];

/** Settings sections in navigation order. Shared by the page and its loading skeletons. */
export const SETTINGS_SECTIONS = [
  { key: "profile", label: "Profile", icon: "user", roles: EVERYONE, description: "How you appear across the CRM." },
  { key: "appearance", label: "Appearance", icon: "palette", roles: EVERYONE, description: "Choose how the CRM looks on this and your other devices." },
  { key: "security", label: "Security", icon: "shield", roles: EVERYONE, description: "Keep your account safe." },
  { key: "organization", label: "Organization", icon: "building", roles: STAFF, description: "Your agency's details and service-level targets." },
  { key: "team", label: "Team", icon: "users", roles: STAFF, description: "People with access to the agency workspace." },
  {
    key: "audit",
    label: "Audit log",
    icon: "history",
    roles: ["admin"],
    description: "An append-only record of changes to clients, services, deliverables, payments, profiles, and settings.",
  },
];

/** Entities the audit log can be filtered by, in chip order. */
export const AUDIT_FILTER_ENTITIES = ["clients", "client_services", "deliverables", "payments", "users", "organization_settings"];

export function settingsSectionsFor(role) {
  return SETTINGS_SECTIONS.filter((section) => section.roles.includes(role));
}

export function settingsSectionHref(key) {
  return `/settings?section=${key}`;
}

export function settingsSubtitle(role) {
  return `Manage your account${role === "client" ? "" : " and workspace"}.`;
}
