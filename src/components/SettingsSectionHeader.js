export default function SettingsSectionHeader({ title, description }) {
  return (
    <header className="settings-header">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </header>
  );
}
