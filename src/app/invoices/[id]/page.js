import Link from "next/link";
import { notFound } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import Icon from "@/components/Icon";
import { LinkPendingIndicator } from "@/components/NavigationFeedback";
import PrintButton from "@/components/PrintButton";
import { requireRole } from "@/lib/auth";
import { isUuid, todayIsoDate } from "@/lib/crmRecords.mjs";
import { formatCurrency } from "@/lib/formatCurrency.mjs";
import { displayInvoiceStatus, invoiceTotal } from "@/lib/invoiceRules.mjs";
import { getCurrentOrganizationSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Invoice · Moonkalp CRM" };

function formatDate(value) {
  return value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "—";
}

export default async function InvoicePage({ params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const profile = await requireRole(["admin", "team_member", "client"]);
  const supabase = await createClient();

  // RLS scopes this read: staff see every invoice, clients only their own
  // issued ones (drafts and voided invoices stay internal).
  const [{ data: invoice, error }, organization] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, status, issue_date, due_date, notes, sent_at, paid_at, clients(name, company_name, email, phone), invoice_items(id, position, description, quantity, unit_price)",
      )
      .eq("id", id)
      .maybeSingle(),
    getCurrentOrganizationSettings(),
  ]);

  if (error) throw new Error(`Could not load this invoice: ${error.message}`);
  if (!invoice) notFound();

  const items = [...(invoice.invoice_items ?? [])].sort((a, b) => a.position - b.position);
  const total = invoiceTotal(items);
  const status = displayInvoiceStatus(invoice, todayIsoDate());
  const backHref = profile.role === "client" ? "/client/portal#billing" : "/admin/dashboard";

  return (
    <div className="invoice-page">
      <div className="invoice-toolbar print-hidden">
        <Link className="button button-secondary" href={backHref}>
          <Icon name="back" size={18} /> Back
          <LinkPendingIndicator />
        </Link>
        <PrintButton />
      </div>

      <article aria-label={`Invoice ${invoice.invoice_number}`} className="invoice-sheet">
        <header className="invoice-sheet-head">
          <div className="invoice-brand">
            <BrandLogo height={36} />
            <div className="invoice-org">
              <strong>{organization.agency_name}</strong>
              {organization.support_email ? <span>{organization.support_email}</span> : null}
              {organization.support_phone ? <span>{organization.support_phone}</span> : null}
              {organization.website_url ? <span>{organization.website_url.replace(/^https?:\/\//, "")}</span> : null}
            </div>
          </div>
          <div className="invoice-id">
            <span className="eyebrow">INVOICE</span>
            <strong className="mono">{invoice.invoice_number}</strong>
            <span className={`invoice-stamp invoice-stamp-${status.toLowerCase()}`}>{status}</span>
          </div>
        </header>

        <div className="invoice-parties">
          <div>
            <span className="eyebrow">BILLED TO</span>
            <strong>{invoice.clients.company_name}</strong>
            <span>{invoice.clients.name}</span>
            <span>{invoice.clients.email}</span>
            {invoice.clients.phone ? <span>{invoice.clients.phone}</span> : null}
          </div>
          <div>
            <span className="eyebrow">DATES</span>
            <span>Issued {formatDate(invoice.issue_date)}</span>
            <span>Due {formatDate(invoice.due_date)}</span>
            {invoice.paid_at ? <span>Paid {formatDate(invoice.paid_at.slice(0, 10))}</span> : null}
          </div>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th className="num" scope="col">Qty</th>
              <th className="num" scope="col">Unit price</th>
              <th className="num" scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td className="num mono">{Number(item.quantity)}</td>
                <td className="num mono">{formatCurrency(item.unit_price)}</td>
                <td className="num mono">{formatCurrency(Number(item.quantity) * Number(item.unit_price))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={3} scope="row">Total due</th>
              <td className="num mono invoice-total">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>

        {invoice.notes ? (
          <div className="invoice-notes">
            <span className="eyebrow">NOTES</span>
            <p>{invoice.notes}</p>
          </div>
        ) : null}

        <footer className="invoice-sheet-foot">
          <span>Thank you for working with {organization.agency_name}.</span>
          {organization.support_email ? <span>Questions? {organization.support_email}</span> : null}
        </footer>
      </article>
    </div>
  );
}
