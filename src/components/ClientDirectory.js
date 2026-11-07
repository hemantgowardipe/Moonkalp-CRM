"use client";

import { useState } from "react";
import ClientDrawer from "@/components/ClientDrawer";
import { formatCurrency } from "@/lib/formatCurrency.mjs";

function Status({ children }) {
  const className = String(children).toLowerCase().replaceAll(" ", "-");
  return <span className={`status-pill status-${className}`}>{children}</span>;
}

export default function ClientDirectory({ clients }) {
  const [selectedClientId, setSelectedClientId] = useState(null);
  const selectedClient = clients.find((client) => client.id === selectedClientId);

  return (
    <>
      <section className="content-panel" id="clients">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">RELATIONSHIPS</div>
            <h2>Client directory <span className="count-chip">{clients.length}</span></h2>
          </div>
          <span className="panel-meta">CLICK A CLIENT TO OPEN THEIR RECORD&nbsp; ↗</span>
        </div>
        {clients.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>CLIENT</th><th>SERVICES</th><th>MONTHLY</th><th>OPEN WORK</th><th>STATUS</th><th /></tr></thead>
              <tbody>
                {clients.map((client) => {
                  const services = client.client_services ?? [];
                  const openWork = services.flatMap((service) => service.deliverables ?? []).filter((item) => item.pipeline_status !== "Published").length;
                  const retainer = services.filter((service) => service.status === "Active").reduce((sum, service) => sum + Number(service.monthly_retainer), 0);
                  return (
                    <tr key={client.id}>
                      <td>
                        <button className="client-name-link" onClick={() => setSelectedClientId(client.id)} type="button">
                          <span className="client-avatar">{client.company_name.slice(0, 1).toUpperCase()}</span>
                          <span className="client-cell"><strong>{client.company_name}</strong><span>{client.name}</span></span>
                        </button>
                      </td>
                      <td><span className="service-count">{services.length.toString().padStart(2, "0")}</span><span className="cell-secondary"> service{services.length === 1 ? "" : "s"}</span></td>
                      <td className="mono-cell">{formatCurrency(retainer)}</td>
                      <td><span className="open-work-count">{openWork.toString().padStart(2, "0")}</span></td>
                      <td><Status>{client.status}</Status></td>
                      <td><button aria-label={`Open ${client.company_name} details`} className="row-arrow" onClick={() => setSelectedClientId(client.id)} type="button">↗</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><span className="empty-icon">◉</span><strong>Your client list starts here.</strong><p>Add your first client to bring services, deliverables, and billing into one place.</p></div>
        )}
      </section>
      {selectedClient ? <ClientDrawer client={selectedClient} onClose={() => setSelectedClientId(null)} /> : null}
    </>
  );
}
