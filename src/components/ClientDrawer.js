"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/formatCurrency.mjs";
import ClientPortalInvite from "@/components/ClientPortalInvite";

const tabs = ["Overview", "Deliverables", "Billing"];

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
    : "Not scheduled";
}

export default function ClientDrawer({ client, onClose }) {
  const [activeTab, setActiveTab] = useState("Overview");
  const services = client.client_services ?? [];
  const deliverables = services.flatMap((service) =>
    (service.deliverables ?? []).map((item) => ({
      ...item,
      serviceType: service.service_type,
      latestReview: [...(item.deliverable_reviews ?? [])].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      )[0],
    })),
  );
  const payments = client.payments ?? [];

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside
        aria-label={`${client.company_name} client details`}
        aria-modal="true"
        className="client-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="drawer-topline">
          <span className="eyebrow">CLIENT RECORD / {client.id.slice(0, 8).toUpperCase()}</span>
          <button aria-label="Close client details" className="icon-button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="drawer-heading">
          <div className="client-avatar large">{client.company_name.slice(0, 1).toUpperCase()}</div>
          <div>
            <h2>{client.company_name}</h2>
            <p>{client.name} <span>·</span> {client.email}</p>
          </div>
        </div>
        <div className="drawer-tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              aria-selected={activeTab === tab}
              className={activeTab === tab ? "drawer-tab active" : "drawer-tab"}
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Overview" ? (
          <div className="drawer-content">
            <div className="drawer-stats">
              <div><span>MONTHLY RETAINER</span><strong>{formatCurrency(services.filter((service) => service.status === "Active").reduce((sum, service) => sum + Number(service.monthly_retainer), 0))}</strong></div>
              <div><span>ACTIVE SERVICES</span><strong>{services.filter((service) => service.status === "Active").length.toString().padStart(2, "0")}</strong></div>
            </div>
            <h3 className="section-label">CONTACT DETAILS</h3>
            <div className="detail-list">
              <div><span>Contact</span><strong>{client.name}</strong></div>
              <div><span>Email</span><strong>{client.email}</strong></div>
              <div><span>Phone</span><strong>{client.phone || "Not provided"}</strong></div>
              <div><span>Client since</span><strong>{formatDate(client.created_at?.slice(0, 10))}</strong></div>
              <div><span>Account status</span><Status>{client.status}</Status></div>
            </div>
            <h3 className="section-label section-label-spaced">SERVICES</h3>
            {services.length ? services.map((service) => (
              <div className="service-line" key={service.id}>
                <div><strong>{service.service_type}</strong><span>Renews {formatDate(service.renewal_date)}</span></div>
                <Status>{service.status}</Status>
              </div>
            )) : <p className="empty-note">No services on this account.</p>}
            <h3 className="section-label section-label-spaced">PORTAL ACCESS</h3>
            <ClientPortalInvite
              clientId={client.id}
              email={client.email}
              linked={(client.users ?? []).some((user) => user.role === "client")}
            />
          </div>
        ) : null}

        {activeTab === "Deliverables" ? (
          <div className="drawer-content">
            <h3 className="section-label">DELIVERABLES PIPELINE <span>{deliverables.length}</span></h3>
            {deliverables.length ? deliverables.map((item) => (
              <div className="drawer-item" key={item.id}>
                <div className="deliverable-dot" />
                <div className="drawer-item-main">
                  <strong>{item.title}</strong>
                  <span>{item.category} · {item.serviceType} · Due {formatDate(item.due_date)}</span>
                </div>
                <Status>{item.pipeline_status}</Status>
                {item.latestReview ? <Status>{item.latestReview.action}</Status> : null}
              </div>
            )) : <p className="empty-note">No deliverables have been added.</p>}
          </div>
        ) : null}

        {activeTab === "Billing" ? (
          <div className="drawer-content">
            <h3 className="section-label">BILLING HISTORY <span>{payments.length}</span></h3>
            {payments.length ? payments.map((payment) => (
              <div className="payment-line" key={payment.id}>
                <div>
                  <strong>{formatCurrency(Number(payment.amount))}</strong>
                  <span>Due {formatDate(payment.due_date)}{payment.transaction_ref ? ` · ${payment.transaction_ref}` : ""}</span>
                </div>
                <Status>{payment.payment_status}</Status>
              </div>
            )) : <p className="empty-note">No payment records have been added.</p>}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
