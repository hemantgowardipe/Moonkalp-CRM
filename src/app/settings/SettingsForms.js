"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwordPolicy.mjs";
import {
  changePassword,
  signOutOtherSessions,
  updateAppearance,
  updateOrganization,
  updateProfile,
} from "./actions";

const initialState = { error: "", success: false, message: "" };

function useSettingsAction(serverAction, { resetOnSuccess = false } = {}) {
  const [state, action, pending] = useActionState(serverAction, initialState);
  const formRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!state.success) return;
    if (resetOnSuccess) formRef.current?.reset();
    router.refresh();
  }, [resetOnSuccess, router, state]);

  return { state, action, pending, formRef };
}

function Feedback({ state }) {
  if (state.error) return <p className="form-error" role="alert">{state.error}</p>;
  if (state.success && state.message) {
    return <p aria-live="polite" className="form-success"><Icon name="check" size={16} /> {state.message}</p>;
  }
  return null;
}

export function ProfileForm({ profile }) {
  const { state, action, pending } = useSettingsAction(updateProfile);

  return (
    <form action={action} className="settings-form">
      <div className="field">
        <label htmlFor="full_name">Name</label>
        <input autoComplete="name" defaultValue={profile.full_name} id="full_name" maxLength={80} name="full_name" required />
        <p className="field-hint">Shown to your team{profile.role === "client" ? " and your agency" : ""}.</p>
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input defaultValue={profile.email} id="email" readOnly type="email" />
        <p className="field-hint">Your sign-in email. Contact {profile.role === "client" ? "your agency" : "an admin"} to change it.</p>
      </div>
      <Feedback state={state} />
      <div className="form-actions">
        <button className="button button-primary" disabled={pending}>{pending ? "Saving..." : "Save profile"}</button>
      </div>
    </form>
  );
}

const THEME_OPTIONS = [
  { value: "system", label: "System", icon: "monitor", hint: "Match this device" },
  { value: "light", label: "Light", icon: "sun", hint: "Bright and clear" },
  { value: "dark", label: "Dark", icon: "moon", hint: "Easy on the eyes" },
];

const DENSITY_OPTIONS = [
  { value: "comfortable", label: "Comfortable", hint: "More space, larger touch targets" },
  { value: "compact", label: "Compact", hint: "Fit more on screen" },
];

export function AppearanceForm({ preferences }) {
  const { state, action, pending, formRef } = useSettingsAction(updateAppearance);

  // Preview immediately, then save. GitHub and Google apply appearance
  // changes as soon as they are picked rather than waiting for a Save button.
  function handleChange(event) {
    const { name, value } = event.target;
    const root = document.documentElement;
    if (name === "theme") {
      if (value === "system") delete root.dataset.theme;
      else root.dataset.theme = value;
    }
    if (name === "density") root.dataset.density = value;
    formRef.current?.requestSubmit();
  }

  return (
    <form action={action} className="settings-form" onChange={handleChange} ref={formRef}>
      <fieldset className="choice-group" disabled={pending}>
        <legend>Theme</legend>
        <div className="theme-grid">
          {THEME_OPTIONS.map((option) => (
            <label className="theme-option" key={option.value}>
              <input defaultChecked={preferences.theme === option.value} name="theme" type="radio" value={option.value} />
              <span className={`theme-preview theme-preview-${option.value}`} aria-hidden="true">
                <span className="theme-preview-bar" />
                <span className="theme-preview-line" />
                <span className="theme-preview-line short" />
              </span>
              <span className="theme-option-label"><Icon name={option.icon} size={18} /> {option.label}</span>
              <span className="theme-option-hint">{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="choice-group" disabled={pending}>
        <legend>Density</legend>
        <div className="radio-list">
          {DENSITY_OPTIONS.map((option) => (
            <label className="radio-row" key={option.value}>
              <input defaultChecked={preferences.density === option.value} name="density" type="radio" value={option.value} />
              <span>
                <strong>{option.label}</strong>
                <span>{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Feedback state={state} />
      <noscript><button className="button button-primary">Save appearance</button></noscript>
    </form>
  );
}

export function PasswordChangeForm() {
  const { state, action, pending, formRef } = useSettingsAction(changePassword, { resetOnSuccess: true });

  return (
    <form action={action} className="settings-form" ref={formRef}>
      <div className="field">
        <label htmlFor="current_password">Current password</label>
        <input autoComplete="current-password" id="current_password" name="current_password" required type="password" />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="new_password">New password</label>
          <input autoComplete="new-password" id="new_password" minLength={PASSWORD_MIN_LENGTH} name="password" required type="password" />
        </div>
        <div className="field">
          <label htmlFor="confirm_password">Confirm new password</label>
          <input autoComplete="new-password" id="confirm_password" minLength={PASSWORD_MIN_LENGTH} name="confirm_password" required type="password" />
        </div>
      </div>
      <p className="field-hint">At least {PASSWORD_MIN_LENGTH} characters. Changing it signs out your other devices.</p>
      <Feedback state={state} />
      <div className="form-actions">
        <button className="button button-primary" disabled={pending}>{pending ? "Updating..." : "Update password"}</button>
      </div>
    </form>
  );
}

export function SignOutOthersForm() {
  const { state, action, pending } = useSettingsAction(signOutOtherSessions);

  return (
    <form action={action} className="settings-form">
      <Feedback state={state} />
      <div className="form-actions form-actions-start">
        <button className="button button-secondary" disabled={pending}>
          {pending ? "Signing out..." : "Sign out all other devices"}
        </button>
      </div>
    </form>
  );
}

export function OrganizationForm({ organization, canEdit }) {
  const { state, action, pending } = useSettingsAction(updateOrganization);

  return (
    <form action={action} className="settings-form">
      <fieldset className="plain-fieldset" disabled={!canEdit || pending}>
        <div className="field">
          <label htmlFor="agency_name">Agency name</label>
          <input defaultValue={organization.agency_name} id="agency_name" maxLength={80} name="agency_name" required />
          <p className="field-hint">Shown in the sidebar and to clients in their portal.</p>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="support_email">Support email <span className="optional-label">Optional</span></label>
            <input autoComplete="email" defaultValue={organization.support_email ?? ""} id="support_email" name="support_email" type="email" />
          </div>
          <div className="field">
            <label htmlFor="support_phone">Support phone <span className="optional-label">Optional</span></label>
            <input autoComplete="tel" defaultValue={organization.support_phone ?? ""} id="support_phone" maxLength={30} name="support_phone" type="tel" />
          </div>
        </div>
        <p className="field-hint">Clients see these as “Email us” and “Call us” buttons in their portal.</p>
        <div className="field">
          <label htmlFor="website_url">Website <span className="optional-label">Optional</span></label>
          <input defaultValue={organization.website_url ?? ""} id="website_url" maxLength={200} name="website_url" placeholder="https://" type="url" />
        </div>

        <h3 className="settings-subheading">Service levels</h3>
        <div className="field-row">
          <div className="field">
            <label htmlFor="payment_terms_days">Payment terms (days)</label>
            <input defaultValue={organization.payment_terms_days} id="payment_terms_days" inputMode="numeric" max={120} min={0} name="payment_terms_days" required type="number" />
            <p className="field-hint">Default due date for new invoices.</p>
          </div>
          <div className="field">
            <label htmlFor="revision_turnaround_days">Revision turnaround (business days)</label>
            <input defaultValue={organization.revision_turnaround_days} id="revision_turnaround_days" inputMode="numeric" max={30} min={1} name="revision_turnaround_days" required type="number" />
            <p className="field-hint">Your promised response time, shown to clients when they review work.</p>
          </div>
        </div>
      </fieldset>
      <Feedback state={state} />
      {canEdit ? (
        <div className="form-actions">
          <button className="button button-primary" disabled={pending}>{pending ? "Saving..." : "Save organization"}</button>
        </div>
      ) : (
        <p className="field-hint">Only admins can change organization settings.</p>
      )}
    </form>
  );
}
