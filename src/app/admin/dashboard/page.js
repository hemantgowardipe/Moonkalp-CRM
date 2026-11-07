import SetupNotice from "@/components/SetupNotice";
import WorkspaceShell from "@/components/WorkspaceShell";
import ClientDirectory from "@/components/ClientDirectory";
import Icon from "@/components/Icon";
import NewClientForm from "@/components/NewClientForm";
import { requireRole } from "@/lib/auth";
import { PIPELINE_STATUSES } from "@/lib/crmRecords.mjs";
import { getCurrentOrganizationSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  formatAgencyDashboardCurrency,
  getAgencyDashboardMetrics,
} from "@/lib/agencyDashboard.mjs";

export const dynamic = "force-dynamic";

function Status({ children }) {
  const className = String(children).toLowerCase().replaceAll(" ", "-");
  return <span className={`status-pill status-${className}`}>{children}</span>;
}

export default async function AdminDashboardPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const profile = await requireRole(["admin", "team_member"]);
  const supabase = await createClient();
  const [{ data: clients, error }, { data: portalAccess, error: portalAccessError }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, company_name, email, phone, status, created_at, users(id, email, role), client_services(id, service_type, monthly_retainer, start_date, renewal_date, status, deliverables(id, title, category, pipeline_status, due_date, deliverable_reviews(id, action, note, created_at))), payments(id, amount, payment_status, due_date, paid_date, transaction_ref), client_portal_events(id, event, created_at)")
      .order("created_at", { ascending: false }),
    supabase.rpc("client_portal_access"),
  ]);

  if (error) {
    throw new Error(`Could not load client workspace: ${error.message}`);
  }
  if (portalAccessError) {
    throw new Error(`Could not load client portal access: ${portalAccessError.message}`);
  }

  const accessByClient = new Map((portalAccess ?? []).map((row) => [row.client_id, row]));
  const allClients = (clients ?? []).map((client) => ({
    ...client,
    portalAccess: accessByClient.get(client.id) ?? null,
    client_portal_events: [...(client.client_portal_events ?? [])]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5),
  }));
  const metrics = getAgencyDashboardMetrics(allClients);

  const organization = await getCurrentOrganizationSettings();
  const pipelineCounts = PIPELINE_STATUSES.map((status) => ({
    status,
    count: metrics.deliverables.filter((item) => item.pipeline_status === status).length,
  }));
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <WorkspaceShell active="overview" profile={profile} title="Overview">
      <div className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}</p>
            <h1>{greeting}, {profile.full_name.split(" ")[0]}</h1>
            <p className="page-subtitle">Here&apos;s how your agency is doing today.</p>
          </div>
          <div className="header-actions">
            <NewClientForm />
          </div>
        </header>

        <section aria-label="Agency performance" className="metric-grid">
          <article className="metric-card">
            <span className="metric-icon"><Icon name="trend" /></span>
            <span className="metric-label">Monthly recurring revenue</span>
            <strong className="metric-value">{formatAgencyDashboardCurrency(metrics.mrr)}</strong>
            <span className="metric-caption">From {metrics.activeServices.length} active service{metrics.activeServices.length === 1 ? "" : "s"}</span>
          </article>
          <article className="metric-card">
            <span className="metric-icon metric-icon-warning"><Icon name="clock" /></span>
            <span className="metric-label">Pending dues</span>
            <strong className="metric-value">{formatAgencyDashboardCurrency(metrics.pendingDues)}</strong>
            <span className="metric-caption">{metrics.pendingInvoiceCount} invoice{metrics.pendingInvoiceCount === 1 ? "" : "s"} awaiting payment</span>
          </article>
          <article className="metric-card">
            <span className="metric-icon metric-icon-info"><Icon name="layers" /></span>
            <span className="metric-label">Active services</span>
            <strong className="metric-value">{metrics.activeServices.length}</strong>
            <span className="metric-caption">Across {metrics.activeClientCount} active client{metrics.activeClientCount === 1 ? "" : "s"}</span>
          </article>
          <article className="metric-card metric-card-accent">
            <span className="metric-icon"><Icon name="users" /></span>
            <span className="metric-label">Clients</span>
            <strong className="metric-value">{metrics.clientCount}</strong>
            <span className="metric-caption">{metrics.activeClientCount} currently active</span>
          </article>
        </section>

        <ClientDirectory clients={allClients} paymentTermsDays={organization.payment_terms_days} />

        <section aria-labelledby="pipeline-heading" className="panel" id="deliverables">
          <div className="panel-heading">
            <div>
              <h2 id="pipeline-heading">Deliverables pipeline <span className="count-chip">{metrics.deliverables.length}</span></h2>
              <p className="panel-subtitle">Upcoming work across all clients, soonest due first.</p>
            </div>
          </div>
          <div className="stage-strip" role="list">
            {pipelineCounts.map(({ status, count }) => (
              <div className="stage-chip" key={status} role="listitem">
                <span className={`stage-dot stage-${status.toLowerCase().replaceAll(" ", "-")}`} />
                <span>{status}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          {metrics.deliverables.length ? (
            <ul className="pipeline-list">
              {metrics.deliverables.slice(0, 8).map((item) => (
                <li className="pipeline-row" key={item.id}>
                  <div className="pipeline-main"><strong>{item.title}</strong><span>{item.clientName} · {item.category}</span></div>
                  <Status>{item.pipeline_status}</Status>
                  <span className="pipeline-date">{item.due_date ? new Date(`${item.due_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "No date"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <span className="empty-icon"><Icon name="layers" /></span>
              <strong>No deliverables yet</strong>
              <p>Open a client, add a service, then add deliverables to track them here.</p>
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
