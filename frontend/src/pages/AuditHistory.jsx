import { useEffect, useState } from 'react';
import { AUDIT_MONITOR_KEY, validateAuditLog } from '../utils/wmsAudit';
import '../styles/OverviewSettings.css';

const fieldLabel = key => ({ id: 'ID', sku: 'SKU', code: 'Location Code', name: 'Name', quantity: 'Quantity', reserved: 'Reserved quantity', basket: 'Load', loadType: 'Load type', status: 'Status' }[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase()));
const formatValue = value => value == null ? 'Not present' : typeof value === 'object' ? JSON.stringify(value) : String(value);
function changedFields(change) {
  const before = change.before || {}, after = change.after || {};
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map(key => ({ key, before: before[key], after: after[key] }));
}
export default function AuditHistory() {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  function refresh() {
    try {
      const data = JSON.parse(localStorage.getItem(AUDIT_MONITOR_KEY) || 'null');
      if (!data || !Array.isArray(data.racks)) throw new Error('No warehouse data found. Open Monitor first.');
      validateAuditLog(data.auditLog);
      setRecords((data.auditLog || []).slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
      setError('');
    } catch (error) { setRecords([]); setError(error.message); }
  }
  useEffect(() => {
    refresh();
    const events = ['storage', 'focus', 'wms-monitor-data-changed', 'wms-data-changed'];
    events.forEach(name => window.addEventListener(name, refresh));
    return () => events.forEach(name => window.removeEventListener(name, refresh));
  }, []);
  const invalidRange = from && to && from > to;
  const filtered = records.filter(record => {
    const d = new Date(record.createdAt);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return !invalidRange && (!from || day >= from) && (!to || day <= to) && JSON.stringify(record).toLowerCase().includes(search.toLowerCase());
  });
  return <div className="page wms-overview">
    <div className="page-header"><div><span className="page-label">WAREHOUSE RECORDS</span><h2>Audit History</h2><p>Review who recorded a change, when it happened, why it was made and the values before and after.</p></div></div>
    <section className="panel overview-section">
      <p>New changes are recorded from this version onward. Earlier operation history remains in Warehouse Operations. Operator names are entered manually; this browser-based history is not a secure or tamper-proof audit system. System records identify automatic transfer reconciliation. Audit records are included in WMS backups.</p>
      <div className="overview-form"><label>Search<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Operator, SKU, Load, location, action or reason" /></label><label>From date<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>To date<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div>
      <div className="overview-actions"><button type="button" className="settings-secondary" onClick={refresh}>Refresh</button></div>
      {error && <p role="alert">{error}</p>}
      {invalidRange && <p role="alert">From date must be on or before To date.</p>}
      {!error && <p role="status">{filtered.length} of {records.length} records</p>}
    </section>
    {!error && !filtered.length && <section className="panel overview-section"><p>{records.length ? 'No records match these filters.' : 'No audit records yet. New warehouse changes will appear here.'}</p></section>}
    {filtered.map(record => <section key={record.id} className="panel overview-section">
      <h3>{record.action.replaceAll('_', ' ')}</h3>
      <p>{new Date(record.createdAt).toLocaleString('en-GB')} · Operator: {record.actor}<br />Reason: {record.reason}<br />Record: {record.id}</p>
      <details><summary>View before / after ({record.changes.length} changes)</summary>
        {record.changes.map((change, index) => <div key={index} className="audit-change">
          <h4>{change.entity.replaceAll('_', ' ')} · {change.position}</h4>
          {change.previousPosition && change.previousPosition !== change.position && <p>Previous location: {change.previousPosition}</p>}
          <div style={{ overflowX: 'auto' }}><table className="consistency-table"><thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead><tbody>{changedFields(change).map(field => <tr key={field.key}><th scope="row">{fieldLabel(field.key)}</th><td>{formatValue(field.before)}</td><td>{formatValue(field.after)}</td></tr>)}</tbody></table></div>
        </div>)}
      </details>
    </section>)}
  </div>;
}
