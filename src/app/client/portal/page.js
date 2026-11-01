import SetupNotice from "@/components/SetupNotice";
import DatabaseMigrationNotice from "@/components/DatabaseMigrationNotice";
import WorkspaceShell from "@/components/WorkspaceShell";
import DeliverableReviewActions from "@/components/DeliverableReviewActions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatCurrency } from "@/lib/formatCurrency.mjs";

export const dynamic = "force-dynamic";

function Status({ children }) {
  const className = String(children).toLowerCase().replaceAll(" ", "-");
  return <span className={`status-pill status-${className}`}>{children}</span>;
}

function formatDate(value) {
  return value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
}

export default async function ClientPortalPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const profile = await requireRole(["client"]);
  const supabase = await createClient();
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, name, company_name, client_services(id, service_type, monthly_retainer, renewal_date, status, deliverables(id, title, category, pipeline_status, due_date, deliverable_reviews(id, action, note, created_at))), payments(id, amount, payment_status, due_date, paid_date, transaction_ref)")
    .eq("id", profile.client_id)
    .maybeSingle();

  if (error) {
    if (
      error.code === "PGRST200" &&
      error.message.includes("'deliverables' and 'deliverable_reviews'")
    ) {
      return <DatabaseMigrationNotice />;
    }

    throw new Error(`Could not load your client portal: ${error.message}`);
  }

  if (!client) {
    throw new Error("Your CRM profile is not linked to an available client record.");
  }

  const services = client.client_services ?? [];
  const activeServices = services.filter((service) => service.status === "Active");
  const deliverables = services.flatMap((service) =>
    (service.deliverables ?? []).map((item) => ({
      ...item,
      serviceType: service.service_type,
      latestReview: [...(item.deliverable_reviews ?? [])].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      )[0],
    })),
  );
  const pending = deliverables.filter((item) => {
    const latestReview = [...(item.deliverable_reviews ?? [])].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    )[0];
    return item.pipeline_status === "Pending Approval" && latestReview?.action !== "Approved";
  });
  const payments = (client.payments ?? []).sort((a, b) => b.due_date.localeCompare(a.due_date));

  return (
    <WorkspaceShell activeSection="My portal" clientMode profile={profile}>
      <div className="page-content client-page-content">
        <header className="page-header">
          <div>
            <div className="breadcrumb">CLIENT SPACE <span>/</span> YOUR PORTAL</div>
            <h1>Welcome, {client.name.split(" ")[0]}<span className="heading-period">.</span></h1>
            <p className="page-subtitle">Everything we&apos;re working on together, in one place.</p>
          </div>
          <span className="client-company-tag">{client.company_name}</span>
        </header>
        <section className="portal-summary">
          <div><span>ACTIVE SERVICES</span><strong>{activeServices.length.toString().padStart(2, "0")}</strong></div>
          <div><span>AWAITING YOUR REVIEW</span><strong>{pending.length.toString().padStart(2, "0")}</strong></div>
          <div><span>PAYMENT RECORDS</span><strong>{payments.length.toString().padStart(2, "0")}</strong></div>
        </section>

        <section className="content-panel">
          <div className="panel-heading">
            <div><div className="section-kicker">YOUR RETAINER</div><h2>Active services <span className="count-chip">{activeServices.length}</span></h2></div>
          </div>
          {activeServices.length ? (
            <div className="portal-service-grid">
              {activeServices.map((service) => (
                <article className="portal-service-card" key={service.id}>
                  <div className="portal-service-icon">{service.service_type === "Social Media" ? "◎" : "⌘"}</div>
                  <div className="portal-service-heading"><div><span className="section-kicker">{service.service_type === "Social Media" ? "CONTENT & COMMUNITY" : "DIGITAL PRESENCE"}</span><h3>{service.service_type}</h3></div><Status>{service.status}</Status></div>
                  <div className="portal-service-footer"><span>{formatCurrency(service.monthly_retainer)}<small> / month</small></span><span>Renews {formatDate(service.renewal_date)}</span></div>
                </article>
              ))}
            </div>
          ) : <p className="empty-note panel-empty">There are no active services on your account.</p>}
        </section>

        <section className="content-panel">
          <div className="panel-heading">
            <div><div className="section-kicker">CONTENT STUDIO</div><h2>Your deliverables <span className="count-chip">{deliverables.length}</span></h2></div>
            <span className="panel-meta">{pending.length} NEEDING REVIEW</span>
          </div>
          {deliverables.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>DELIVERABLE</th><th>SERVICE</th><th>DUE DATE</th><th>STATUS / REVIEW</th></tr></thead>
                <tbody>{deliverables.map((item) => (
                  <tr key={item.id}>
                    <td><span className="client-cell"><strong>{item.title}</strong><span>{item.category}</span></span></td>
                    <td>{item.serviceType}</td>
                    <td>{formatDate(item.due_date)}</td>
                    <td>
                      <div className="portal-deliverable-status">
                        <Status>{item.pipeline_status}</Status>
                        {item.latestReview ? <Status>{item.latestReview.action}</Status> : null}
                      </div>
                      {item.pipeline_status === "Pending Approval" && item.latestReview?.action !== "Approved" ? (
                        <DeliverableReviewActions deliverableId={item.id} />
                      ) : null}
                      {item.latestReview?.note ? <p className="review-detail">{item.latestReview.note}</p> : null}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="empty-note panel-empty">Your team&apos;s deliverables will show up here.</p>}
          {pending.length ? <p className="review-note">Your agency team will contact you when an item is ready for approval.</p> : null}
        </section>

        <section className="content-panel" id="billing">
          <div className="panel-heading">
            <div><div className="section-kicker">ACCOUNTING</div><h2>Payment history <span className="count-chip">{payments.length}</span></h2></div>
          </div>
          {payments.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>INVOICE</th><th>DUE DATE</th><th>PAID DATE</th><th>REFERENCE</th><th>STATUS</th></tr></thead>
                <tbody>{payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="mono-cell">{formatCurrency(payment.amount)}</td>
                    <td>{formatDate(payment.due_date)}</td>
                    <td>{formatDate(payment.paid_date)}</td>
                    <td className="cell-secondary">{payment.transaction_ref || "—"}</td>
                    <td><Status>{payment.payment_status}</Status></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="empty-note panel-empty">Your payment history will appear here when an invoice is added.</p>}
        </section>
        <p className="portal-contact">Questions about a deliverable or invoice? Reach out to your agency contact.</p>
      </div>
    </WorkspaceShell>
  );
}
