import { formatCurrency } from "./formatCurrency.mjs";

const clip = (value, max) => {
  const textValue = String(value ?? "").trim();
  return textValue.length > max ? `${textValue.slice(0, max - 1)}…` : textValue;
};

/**
 * Builds the stored notification for one event. Every event produces
 * { type, title, body, href }; titles fit the 160-character column.
 */
export function buildNotification(event, ctx = {}) {
  const deliverable = clip(ctx.deliverableTitle, 80);
  const client = clip(ctx.clientName, 60);

  switch (event) {
    case "deliverable_ready":
      return {
        type: event,
        title: `“${deliverable}” is ready for your review`,
        body: "Open your portal to approve it or request changes.",
        href: "/client/portal#deliverables",
      };
    case "review_approved":
      return {
        type: event,
        title: `${client} approved “${deliverable}”`,
        body: ctx.note ? `Note: ${clip(ctx.note, 300)}` : null,
        href: "/admin/dashboard#clients",
      };
    case "review_changes_requested":
      return {
        type: event,
        title: `${client} requested changes on “${deliverable}”`,
        body: ctx.note ? `Note: ${clip(ctx.note, 300)}` : null,
        href: "/admin/dashboard#clients",
      };
    case "invoice_sent":
      return {
        type: event,
        title: `Invoice ${ctx.invoiceNumber} · ${formatCurrency(ctx.amount)}`,
        body: `Due ${ctx.dueDate}. Open it to see the details.`,
        href: `/invoices/${ctx.invoiceId}`,
      };
    case "invoice_paid":
      return {
        type: event,
        title: `Payment recorded for invoice ${ctx.invoiceNumber}`,
        body: `${formatCurrency(ctx.amount)} has been marked as paid. Thank you!`,
        href: `/invoices/${ctx.invoiceId}`,
      };
    case "comment_added":
      return {
        type: event,
        title: `New comment on “${deliverable}”`,
        body: `${clip(ctx.authorName, 60)}: ${clip(ctx.comment, 280)}`,
        href: ctx.forStaff ? "/admin/dashboard#clients" : "/client/portal#deliverables",
      };
    default:
      throw new Error(`Unknown notification event: ${event}`);
  }
}

/** Compact relative timestamps for the notification list ("3h ago"). */
export function relativeTime(isoTimestamp, now = new Date()) {
  const then = new Date(isoTimestamp);
  const seconds = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d ago`;
  return then.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** The plain-text email that mirrors an in-app notification. */
export function emailForNotification(notification, { agencyName, siteUrl }) {
  const link = siteUrl && notification.href ? `\n\nOpen it here: ${new URL(notification.href, siteUrl).href}` : "";
  return {
    subject: `${agencyName}: ${notification.title}`,
    text: `${notification.title}${notification.body ? `\n\n${notification.body}` : ""}${link}\n\n— ${agencyName}`,
  };
}
