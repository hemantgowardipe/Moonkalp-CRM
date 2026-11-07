export const CLIENT_STATUSES = ["Active", "Paused", "Churned"];
export const SERVICE_TYPES = ["Social Media", "Website Management"];
export const SERVICE_STATUSES = ["Active", "Paused", "Ended"];
export const DELIVERABLE_CATEGORIES = ["Reel", "Post", "Website Fix"];
export const PIPELINE_STATUSES = ["Drafting", "Pending Approval", "Scheduled", "Published"];
export const PAYMENT_STATUSES = ["Pending", "Overdue", "Paid"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData, name) {
  return String(formData.get(name) ?? "").trim();
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

export function isUuid(value) {
  return UUID_PATTERN.test(value);
}

export function todayIsoDate(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function parseClientForm(formData) {
  const name = text(formData, "name");
  const companyName = text(formData, "company_name");
  const email = text(formData, "email").toLowerCase();
  const phone = text(formData, "phone");
  const status = text(formData, "status") || "Active";

  if (!name || !companyName || !email) {
    return { error: "Contact name, company name, and email are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!CLIENT_STATUSES.includes(status)) return { error: "Choose a client status." };

  return {
    values: {
      name,
      company_name: companyName,
      email,
      phone: phone || null,
      status,
    },
  };
}

export function parseServiceForm(formData) {
  const clientId = text(formData, "client_id");
  const serviceType = text(formData, "service_type");
  const status = text(formData, "status") || "Active";
  const retainer = Number(text(formData, "monthly_retainer"));
  const startDate = text(formData, "start_date");
  const renewalDate = text(formData, "renewal_date");

  if (!isUuid(clientId)) return { error: "Select a valid client record." };
  if (!SERVICE_TYPES.includes(serviceType)) return { error: "Choose a service type." };
  if (!SERVICE_STATUSES.includes(status)) return { error: "Choose a service status." };
  if (!Number.isFinite(retainer) || retainer < 0) {
    return { error: "Monthly retainer must be zero or a positive amount." };
  }
  if (!isDate(startDate)) return { error: "Enter a valid start date." };
  if (renewalDate && !isDate(renewalDate)) return { error: "Enter a valid renewal date." };
  if (renewalDate && renewalDate < startDate) {
    return { error: "Renewal date cannot be before the start date." };
  }

  return {
    values: {
      client_id: clientId,
      service_type: serviceType,
      monthly_retainer: retainer,
      start_date: startDate,
      renewal_date: renewalDate || null,
      status,
    },
  };
}

export function parseDeliverableForm(formData) {
  const serviceId = text(formData, "service_id");
  const title = text(formData, "title");
  const category = text(formData, "category");
  const pipelineStatus = text(formData, "pipeline_status") || "Drafting";
  const dueDate = text(formData, "due_date");

  if (!isUuid(serviceId)) return { error: "Choose the service this deliverable belongs to." };
  if (!title) return { error: "Enter a title for the deliverable." };
  if (title.length > 200) return { error: "Title must be 200 characters or fewer." };
  if (!DELIVERABLE_CATEGORIES.includes(category)) return { error: "Choose a category." };
  if (!PIPELINE_STATUSES.includes(pipelineStatus)) return { error: "Choose a pipeline stage." };
  if (dueDate && !isDate(dueDate)) return { error: "Enter a valid due date." };

  return {
    values: {
      service_id: serviceId,
      title,
      category,
      pipeline_status: pipelineStatus,
      due_date: dueDate || null,
    },
  };
}

export function parsePaymentForm(formData, now = new Date()) {
  const clientId = text(formData, "client_id");
  const amount = Number(text(formData, "amount"));
  const paymentStatus = text(formData, "payment_status") || "Pending";
  const dueDate = text(formData, "due_date");
  const paidDate = text(formData, "paid_date");
  const transactionRef = text(formData, "transaction_ref");

  if (!isUuid(clientId)) return { error: "Select a valid client record." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Amount must be greater than zero." };
  if (!PAYMENT_STATUSES.includes(paymentStatus)) return { error: "Choose a payment status." };
  if (!isDate(dueDate)) return { error: "Enter a valid due date." };
  if (paidDate && !isDate(paidDate)) return { error: "Enter a valid paid date." };
  if (transactionRef.length > 120) return { error: "Reference must be 120 characters or fewer." };

  return {
    values: {
      client_id: clientId,
      amount,
      payment_status: paymentStatus,
      due_date: dueDate,
      // The database requires a paid date exactly when the invoice is paid.
      paid_date: paymentStatus === "Paid" ? paidDate || todayIsoDate(now) : null,
      transaction_ref: transactionRef || null,
    },
  };
}
