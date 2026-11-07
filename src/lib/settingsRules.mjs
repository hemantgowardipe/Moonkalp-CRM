export const THEMES = ["system", "light", "dark"];
export const DENSITIES = ["comfortable", "compact"];

// Mirrored into cookies so the root layout can apply them on the first paint.
export const THEME_COOKIE = "mk_theme";
export const DENSITY_COOKIE = "mk_density";
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const DEFAULT_ORGANIZATION = {
  agency_name: "Moonkalp Studio",
  support_email: null,
  support_phone: null,
  website_url: null,
  payment_terms_days: 15,
  revision_turnaround_days: 2,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(formData, name) {
  return String(formData.get(name) ?? "").trim();
}

function wholeNumber(value, min, max) {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
}

export function normalizeTheme(value) {
  return THEMES.includes(value) ? value : "system";
}

export function normalizeDensity(value) {
  return DENSITIES.includes(value) ? value : "comfortable";
}

export function parseAppearanceForm(formData) {
  const theme = text(formData, "theme");
  const density = text(formData, "density");

  if (!THEMES.includes(theme)) return { error: "Choose a theme." };
  if (!DENSITIES.includes(density)) return { error: "Choose a density." };
  return { values: { theme, density } };
}

export function parseProfileForm(formData) {
  const fullName = text(formData, "full_name").replace(/\s+/g, " ");
  if (!fullName) return { error: "Enter your name." };
  if (fullName.length > 80) return { error: "Name must be 80 characters or fewer." };
  return { values: { full_name: fullName } };
}

export function parseOrganizationForm(formData) {
  const agencyName = text(formData, "agency_name");
  const supportEmail = text(formData, "support_email").toLowerCase();
  const supportPhone = text(formData, "support_phone");
  const websiteUrl = text(formData, "website_url");
  const paymentTerms = wholeNumber(text(formData, "payment_terms_days"), 0, 120);
  const turnaround = wholeNumber(text(formData, "revision_turnaround_days"), 1, 30);

  if (!agencyName) return { error: "Enter the agency name." };
  if (agencyName.length > 80) return { error: "Agency name must be 80 characters or fewer." };
  if (supportEmail && !EMAIL_PATTERN.test(supportEmail)) return { error: "Enter a valid support email." };
  if (supportPhone.length > 30) return { error: "Support phone must be 30 characters or fewer." };
  if (websiteUrl && (!/^https?:\/\//i.test(websiteUrl) || websiteUrl.length > 200)) {
    return { error: "Website must start with http:// or https:// (200 characters max)." };
  }
  if (paymentTerms === null) return { error: "Payment terms must be a whole number of days from 0 to 120." };
  if (turnaround === null) return { error: "Revision turnaround must be a whole number of days from 1 to 30." };

  return {
    values: {
      agency_name: agencyName,
      support_email: supportEmail || null,
      support_phone: supportPhone || null,
      website_url: websiteUrl || null,
      payment_terms_days: paymentTerms,
      revision_turnaround_days: turnaround,
    },
  };
}

// Date the next invoice is due, given today's date and the agency's terms.
export function defaultDueDate(paymentTermsDays, now = new Date()) {
  const due = new Date(now.getFullYear(), now.getMonth(), now.getDate() + paymentTermsDays);
  const month = String(due.getMonth() + 1).padStart(2, "0");
  const day = String(due.getDate()).padStart(2, "0");
  return `${due.getFullYear()}-${month}-${day}`;
}

const ENTITY_LABELS = {
  clients: "Client",
  client_services: "Service",
  deliverables: "Deliverable",
  payments: "Payment",
  users: "User profile",
  organization_settings: "Organization settings",
};

export function describeAuditEntity(entity) {
  return ENTITY_LABELS[entity] ?? entity;
}

function formatAuditValue(value, names) {
  if (value === null || value === undefined || value === "") return "empty";
  if (typeof value === "object") return JSON.stringify(value);
  // User ids (e.g. updated_by) read better as the person's name.
  return names?.get(String(value)) ?? String(value);
}

/**
 * Short human-readable lines for an audit entry's `changes` payload. Updates
 * list each changed field; inserts and deletes name the record. `names` maps
 * user ids to display names.
 */
export function summarizeAuditChanges(entry, { maxFields = 4, names } = {}) {
  const changes = entry.changes ?? {};
  if (entry.action === "update") {
    const fields = Object.entries(changes);
    const lines = fields
      .slice(0, maxFields)
      .map(([field, change]) => `${field.replaceAll("_", " ")}: ${formatAuditValue(change?.from, names)} → ${formatAuditValue(change?.to, names)}`);
    if (fields.length > maxFields) lines.push(`+${fields.length - maxFields} more`);
    return lines;
  }
  const label = changes.company_name ?? changes.title ?? changes.full_name ?? changes.service_type
    ?? (changes.amount !== undefined ? `₹${changes.amount}` : null);
  return label ? [String(label)] : [];
}
