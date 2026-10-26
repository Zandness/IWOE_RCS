import { useEffect, useMemo, useState } from 'react';
import { buildReport, downloadReportCsv, filterReport, inventoryTotals, readReportSnapshot, REPORT_COLUMNS } from '../utils/wmsReports';
import '../styles/OverviewSettings.css';
import '../styles/Reports.css';

const labels = { INVENTORY: 'Stock on Hand', MOVEMENTS: 'Stock Movements', PENDING: 'Pending Work' };
const pageSize = 50;
export default function Reports() {
  const [snapshot, setSnapshot] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [type, setType] = useState('INVENTORY');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [stale, setStale] = useState(false);
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(0);
  function refresh() {
    try { setSnapshot(readReportSnapshot()); setLoadError(''); setStale(false); setNotice(''); setPage(0); }
    catch (error) { setSnapshot(null); setLoadError(error.message); }
  }
  useEffect(() => {
    refresh();
    const changed = () => setStale(true);
    const names = ['storage', 'focus', 'wms-monitor-data-changed', 'wms-data-changed'];
    names.forEach(name => window.addEventListener(name, changed));
    return () => names.forEach(name => window.removeEventListener(name, changed));
  }, []);
  const result = useMemo(() => {
    if (!snapshot) return { rows: [], all: [], error: '' };
    try {
      const all = buildReport(snapshot, type);
      return { all, rows: filterReport(all, { type, search, from: type === 'INVENTORY' ? '' : from, to: type === 'INVENTORY' ? '' : to }), error: '' };
    } catch (error) { return { rows: [], all: [], error: error.message }; }
  }, [snapshot, type, search, from, to]);
  const error = loadError || result.error;
  const columns = REPORT_COLUMNS[type];
  const currentPage = Math.min(page, Math.max(0, Math.ceil(result.rows.length / pageSize) - 1));
  const visible = result.rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const undated = result.all.filter(row => !row.createdAt).length;
  function exportCsv() {
    try {
      downloadReportCsv(result.rows, columns, `wms-${type.toLowerCase()}-${new Date(snapshot.capturedAt).toISOString().replace(/[:.]/g, '-')}.csv`);
      setNotice(`CSV download requested for all ${result.rows.length} filtered rows.`);
    } catch (error) { setNotice(`Export failed: ${error.message}`); }
  }
  function cell(row, key) {
    if (key === 'createdAt') return row[key] ? new Date(row[key]).toLocaleString('en-GB') : 'Not recorded';
    return row[key] === '' || row[key] == null ? '—' : typeof row[key] === 'number' ? row[key].toLocaleString('en-GB', { maximumFractionDigits: 12 }) : String(row[key]);
  }
  return <div className="page wms-overview reports-page">
    <div className="page-header"><div><span className="page-label">WAREHOUSE REPORTING</span><h2>Reports &amp; CSV Export</h2><p>Review stock, recorded movements and pending work. Export the filtered results as a CSV file that opens in Excel.</p></div></div>
    <section className="panel overview-section">
      <div className="overview-actions">{Object.entries(labels).map(([key, label]) => <button key={key} type="button" className={type === key ? 'primary-button' : 'settings-secondary'} aria-pressed={type === key} onClick={() => { setType(key); setPage(0); setNotice(''); }}>{label}</button>)}</div>
      <div className="overview-form reports-filters"><label>Search<input value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="SKU, location, Load, reference or operator" /></label>{type !== 'INVENTORY' && <><label>From date<input type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(0); }} /></label><label>To date<input type="date" value={to} onChange={event => { setTo(event.target.value); setPage(0); }} /></label></>}</div>
      {type === 'INVENTORY' && <p>Current snapshot only; this is not a historical stock balance. Totals are grouped by unit. Date filters apply to Stock Movements and Pending Work.</p>}
      {type === 'MOVEMENTS' && <p>Stock and reservation changes recorded by Audit History from its installation onward. Earlier operation records remain in Warehouse Operations; they are not reconstructed here. A Load transfer can show an outgoing and an incoming inventory row.</p>}
      {type === 'PENDING' && <p>Shows open document lines, picking operations, draft stock counts, unresolved transfers and previous-version warehouse tasks. Rows are separate work items; their quantities must not be added as a single stock total. Date filters use the work item’s creation date.</p>}
      {type !== 'INVENTORY' && <p>Date filters use your browser’s time zone and include both boundary dates. CSV timestamps are UTC.{undated > 0 && ` ${undated} undated work items are included without date filters and excluded when a date filter is active.`}</p>}
      {snapshot && <p>Snapshot: {new Date(snapshot.capturedAt).toLocaleString('en-GB')} · Read-only browser data; no RCS commands are sent.</p>}
      <div className="overview-actions"><button type="button" className="settings-secondary" onClick={refresh}>Refresh data</button><button type="button" className="primary-button" disabled={!snapshot || !!error || stale || !result.rows.length} onClick={exportCsv}>Export filtered CSV ({result.rows.length})</button></div>
      {stale && <p role="status">Data may have changed. Refresh data before exporting.</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {type === 'INVENTORY' && result.rows.some(row => row.available < 0) && <p role="alert">Negative availability found. Run the WMS consistency check and review reservations.</p>}
    </section>
    {!error && snapshot && <>
      {type === 'INVENTORY' && result.rows.length > 0 && <section className="panel overview-section"><h3>Filtered totals by unit</h3><div className="reports-scroll"><table className="consistency-table"><thead><tr><th scope="col">Unit</th><th scope="col">On hand</th><th scope="col">Reserved</th><th scope="col">Available</th></tr></thead><tbody>{inventoryTotals(result.rows).map(total => <tr key={total.unit}><th scope="row">{total.unit}</th><td>{cell(total, 'quantity')}</td><td>{cell(total, 'reserved')}</td><td>{cell(total, 'available')}</td></tr>)}</tbody></table></div></section>}
      <section className="panel overview-section"><h3>{labels[type]}</h3>
        <p role="status">{result.rows.length ? `Showing ${currentPage * pageSize + 1}–${currentPage * pageSize + visible.length} of ${result.rows.length} filtered rows. CSV includes all filtered rows.` : 'No rows match this report and its filters.'}</p>
        <div className="reports-scroll"><table className="consistency-table reports-table"><thead><tr>{columns.map(col => <th key={col.key} scope="col">{col.key === 'createdAt' ? type === 'MOVEMENTS' ? 'Recorded at (local)' : 'Created at (local)' : col.label}</th>)}</tr></thead><tbody>{visible.map(row => <tr key={row.id}>{columns.map(col => <td key={col.key}>{cell(row, col.key)}</td>)}</tr>)}</tbody></table></div>
        {result.rows.length > pageSize && <div className="overview-actions"><button type="button" className="settings-secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {Math.ceil(result.rows.length / pageSize)}</span><button type="button" className="settings-secondary" disabled={(currentPage + 1) * pageSize >= result.rows.length} onClick={() => setPage(currentPage + 1)}>Next</button></div>}
      </section>
    </>}
  </div>;
}
