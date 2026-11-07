import SetupNotice from "@/components/SetupNotice";
import WorkspaceShell from "@/components/WorkspaceShell";
import ClientDirectory from "@/components/ClientDirectory";
import NewClientForm from "@/components/NewClientForm";
import { requireRole } from "@/lib/auth";
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
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, company_name, email, phone, status, created_at, users(id, email, role), client_services(id, service_type, monthly_retainer, renewal_date, status, deliverables(id, title, category, pipeline_status, due_date, deliverable_reviews(id, action, note, created_at))), payments(id, amount, payment_status, due_date, paid_date, transaction_ref)")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load client workspace: ${error.message}`);
  }

  const allClients = clients ?? [];
  const metrics = getAgencyDashboardMetrics(allClients);

  return (
    <WorkspaceShell activeSection="Overview" profile={profile}>
      <div className="page-content">
        <header className="page-header">
          <div>
            <div className="breadcrumb">WORKSPACE <span>/</span> OVERVIEW</div>
            <h1>Good morning, {profile.full_name.split(" ")[0]}<span className="heading-period">.</span></h1>
            <p className="page-subtitle">Here&apos;s the pulse of your agency today.</p>
          </div>
          <div className="header-actions">
            <span className="date-stamp">{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</span>
            <NewClientForm />
          </div>
        </header>

        <section aria-label="Agency performance" className="metric-grid">
          <article className="metric-card">
            <div className="metric-top"><span>MONTHLY RECURRING REVENUE</span><span className="metric-spark">↗</span></div>
            <strong className="metric-value">{formatAgencyDashboardCurrency(metrics.mrr)}</strong>
            <span className="metric-caption">From {metrics.activeServices.length} active service{metrics.activeServices.length === 1 ? "" : "s"}</span>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>PENDING DUES</span><span className="metric-spark muted">◷</span></div>
            <strong className="metric-value">{formatAgencyDashboardCurrency(metrics.pendingDues)}</strong>
            <span className="metric-caption">{metrics.pendingInvoiceCount} invoice{metrics.pendingInvoiceCount === 1 ? "" : "s"} awaiting payment</span>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>ACTIVE PROJECTS</span><span className="metric-spark">▦</span></div>
            <strong className="metric-value">{metrics.activeServices.length.toString().padStart(2, "0")}</strong>
            <span className="metric-caption">Across {metrics.activeClientCount} active clients</span>
          </article>
          <article className="metric-card metric-card-dark">
            <div className="metric-top"><span>CLIENTS IN YOUR CARE</span><span className="metric-spark">◉</span></div>
            <strong className="metric-value">{metrics.clientCount.toString().padStart(2, "0")}</strong>
            <span className="metric-caption">{metrics.activeClientCount} currently active</span>
          </article>
        </section>

        <ClientDirectory clients={allClients} />

        <section className="content-panel work-panel" id="deliverables">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">IN MOTION</div>
              <h2>Deliverables pipeline <span className="count-chip">{metrics.deliverables.length}</span></h2>
            </div>
            <a className="text-link" href="#clients">VIEW CLIENTS&nbsp; ↗</a>
          </div>
          {metrics.deliverables.length ? (
            <div className="pipeline-list">
              {metrics.deliverables.slice(0, 6).map((item) => (
                <div className="pipeline-row" key={item.id}>
                  <span className="pipeline-dot" />
                  <div className="pipeline-main"><strong>{item.title}</strong><span>{item.clientName} · {item.category}</span></div>
                  <Status>{item.pipeline_status}</Status>
                  <span className="pipeline-date">{item.due_date ? new Date(`${item.due_date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</span>
                </div>
              ))}
            </div>
          ) : <p className="empty-note panel-empty">Deliverables added to client services will appear here.</p>}
        </section>
      </div>
    </WorkspaceShell>
  );
}
