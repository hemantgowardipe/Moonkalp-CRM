import SetupNotice from "@/components/SetupNotice";
import DatabaseMigrationNotice from "@/components/DatabaseMigrationNotice";
import WorkspaceShell from "@/components/WorkspaceShell";
import CommentThread from "@/components/CommentThread";
import DeliverableReviewActions from "@/components/DeliverableReviewActions";
import Icon from "@/components/Icon";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { todayIsoDate } from "@/lib/crmRecords.mjs";
import { formatFileSize } from "@/lib/deliverableFiles.mjs";
import { formatCurrency } from "@/lib/formatCurrency.mjs";
import { displayInvoiceStatus, invoiceTotal, outstandingInvoiceTotal } from "@/lib/invoiceRules.mjs";
import { getCurrentOrganizationSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function Status({ children }) {
  const className = String(children).toLowerCase().replaceAll(" ", "-");
  return <span className={`status-pill status-${className}`}>{children}</span>;
}

function formatDate(value) {
  return value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not set";
}

function latestReview(item) {
  return [...(item.deliverable_reviews ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export default async function ClientPortalPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const profile = await requireRole(["client"]);
  const supabase = await createClient();
  const [{ data: client, error }, organization] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, company_name, client_services(id, service_type, monthly_retainer, renewal_date, status, deliverables(id, title, category, pipeline_status, due_date, deliverable_reviews(id, action, note, created_at), deliverable_files(id, file_name, content_type, size_bytes, created_at), deliverable_comments(id, author_name, author_role, body, created_at))), payments(id, amount, payment_status, due_date, paid_date, transaction_ref), invoices(id, invoice_number, status, issue_date, due_date, paid_at, created_at, invoice_items(id, position, description, quantity, unit_price))")
      .eq("id", profile.client_id)
      .maybeSingle(),
    getCurrentOrganizationSettings(),
  ]);

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
  const deliverables = services
    .flatMap((service) =>
      (service.deliverables ?? []).map((item) => ({ ...item, serviceType: service.service_type, latestReview: latestReview(item) })),
    )
    .sort((a, b) => (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31"));
  const needsReview = deliverables.filter(
    (item) => item.pipeline_status === "Pending Approval" && item.latestReview?.action !== "Approved",
  );
  const otherWork = deliverables.filter((item) => !needsReview.includes(item));
  const payments = [...(client.payments ?? [])].sort((a, b) => b.due_date.localeCompare(a.due_date));
  const invoices = [...(client.invoices ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const amountDue =
    payments
      .filter((payment) => payment.payment_status !== "Paid")
      .reduce((sum, payment) => sum + Number(payment.amount), 0) +
    outstandingInvoiceTotal(invoices);
  const today = todayIsoDate();
  const turnaround = organization.revision_turnaround_days;

  function WorkExtras({ item }) {
    const files = item.deliverable_files ?? [];
    return (
      <>
        {files.length ? (
          <ul className="file-chip-list">
            {files.map((file) => (
              <li key={file.id}>
                <a className="file-chip" href={`/files/deliverable/${file.id}`} rel="noreferrer" target="_blank">
                  <Icon name="file" size={15} />
                  <span>{file.file_name}</span>
                  <span className="file-size">{formatFileSize(file.size_bytes)}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <CommentThread comments={item.deliverable_comments ?? []} deliverableId={item.id} />
      </>
    );
  }

  return (
    <WorkspaceShell active="overview" profile={profile} title="Home">
      <div className="page page-narrow">
        <header className="page-header">
          <div>
            <p className="eyebrow">{client.company_name}</p>
            <h1>Welcome, {client.name.split(" ")[0]}</h1>
            <p className="page-subtitle">Everything {organization.agency_name} is working on for you, in one place.</p>
          </div>
        </header>

        <section aria-label="Summary" className="summary-grid">
          <a className={needsReview.length ? "summary-card summary-card-attention" : "summary-card"} href="#deliverables">
            <span className="summary-icon"><Icon name="inbox" /></span>
            <span className="summary-label">Needs your review</span>
            <strong>{needsReview.length}</strong>
          </a>
          <a className="summary-card" href="#services">
            <span className="summary-icon"><Icon name="layers" /></span>
            <span className="summary-label">Active services</span>
            <strong>{activeServices.length}</strong>
          </a>
          <a className={amountDue ? "summary-card summary-card-warning" : "summary-card"} href="#billing">
            <span className="summary-icon"><Icon name="card" /></span>
            <span className="summary-label">Amount due</span>
            <strong>{formatCurrency(amountDue)}</strong>
          </a>
        </section>

        <section aria-labelledby="review-heading" className="portal-section" id="deliverables">
          <div className="section-heading">
            <h2 id="review-heading">Waiting for your review</h2>
            {needsReview.length ? <span className="count-chip count-chip-attention">{needsReview.length}</span> : null}
          </div>
          {needsReview.length ? (
            <>
              <p className="section-note">
                Approve work that&apos;s ready, or request changes with a short note. We respond to revision requests within{" "}
                {turnaround} business day{turnaround === 1 ? "" : "s"}.
              </p>
              <ul className="card-list">
                {needsReview.map((item) => (
                  <li className="work-card work-card-review" key={item.id}>
                    <div className="work-card-head">
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.category} · {item.serviceType}</span>
                      </div>
                      <Status>{item.latestReview?.action === "Revision Requested" ? "Revision Requested" : "Pending Approval"}</Status>
                    </div>
                    <p className="work-card-meta"><Icon name="clock" size={16} /> Due {formatDate(item.due_date)}</p>
                    {item.latestReview?.note ? <p className="review-detail">Your note: “{item.latestReview.note}”</p> : null}
                    <WorkExtras item={item} />
                    <DeliverableReviewActions deliverableId={item.id} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="empty-card">
              <span className="empty-icon"><Icon name="check" /></span>
              <strong>You&apos;re all caught up</strong>
              <p>We&apos;ll show work here when it&apos;s ready for your approval.</p>
            </div>
          )}
        </section>

        {otherWork.length ? (
          <section aria-labelledby="work-heading" className="portal-section">
            <div className="section-heading">
              <h2 id="work-heading">All work</h2>
              <span className="count-chip">{otherWork.length}</span>
            </div>
            <ul className="card-list">
              {otherWork.map((item) => (
                <li className="work-card" key={item.id}>
                  <div className="work-card-head">
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.category} · {item.serviceType} · Due {formatDate(item.due_date)}</span>
                    </div>
                    <div className="status-stack">
                      <Status>{item.pipeline_status}</Status>
                      {item.latestReview ? <Status>{item.latestReview.action}</Status> : null}
                    </div>
                  </div>
                  <WorkExtras item={item} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="services-heading" className="portal-section" id="services">
          <div className="section-heading">
            <h2 id="services-heading">Your services</h2>
            <span className="count-chip">{activeServices.length}</span>
          </div>
          {activeServices.length ? (
            <ul className="card-list card-grid">
              {activeServices.map((service) => (
                <li className="service-card" key={service.id}>
                  <span className="service-card-icon"><Icon name={service.service_type === "Social Media" ? "users" : "monitor"} /></span>
                  <div className="service-card-body">
                    <strong>{service.service_type}</strong>
                    <span>{formatCurrency(service.monthly_retainer)} / month</span>
                  </div>
                  <span className="service-card-renewal">Renews {formatDate(service.renewal_date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-card"><p>There are no active services on your account.</p></div>
          )}
        </section>

        <section aria-labelledby="billing-heading" className="portal-section" id="billing">
          <div className="section-heading">
            <h2 id="billing-heading">Invoices</h2>
            <span className="count-chip">{invoices.length}</span>
          </div>
          {invoices.length ? (
            <ul className="card-list list-box">
              {invoices.map((invoice) => {
                const status = displayInvoiceStatus(invoice, today);
                return (
                  <li className="payment-row" key={invoice.id}>
                    <div>
                      <strong className="mono">{invoice.invoice_number}</strong>
                      <span>
                        {formatCurrency(invoiceTotal(invoice.invoice_items))} ·{" "}
                        {invoice.status === "Paid"
                          ? `Paid ${formatDate(invoice.paid_at?.slice(0, 10))}`
                          : `Due ${formatDate(invoice.due_date)}`}
                      </span>
                    </div>
                    <div className="invoice-row-end">
                      <Status>{status}</Status>
                      <a className="button button-secondary button-small" href={`/invoices/${invoice.id}`} rel="noreferrer" target="_blank">
                        View
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty-card"><p>Invoices from {organization.agency_name} will appear here.</p></div>
          )}

          <div className="section-heading section-heading-spaced">
            <h2>Payment history</h2>
            <span className="count-chip">{payments.length}</span>
          </div>
          {payments.length ? (
            <ul className="card-list list-box">
              {payments.map((payment) => (
                <li className="payment-row" key={payment.id}>
                  <div>
                    <strong className="mono">{formatCurrency(payment.amount)}</strong>
                    <span>
                      {payment.payment_status === "Paid" ? `Paid ${formatDate(payment.paid_date)}` : `Due ${formatDate(payment.due_date)}`}
                      {payment.transaction_ref ? ` · ${payment.transaction_ref}` : ""}
                    </span>
                  </div>
                  <Status>{payment.payment_status}</Status>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-card"><p>Your payment history will appear here when an invoice is added.</p></div>
          )}
        </section>

        <section aria-labelledby="help-heading" className="help-card">
          <div>
            <h2 id="help-heading">Need help?</h2>
            <p>Questions about a deliverable or invoice? Reach out to {organization.agency_name}.</p>
          </div>
          <div className="help-actions">
            {organization.support_email ? (
              <a className="button button-secondary" href={`mailto:${organization.support_email}`}><Icon name="mail" size={18} /> Email us</a>
            ) : null}
            {organization.support_phone ? (
              <a className="button button-secondary" href={`tel:${organization.support_phone.replace(/[^\d+]/g, "")}`}><Icon name="phone" size={18} /> Call us</a>
            ) : null}
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
