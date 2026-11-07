"use client";

import { useMemo, useState } from "react";
import ClientDrawer from "@/components/ClientDrawer";
import Icon from "@/components/Icon";
import { formatCurrency } from "@/lib/formatCurrency.mjs";
import { getPortalStatus } from "@/lib/portalAccess.mjs";

function Status({ children }) {
  const className = String(children).toLowerCase().replaceAll(" ", "-");
  return <span className={`status-pill status-${className}`}>{children}</span>;
}

const PORTAL_LABELS = { not_invited: "Not invited", invited: "Invited", active: "Active", disabled: "Disabled" };

export default function ClientDirectory({ clients, paymentTermsDays }) {
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [query, setQuery] = useState("");
  const selectedClient = clients.find((client) => client.id === selectedClientId);

  const visibleClients = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((client) =>
      [client.company_name, client.name, client.email].some((value) => value?.toLowerCase().includes(needle)),
    );
  }, [clients, query]);

  return (
    <>
      <section aria-labelledby="clients-heading" className="panel" id="clients">
        <div className="panel-heading">
          <div>
            <h2 id="clients-heading">Clients <span className="count-chip">{clients.length}</span></h2>
            <p className="panel-subtitle">Select a client to manage services, billing, and portal access.</p>
          </div>
          {clients.length ? (
            <label className="search-field">
              <span className="visually-hidden">Search clients</span>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search clients"
                type="search"
                value={query}
              />
            </label>
          ) : null}
        </div>
        {visibleClients.length ? (
          <div className="table-scroll">
            <table className="data-table data-table-cards">
              <thead><tr><th scope="col">Client</th><th scope="col">Services</th><th scope="col">Monthly</th><th scope="col">Open work</th><th scope="col">Portal</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Open</span></th></tr></thead>
              <tbody>
                {visibleClients.map((client) => {
                  const services = client.client_services ?? [];
                  const openWork = services.flatMap((service) => service.deliverables ?? []).filter((item) => item.pipeline_status !== "Published").length;
                  const retainer = services.filter((service) => service.status === "Active").reduce((sum, service) => sum + Number(service.monthly_retainer), 0);
                  const portal = getPortalStatus(client.portalAccess);
                  return (
                    <tr key={client.id} onClick={() => setSelectedClientId(client.id)}>
                      <td className="cell-primary">
                        <button className="client-name-link" onClick={(event) => { event.stopPropagation(); setSelectedClientId(client.id); }} type="button">
                          <span className="client-avatar">{client.company_name.slice(0, 1).toUpperCase()}</span>
                          <span className="client-cell"><strong>{client.company_name}</strong><span>{client.name}</span></span>
                        </button>
                      </td>
                      <td data-label="Services">{services.length}</td>
                      <td className="mono-cell" data-label="Monthly">{formatCurrency(retainer)}</td>
                      <td data-label="Open work">{openWork}</td>
                      <td data-label="Portal"><span className={`status-pill status-portal-${portal}`}>{PORTAL_LABELS[portal]}</span></td>
                      <td data-label="Status"><Status>{client.status}</Status></td>
                      <td className="cell-action"><span className="row-arrow"><Icon name="chevron" size={18} /></span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : clients.length ? (
          <div className="empty-state">
            <span className="empty-icon"><Icon name="users" /></span>
            <strong>No clients match “{query}”</strong>
            <p>Try a company name, contact name, or email.</p>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon"><Icon name="users" /></span>
            <strong>Your client list starts here</strong>
            <p>Add your first client to bring services, deliverables, and billing into one place.</p>
          </div>
        )}
      </section>
      {selectedClient ? (
        <ClientDrawer client={selectedClient} onClose={() => setSelectedClientId(null)} paymentTermsDays={paymentTermsDays} />
      ) : null}
    </>
  );
}
