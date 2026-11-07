"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/formatCurrency.mjs";
import ClientPortalAccess from "@/components/ClientPortalAccess";
import {
  AddDeliverableForm,
  AddPaymentForm,
  AddServiceForm,
  ClientDetailsForm,
  DeliverableStatusSelect,
  EditButton,
  EditDeliverableForm,
  EditPaymentForm,
  EditServiceForm,
  EditableRecord,
  PaymentStatusSelect,
} from "@/components/DrawerForms";

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
      serviceId: service.id,
      serviceType: service.service_type,
      latestReview: [...(item.deliverable_reviews ?? [])].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      )[0],
    })),
  );
  const payments = client.payments ?? [];
  const linked = (client.users ?? []).some((user) => user.role === "client");

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
            <EditableRecord
              editor={(close) => (
                <>
                  <h3 className="section-label">CONTACT DETAILS</h3>
                  <ClientDetailsForm client={client} linked={linked} onDone={close} />
                </>
              )}
            >
              {(edit) => (
                <>
                  <h3 className="section-label">CONTACT DETAILS <EditButton label="Edit contact details" onClick={edit} /></h3>
                  <div className="detail-list">
                    <div><span>Company</span><strong>{client.company_name}</strong></div>
                    <div><span>Contact</span><strong>{client.name}</strong></div>
                    <div><span>Email</span><strong>{client.email}</strong></div>
                    <div><span>Phone</span><strong>{client.phone || "Not provided"}</strong></div>
                    <div><span>Client since</span><strong>{formatDate(client.created_at?.slice(0, 10))}</strong></div>
                    <div><span>Account status</span><Status>{client.status}</Status></div>
                  </div>
                </>
              )}
            </EditableRecord>
            <h3 className="section-label section-label-spaced">SERVICES</h3>
            {services.length ? services.map((service) => (
              <EditableRecord
                editor={(close) => <EditServiceForm clientId={client.id} onDone={close} service={service} />}
                key={service.id}
              >
                {(edit) => (
                  <div className="service-line">
                    <div><strong>{service.service_type}</strong><span>{formatCurrency(Number(service.monthly_retainer))} / month · Renews {formatDate(service.renewal_date)}</span></div>
                    <Status>{service.status}</Status>
                    <EditButton label={`Edit ${service.service_type} service`} onClick={edit} />
                  </div>
                )}
              </EditableRecord>
            )) : <p className="empty-note">No services on this account.</p>}
            <AddServiceForm clientId={client.id} />
            <h3 className="section-label section-label-spaced">PORTAL ACCESS</h3>
            <ClientPortalAccess client={client} />
          </div>
        ) : null}

        {activeTab === "Deliverables" ? (
          <div className="drawer-content">
            <h3 className="section-label">DELIVERABLES PIPELINE <span>{deliverables.length}</span></h3>
            {deliverables.length ? deliverables.map((item) => (
              <EditableRecord
                editor={(close) => <EditDeliverableForm deliverable={item} onDone={close} services={services} />}
                key={item.id}
              >
                {(edit) => (
                  <div className="drawer-item">
                    <div className="deliverable-dot" />
                    <div className="drawer-item-main">
                      <strong>{item.title}</strong>
                      <span>{item.category} · {item.serviceType} · Due {formatDate(item.due_date)}</span>
                    </div>
                    {item.latestReview ? <Status>{item.latestReview.action}</Status> : null}
                    <DeliverableStatusSelect deliverable={item} />
                    <EditButton label={`Edit ${item.title}`} onClick={edit} />
                  </div>
                )}
              </EditableRecord>
            )) : <p className="empty-note">No deliverables have been added.</p>}
            <AddDeliverableForm services={services} />
          </div>
        ) : null}

        {activeTab === "Billing" ? (
          <div className="drawer-content">
            <h3 className="section-label">BILLING HISTORY <span>{payments.length}</span></h3>
            {payments.length ? payments.map((payment) => (
              <EditableRecord
                editor={(close) => <EditPaymentForm clientId={client.id} onDone={close} payment={payment} />}
                key={payment.id}
              >
                {(edit) => (
                  <div className="payment-line">
                    <div>
                      <strong>{formatCurrency(Number(payment.amount))}</strong>
                      <span>Due {formatDate(payment.due_date)}{payment.transaction_ref ? ` · ${payment.transaction_ref}` : ""}</span>
                    </div>
                    <PaymentStatusSelect payment={payment} />
                    <EditButton label={`Edit ${formatCurrency(Number(payment.amount))} payment`} onClick={edit} />
                  </div>
                )}
              </EditableRecord>
            )) : <p className="empty-note">No payment records have been added.</p>}
            <AddPaymentForm clientId={client.id} />
          </div>
        ) : null}
      </aside>
    </div>
  );
}
