export default function AuditFields({ value, onChange }) {
  return <div className="overview-form audit-fields">
    <label>Operator name<input value={value.actor} onChange={event => onChange({ ...value, actor: event.target.value })} /></label>
    <label>Reason for change<input value={value.reason} onChange={event => onChange({ ...value, reason: event.target.value })} /></label>
    <p>Required when saving warehouse changes. Names are entered manually; they are not authenticated user identities.</p>
  </div>;
}