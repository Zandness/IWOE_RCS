import { useEffect } from "react";
import { authenticatedUser } from "../utils/wmsAuth";
import { canEditWarehouse } from "../utils/browserSession";
export default function AuditFields({ value, onChange }) {
  const user = authenticatedUser();
  useEffect(() => { if (user && value.actor !== user.username) onChange({ ...value, actor: user.username }); }, [user?.id, value.actor]);
  return <div className="overview-form audit-fields">
    <label>Operator name<input value={value.actor} readOnly={!!user} onChange={event => onChange({ ...value, actor: event.target.value })} /></label>
    <label>Reason for change<input value={value.reason} disabled={!canEditWarehouse()} onChange={event => onChange({ ...value, reason: event.target.value })} /></label>
    <p>The signed-in account is recorded for app changes. Warehouse data and history remain in this browser and can be edited outside the app.</p>
  </div>;
}