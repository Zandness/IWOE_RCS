import { canEditWarehouse } from "../utils/browserSession";
import { useEffect, useState } from 'react';
import { readStockCountData, startStockCount, updateStockCount } from '../utils/stockCount';
import '../styles/OverviewSettings.css';

const statusLabel = { DRAFT: 'Draft', COMPLETED: 'Confirmed', CANCELLED: 'Cancelled' };
const date = value => new Date(value).toLocaleString('en-GB');
export default function StockCount() {
  const [data, setData] = useState(null);
  const [location, setLocation] = useState('');
  const [selected, setSelected] = useState('');
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState(null);
  const [stale, setStale] = useState(false);
  const [dirty, setDirty] = useState(false);
  function load() {
    try { setData(readStockCountData()); setStale(false); }
    catch (error) { setData(null); setNotice({ error: true, text: error.message }); }
  }
  useEffect(() => {
    load();
    const changed = () => setStale(true);
    const names = ['storage', 'focus', 'wms-monitor-data-changed', 'wms-data-changed'];
    names.forEach(name => window.addEventListener(name, changed));
    return () => names.forEach(name => window.removeEventListener(name, changed));
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const counts = data?.stockCounts || [];
  const current = counts.find(count => count.id === selected);
  const editable = current?.status === 'DRAFT';
  function open(count) {
    setSelected(count?.id || '');
    setDraft(count ? { operator: count.operator, reason: count.reason, counted: count.lines.map(line => line.counted) } : null);
    setDirty(false);
  }
  function change(value) { setDraft(value); setDirty(true); }
  function canLeave() { return !dirty || window.confirm('Discard unsaved count entries?'); }
  function notify() { window.dispatchEvent(new CustomEvent('wms-monitor-data-changed')); }
  async function start() {
    if (!canLeave()) return;
    try {
      const [rackId, shelfId] = JSON.parse(location);
      const id = await startStockCount(rackId, shelfId);
      notify();
      const next = readStockCountData();
      setData(next); open(next.stockCounts.find(count => count.id === id)); setStale(false);
      setNotice({ text: 'Count created. Stock has not changed.' });
    } catch (error) { setNotice({ error: true, text: error.message }); }
  }
  async function act(action) {
    if (action === 'CONFIRM' && !window.confirm('Confirm the physical count and adjust stock? Reserved quantities and the Load will remain unchanged.')) return;
    if (action === 'CANCEL' && !window.confirm('Cancel this count? Stock will not change.')) return;
    try {
      const next = await updateStockCount(selected, draft, action);
      notify(); setData(next); open(next.stockCounts.find(count => count.id === selected)); setStale(false);
      setNotice({ text: action === 'CONFIRM' ? 'Stock adjusted. Before/after quantities, counter and reason saved.' : action === 'CANCEL' ? 'Count cancelled. Stock has not changed.' : 'Draft saved. Stock has not changed.' });
    } catch (error) { setNotice({ error: true, text: error.message }); }
  }
  return <div className="page wms-overview">
    <div className="page-header"><div><span className="page-label">INVENTORY CONTROL</span><h2>Stock Count</h2><p>Record physical quantities, review differences and confirm stock adjustments.</p></div></div>
    <section className="panel overview-section">
      <p>Counts use this browser’s warehouse data. Back up your data first and use one WMS tab while counting. This version counts existing inventory items; receive newly discovered SKUs through Monitor. Save your draft before leaving this page.</p>
      <div className="overview-form"><label>Location<select value={location} onChange={event => setLocation(event.target.value)}><option value="">Select a location</option>{data?.racks.flatMap(rack => rack.shelves.filter(shelf => shelf.inventory.length > 0).map(shelf => <option key={JSON.stringify([rack.id, shelf.id])} value={JSON.stringify([rack.id, shelf.id])}>{rack.id} / {shelf.code || '(No Code)'} [{shelf.id}] · Load {shelf.basket?.id || '(None)'}</option>))}</select></label></div>
      <div className="overview-actions"><button type="button" className="primary-button" disabled={!canEditWarehouse() || !location || !data} onClick={start}>Start count</button><button type="button" className="settings-secondary" onClick={() => { if (!canLeave()) return; open(null); setNotice(null); load(); }}>Reload data</button></div>
      {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      {stale && <p role="status">Warehouse data may have changed. Reload before continuing. Current stock will also be checked before confirmation.</p>}
    </section>
    <section className="panel overview-section"><h3>Counts and history</h3>
      <div className="overview-form"><label>Count record<select value={selected} onChange={event => { if (canLeave()) open(counts.find(count => count.id === event.target.value)); }}><option value="">Select a count</option>{counts.map(count => <option key={count.id} value={count.id}>{count.locationCode || count.shelfId} · {statusLabel[count.status]} · {date(count.createdAt)} · {count.id}</option>)}</select></label></div>
      {!counts.length && <p>No stock counts yet.</p>}
      {current && draft && <>
        <p>{current.id}<br />{current.rackId} / {current.locationCode || current.shelfId} · Load {current.loadId}<br />Status: {statusLabel[current.status]} · Created: {date(current.createdAt)}{current.closedAt && <> · Closed: {date(current.closedAt)}</>}</p>
        <div className="overview-form"><label>Counter name<input value={draft.operator} readOnly={!editable || !canEditWarehouse()} onChange={event => change({ ...draft, operator: event.target.value })} /></label><label>Reason / Count notes<input value={draft.reason} readOnly={!editable || !canEditWarehouse()} onChange={event => change({ ...draft, reason: event.target.value })} /></label></div>
        <p>The counter name identifies who counted the goods; the signed-in account is recorded when the app saves an adjustment. {dirty && 'Unsaved changes.'}</p>
        <div style={{ overflowX: 'auto' }}><table className="consistency-table"><thead><tr><th scope="col">SKU / Item</th><th scope="col">Unit</th><th scope="col">System quantity at start</th><th scope="col">Reserved</th><th scope="col">Physical count</th><th scope="col">Difference</th></tr></thead><tbody>{current.lines.map((line, index) => {
          const value = draft.counted[index];
          const difference = value === '' || !Number.isFinite(Number(value)) ? null : Number(value) - line.before;
          return <tr key={line.itemId}><td>{line.sku}<br />{line.name}</td><td>{line.unit}</td><td>{line.before}</td><td>{line.reserved}</td><td><input aria-label={`Physical count for ${line.sku}`} type="number" min="0" step="any" value={value} readOnly={!editable || !canEditWarehouse()} onChange={event => change({ ...draft, counted: draft.counted.map((item, i) => i === index ? event.target.value : item) })} /></td><td>{difference === null ? 'Not entered' : difference > 0 ? `+${difference}` : difference}</td></tr>;
        })}</tbody></table></div>
        {editable && <div className="overview-actions"><button type="button" className="settings-secondary" disabled={!canEditWarehouse()} onClick={() => act('SAVE')}>Save draft (no stock change)</button><button type="button" className="primary-button" disabled={!canEditWarehouse() || !draft.operator.trim() || !draft.reason.trim() || draft.counted.some(value => value === '' || !Number.isFinite(Number(value)) || Number(value) < 0)} onClick={() => act('CONFIRM')}>Confirm adjustment</button><button type="button" className="settings-secondary" disabled={!canEditWarehouse()} onClick={() => act('CANCEL')}>Cancel count</button></div>}
      </>}
    </section>
  </div>;
}
