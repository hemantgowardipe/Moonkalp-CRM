import { formatCurrency } from "./formatCurrency.mjs";
import { invoiceTotal } from "./invoiceRules.mjs";

export function getAgencyDashboardMetrics(clients) {
  const activeServices = clients.flatMap((client) =>
    (client.client_services ?? []).filter((service) => service.status === "Active"),
  );
  const unpaid = clients.flatMap((client) =>
    (client.payments ?? []).filter(
      (payment) =>
        payment.payment_status === "Pending" ||
        payment.payment_status === "Overdue",
    ),
  );
  // Issued invoices awaiting payment; manual unpaid payment rows are separate
  // entries (an invoice only gains a payment row once it is settled).
  const outstandingInvoices = clients.flatMap((client) =>
    (client.invoices ?? []).filter((invoice) => invoice.status === "Sent"),
  );
  const deliverables = clients.flatMap((client) =>
    (client.client_services ?? []).flatMap((service) =>
      (service.deliverables ?? []).map((item) => ({
        ...item,
        clientName: client.company_name,
        serviceType: service.service_type,
      })),
    ),
  ).sort((a, b) =>
    (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31"),
  );

  return {
    activeServices,
    activeClientCount: clients.filter((client) => client.status === "Active").length,
    clientCount: clients.length,
    deliverables,
    mrr: activeServices.reduce(
      (sum, service) => sum + Number(service.monthly_retainer),
      0,
    ),
    pendingDues:
      unpaid.reduce((sum, payment) => sum + Number(payment.amount), 0) +
      outstandingInvoices.reduce((sum, invoice) => sum + invoiceTotal(invoice.invoice_items), 0),
    pendingInvoiceCount: unpaid.length + outstandingInvoices.length,
  };
}

export function formatAgencyDashboardCurrency(amount) {
  return formatCurrency(amount);
}
