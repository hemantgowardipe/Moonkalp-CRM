import Skeleton from "react-loading-skeleton";
import Icon from "@/components/Icon";
import SettingsSectionHeader from "@/components/SettingsSectionHeader";
import { AUDIT_FILTER_ENTITIES, settingsSectionsFor, settingsSubtitle } from "@/lib/settingsSections.mjs";
import { describeAuditEntity } from "@/lib/settingsRules.mjs";

/*
 * Loading placeholders for workspace pages and settings sections.
 *
 * The shimmering bones are react-loading-skeleton
 * (https://github.com/dvtng/react-loading-skeleton, MIT), themed in
 * globals.css. Each screen reuses the real page's layout classes, so the
 * placeholder occupies the same space as the content that replaces it, and
 * anything static (titles, tabs, field groups) is shown for real. A text bone
 * inherits the font size of where it sits, so it matches that line.
 */

/** A line of text; takes the font size and line height of its parent. */
function Text({ width = "100%" }) {
  return <Skeleton width={width} />;
}

/** A fixed-size shape: an input, button, avatar or card. */
function Shape({ width = "100%", height, radius = "var(--radius)" }) {
  return <Skeleton borderRadius={radius} containerClassName="skeleton-shape" height={height} inline width={width} />;
}

function Screen({ label, layout = "block", children }) {
  return (
    <div aria-busy="true" className="skeleton-screen">
      <span className="visually-hidden" role="status">{label}</span>
      <div aria-hidden="true" className={`skeleton-body skeleton-body-${layout}`}>
        {children}
      </div>
    </div>
  );
}

function repeat(count, render) {
  return Array.from({ length: count }, (_, index) => render(index));
}

function Field({ hint = false }) {
  return (
    <div className="field">
      <span className="skeleton-label"><Text width={96} /></span>
      <Shape height="var(--control-h)" />
      {hint ? <p className="field-hint"><Text width="55%" /></p> : null}
    </div>
  );
}

function SubmitButton({ width = 128, start = false }) {
  return (
    <div className={start ? "form-actions form-actions-start" : "form-actions"}>
      <Shape height="var(--control-h)" width={width} />
    </div>
  );
}

function Timeline({ count = 5 }) {
  return (
    <div className="timeline">
      {repeat(count, (index) => (
        <div className="timeline-item" key={index}>
          <span className="timeline-dot" />
          <div className="timeline-body skeleton-grow">
            <p><Text width={index % 2 ? "48%" : "62%"} /></p>
            <p className="skeleton-meta"><Text width={140} /></p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditFilters() {
  return (
    <div className="filter-chips">
      <span aria-current="true" className="filter-chip">All</span>
      {AUDIT_FILTER_ENTITIES.map((entity) => (
        <span className="filter-chip" key={entity}>{describeAuditEntity(entity)}</span>
      ))}
    </div>
  );
}

// Plain render functions (no hooks), keyed by settings section.
const SECTION_BONES = {
  profile: () => (
    <div className="settings-card">
      <div className="settings-form">
        <Field hint />
        <Field hint />
        <SubmitButton width={120} />
      </div>
    </div>
  ),
  appearance: () => (
    <div className="settings-card">
      <div className="settings-form">
        <div className="choice-group">
          <p className="skeleton-legend">Theme</p>
          <div className="theme-grid">
            {repeat(3, (index) => <Shape height="var(--skeleton-theme-option-h)" key={index} radius="var(--radius-lg)" />)}
          </div>
        </div>
        <div className="choice-group">
          <p className="skeleton-legend">Density</p>
          <div className="radio-list">
            {repeat(2, (index) => (
              <div className="skeleton-radio-row" key={index}>
                <Shape height={16} radius="50%" width={16} />
                <span className="skeleton-grow">
                  <span className="skeleton-strong"><Text width={index ? 80 : 110} /></span>
                  <span className="skeleton-hint"><Text width={index ? 140 : 210} /></span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  ),
  security: () => (
    <>
      <div className="settings-card">
        <h3 className="settings-subheading">Change password</h3>
        <div className="settings-form">
          <Field />
          <div className="field-row">
            <Field />
            <Field />
          </div>
          <p className="field-hint"><Text width="60%" /></p>
          <SubmitButton width={150} />
        </div>
      </div>
      <div className="settings-card">
        <h3 className="settings-subheading">Sessions</h3>
        <p className="settings-text"><Text width="92%" /><Text width="64%" /></p>
        <SubmitButton start width={200} />
      </div>
    </>
  ),
  organization: () => (
    <div className="settings-card">
      <div className="settings-form">
        <Field hint />
        <div className="field-row">
          <Field />
          <Field />
        </div>
        <Field />
        <h3 className="settings-subheading">Service levels</h3>
        <div className="field-row">
          <Field hint />
          <Field hint />
        </div>
        <SubmitButton width={150} />
      </div>
    </div>
  ),
  team: () => (
    <>
      <div className="list-box">
        {repeat(3, (index) => (
          <div className="member-row" key={index}>
            <Shape height={32} width={32} />
            <div className="member-main">
              <strong><Text width={index % 2 ? "42%" : "34%"} /></strong>
              <span><Text width={index % 2 ? "52%" : "60%"} /></span>
            </div>
            <Shape height={22} radius="var(--radius-sm)" width={72} />
          </div>
        ))}
      </div>
      <Shape height={66} radius="var(--radius-lg)" />
    </>
  ),
  audit: () => (
    <>
      <AuditFilters />
      <Timeline />
    </>
  ),
};

function renderSectionBones(section) {
  return (SECTION_BONES[section] ?? SECTION_BONES.profile)();
}

/** Body of one settings section, shown under its (real) section header. */
export function SettingsSectionSkeleton({ section }) {
  return (
    <Screen label="Loading section" layout="stack">
      {renderSectionBones(section)}
    </Screen>
  );
}

/** Audit timeline only, for filter and paging changes inside the audit log. */
export function AuditTimelineSkeleton() {
  return (
    <Screen label="Loading audit log">
      <Timeline />
    </Screen>
  );
}

/**
 * The Settings page while it loads. Its title, section tabs and the first
 * section's header are static, so they show for real; only data is a bone.
 */
export function SettingsPageSkeleton({ role }) {
  const sections = settingsSectionsFor(role);
  const [first] = sections;

  return (
    <Screen label="Loading settings">
      <div className="page">
        <header className="page-header page-header-compact">
          <div>
            <h1>Settings</h1>
            <p className="page-subtitle">{settingsSubtitle(role)}</p>
          </div>
        </header>
        <div className="settings-layout">
          <div className="settings-nav">
            {sections.map((section) => (
              <span aria-current={section.key === first.key ? "page" : undefined} className="settings-nav-link" key={section.key}>
                <Icon name={section.icon} size={18} />
                <span>{section.label}</span>
              </span>
            ))}
          </div>
          <div className="settings-content">
            <SettingsSectionHeader description={first.description} title={first.label} />
            <div className="skeleton-body-stack">{renderSectionBones(first.key)}</div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

function PageHeading({ title = 280, subtitle = 300, action = false }) {
  return (
    <header className="page-header">
      <div className="skeleton-grow">
        <p className="eyebrow"><Text width={170} /></p>
        <h1><Text width={title} /></h1>
        <p className="page-subtitle"><Text width={subtitle} /></p>
      </div>
      {action ? <div className="header-actions"><Shape height="var(--control-h)" width={128} /></div> : null}
    </header>
  );
}

/** Agency overview (admin/dashboard). */
export function DashboardSkeleton() {
  return (
    <Screen label="Loading overview">
      <div className="page">
        <PageHeading action />
        <div className="metric-grid">
          {repeat(4, (index) => (
            <div className="metric-card" key={index}>
              <span className="metric-icon"><Shape height={20} width={20} /></span>
              <span className="metric-label"><Text width="68%" /></span>
              <strong className="metric-value"><Text width="52%" /></strong>
              <span className="metric-caption"><Text width="78%" /></span>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panel-heading">
            <div className="skeleton-grow">
              <h2><Text width={150} /></h2>
              <p className="panel-subtitle"><Text width="min(320px, 80%)" /></p>
            </div>
            <Shape height={36} width="min(280px, 100%)" />
          </div>
          {repeat(5, (index) => (
            <div className="skeleton-panel-row" key={index}>
              <span className="skeleton-grow"><Text width={index % 2 ? "38%" : "46%"} /></span>
              <Shape height={22} radius="var(--radius-sm)" width={84} />
              <span className="skeleton-panel-cell"><Text width={64} /></span>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

/** Client home (client/portal). */
export function PortalSkeleton() {
  return (
    <Screen label="Loading your portal">
      <div className="page page-narrow">
        <PageHeading subtitle={340} title={240} />
        <div className="summary-grid">
          {repeat(3, (index) => (
            <div className="summary-card" key={index}>
              <span className="summary-label"><Text width="60%" /></span>
              <strong><Text width="45%" /></strong>
            </div>
          ))}
        </div>
        <div className="portal-section">
          <div className="section-heading">
            <h2 className="skeleton-grow"><Text width={180} /></h2>
          </div>
          <div className="card-list">
            {repeat(2, (index) => <Shape height={112} key={index} radius="var(--radius-lg)" />)}
          </div>
        </div>
      </div>
    </Screen>
  );
}
