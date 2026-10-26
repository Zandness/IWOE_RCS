import { useEffect, useState } from 'react';
import { checkWmsConsistency } from '../utils/wmsConsistency';

export default function WmsConsistencyPanel() {
  const [result, setResult] = useState(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const changed = () => setStale(true);
    const events = ['storage', 'focus', 'wms-data-changed', 'wms-monitor-data-changed'];
    events.forEach(name => window.addEventListener(name, changed));
    return () => events.forEach(name => window.removeEventListener(name, changed));
  }, []);
  function check() {
    try {
      setResult(checkWmsConsistency());
      setStale(false);
      setError('');
    } catch {
      setResult(null);
      setError('The check could not be completed. Check browser storage access and try again.');
    }
  }
  return <section className="panel overview-section">
    <h3>WMS Data Consistency Check</h3>
    <p>Check for duplicate Location Codes and Load IDs, reservations exceeding stock, stock without a Load, and tasks referencing missing locations. This check only reads data saved in this browser. It does not change or delete any data.</p>
    <div className="overview-actions"><button type="button" className="primary-button" onClick={check}>Check data</button></div>
    {error && <p role="alert">{error}</p>}
    {result && <>
      <p role="status">Checked: {new Date(result.checkedAt).toLocaleString('en-GB')} · Locations checked: {result.locationsChecked} · {result.issues.length ? `Issues requiring review: ${result.issues.length}` : 'No issues found for the checks performed.'}</p>
      {stale && <p role="status">Data may have changed since this check. Select Check data to refresh the results.</p>}
      {result.issues.length > 0 && <div style={{ overflowX: 'auto' }}><table className="consistency-table">
        <thead><tr><th scope="col">Issue</th><th scope="col">Location / Related task</th></tr></thead>
        <tbody>{result.issues.map((issue, index) => <tr key={index}><td>{issue.message}</td><td>{issue.position}</td></tr>)}</tbody>
      </table></div>}
    </>}
  </section>;
}
