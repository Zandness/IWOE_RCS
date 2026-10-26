import { useEffect, useState } from 'react';
import AuditFields from '../components/AuditFields';
import { createDocument, processDocument, readDocumentData } from '../utils/warehouseDocuments';
import '../styles/OverviewSettings.css';

const blankLine = () => ({ key: crypto.randomUUID(), target: '', sku: '', quantity: '' });
const date = value => new Date(value).toLocaleString('en-GB');
export default function WarehouseDocuments() {
  const [data, setData] = useState(null);
  const [type, setType] = useState('INBOUND');
  const [number, setNumber] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState(() => [blankLine()]);
  const [audit, setAudit] = useState({ actor: '', reason: '' });
  const [selected, setSelected] = useState('');
  const [quantities, setQuantities] = useState({});
  const [notice, setNotice] = useState(null);
  const [stale, setStale] = useState(false);
  const [search, setSearch] = useState('');
  function load() {
    try { setData(readDocumentData()); setStale(false); return true; }
    catch (error) { setData(null); setNotice({ error: true, text: error.message }); return false; }
  }
  useEffect(() => {
    load();
    const changed = () => setStale(true);
    const events = ['storage', 'focus', 'wms-monitor-data-changed', 'wms-data-changed'];
    events.forEach(name => window.addEventListener(name, changed));
    return () => events.forEach(name => window.removeEventListener(name, changed));
  }, []);
  const shelves = data?.racks.flatMap(rack => rack.shelves.map(shelf => ({ ...shelf, rackId: rack.id }))) || [];
  const docs = data?.documents || [];
  const current = docs.find(doc => doc.id === selected);
  const isClosed = current && ['COMPLETED', 'CANCELLED'].includes(current.status);
  function changeLine(key, changes) { setLines(values => values.map(line => line.key === key ? { ...line, ...changes } : line)); }
  function success(next, text) {
    window.dispatchEvent(new CustomEvent('wms-monitor-data-changed'));
    setData(next); setStale(false); setQuantities({}); setAudit(value => ({ ...value, reason: '' })); setNotice({ text });
  }
  function create(event) {
    event.preventDefault();
    try {
      const id = createDocument({ type, number, reference, lines: lines.map(line => {
        const [rackId, shelfId] = JSON.parse(line.target || 'null') || [];
        return { rackId, shelfId, sku: line.sku, quantity: line.quantity };
      }) }, audit);
      success(readDocumentData(), 'Draft document created. Stock has not changed.');
      setSelected(id); setNumber(''); setReference(''); setLines([blankLine()]);
    } catch (error) { setNotice({ error: true, text: error.message }); }
  }
  function act(action) {
    const message = action === 'CANCEL' ? 'Cancel the remaining document quantities? Received or picked stock will remain unchanged; outstanding document reservations will be released.' : action === 'RECEIVE' ? 'Confirm these goods were physically received? This adds stock.' : action === 'PICK' ? 'Confirm these goods were physically picked? This deducts stock and releases their reservations.' : 'Reserve the entered quantities? Stock quantity will remain unchanged.';
    if (!window.confirm(message)) return;
    try {
      const next = processDocument(current.id, action, { quantities, expectedRevision: current.revision, requestId: crypto.randomUUID() }, audit);
      success(next, action === 'CANCEL' ? 'Document cancelled. Completed quantities were preserved.' : 'Document quantities and warehouse stock updated.');
    } catch (error) { setNotice({ error: true, text: error.message }); }
  }
  return <div className="page wms-overview">
    <div className="page-header"><div><span className="page-label">WAREHOUSE OPERATIONS</span><h2>Inbound &amp; Outbound Documents</h2><p>Manage multiple SKUs per document, receive or pick partial quantities and track the remaining balance.</p></div></div>
    <section className="panel overview-section">
      <p>Documents use this browser’s data. Use one WMS tab and back up data regularly. New SKUs and Loads must be created in Monitor first. Document stock movements do not send commands to RCS.</p>
      <AuditFields value={audit} onChange={setAudit} />
      <div className="overview-actions"><button type="button" className="settings-secondary" onClick={() => { if (Object.values(quantities).some(value => value !== '' && Number(value) !== 0) && !window.confirm('Discard quantities entered for this action and reload?')) return; if (load()) { setQuantities({}); setNotice(null); } }}>Reload data</button></div>
      {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      {stale && <p role="status">Warehouse data may have changed. Reload before continuing; quantities and document revision are checked again on save.</p>}
    </section>
    <section className="panel overview-section"><h3>Create document</h3>
      <form onSubmit={create}>
        <div className="overview-form"><label>Type<select value={type} onChange={event => { setType(event.target.value); setLines([blankLine()]); }}><option value="INBOUND">Inbound</option><option value="OUTBOUND">Outbound</option></select></label><label>Document number (optional)<input value={number} onChange={event => setNumber(event.target.value)} placeholder="Generated automatically if empty" /></label><label>External reference<input value={reference} onChange={event => setReference(event.target.value)} placeholder="Supplier receipt / Customer order" /></label></div>
        {lines.map((line, index) => {
          const shelf = shelves.find(shelf => JSON.stringify([shelf.rackId, shelf.id]) === line.target);
          const catalog = type === 'OUTBOUND' ? shelf?.inventory || [] : [...new Map([...(data?.skuCatalog || []), ...(shelf?.inventory || [])].map(item => [item.sku, item])).values()];
          return <fieldset key={line.key} className="document-line"><legend>Line {index + 1}</legend><div className="overview-form">
            <label>Location / Load<select required value={line.target} onChange={event => changeLine(line.key, { target: event.target.value, sku: '' })}><option value="">Select location</option>{shelves.filter(point => point.basket?.id).map(point => <option key={JSON.stringify([point.rackId, point.id])} value={JSON.stringify([point.rackId, point.id])}>{point.rackId} / {point.code || point.id} · {point.basket.id}</option>)}</select></label>
            <label>SKU<select required value={line.sku} onChange={event => changeLine(line.key, { sku: event.target.value })}><option value="">Select SKU</option>{catalog.map(item => <option key={item.sku} value={item.sku}>{item.sku} · {item.name} · {item.unit}{type === 'OUTBOUND' ? ` · Free: ${Number(item.quantity) - Number(item.reserved || 0)}` : ''}</option>)}</select></label>
            <label>Planned quantity<input required type="number" min="0" step="any" value={line.quantity} onChange={event => changeLine(line.key, { quantity: event.target.value })} /></label>
          </div><button type="button" className="settings-secondary" disabled={lines.length === 1} onClick={() => setLines(values => values.filter(value => value.key !== line.key))}>Remove line</button></fieldset>;
        })}
        <div className="overview-actions"><button type="button" className="settings-secondary" onClick={() => setLines(values => [...values, blankLine()])}>Add SKU line</button><button type="submit" className="primary-button" disabled={!data || !audit.actor.trim() || !audit.reason.trim()}>Create draft</button></div>
      </form>
    </section>
    <section className="panel overview-section"><h3>Documents and progress</h3>
      <div className="overview-form"><label>Find documents<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Document number or external reference" /></label><label>Document<select value={selected} onChange={event => { if (Object.values(quantities).some(value => value !== '' && Number(value) !== 0) && !window.confirm('Discard quantities entered for this action?')) return; setSelected(event.target.value); setQuantities({}); }}><option value="">Select document</option>{docs.filter(doc => doc.id === selected || `${doc.number} ${doc.reference}`.toLowerCase().includes(search.toLowerCase())).map(doc => <option key={doc.id} value={doc.id}>{doc.number} · {doc.type} · {doc.status}</option>)}</select></label></div>
      {!docs.length && <p>No documents yet.</p>}
      {current && <>
        <p><strong>{current.number}</strong> · {current.type} · {current.status}<br />External reference: {current.reference || 'None'}<br />Created: {date(current.createdAt)}</p>
        <p>{current.type === 'INBOUND' ? 'Enter the quantities physically received now. Remaining quantities can be received later.' : 'Enter quantities for this action. Reserve stock first, then confirm only the quantities physically picked. You may reserve and pick in multiple steps.'}</p>
        <div style={{ overflowX: 'auto' }}><table className="consistency-table"><thead><tr><th scope="col">SKU / Location / Load</th><th scope="col">Planned</th><th scope="col">{current.type === 'INBOUND' ? 'Received' : 'Picked'}</th><th scope="col">Remaining</th><th scope="col">Reserved</th>{!isClosed && <th scope="col">Quantity now</th>}</tr></thead><tbody>{current.lines.map(line => <tr key={line.id}><td>{line.sku} · {line.name}<br />{line.rackId} / {line.locationCode || line.shelfId}<br />Load {line.loadId} · {line.unit}</td><td>{line.quantity}</td><td>{line.processed}</td><td>{line.quantity - line.processed}</td><td>{line.reserved}</td>{!isClosed && <td><input aria-label={`Quantity now for ${line.sku} at ${line.shelfId}`} type="number" min="0" step="any" value={quantities[line.id] ?? ''} onChange={event => setQuantities(values => ({ ...values, [line.id]: event.target.value }))} /></td>}</tr>)}</tbody></table></div>
        {!isClosed && <div className="overview-actions">
          {(current.type === 'INBOUND' ? [['RECEIVE', 'Confirm received quantities']] : [['RESERVE', 'Reserve quantities'], ['PICK', 'Confirm picked quantities']]).map(([action, label]) => <button key={action} type="button" className="primary-button" disabled={!audit.actor.trim() || !audit.reason.trim()} onClick={() => act(action)}>{label}</button>)}
          <button type="button" className="settings-secondary" disabled={!audit.actor.trim() || !audit.reason.trim()} onClick={() => act('CANCEL')}>Cancel remaining quantities</button>
        </div>}
        {current.status === 'CANCELLED' && <p>Unprocessed quantities were cancelled. Previously received or picked quantities remain recorded and were not reversed.</p>}
        <details><summary>Document activity ({current.events.length})</summary>{current.events.slice().reverse().map(event => <div key={event.requestId} className="audit-change"><strong>{event.action} · {date(event.createdAt)}</strong><p>Operator: {event.actor} · Reason: {event.reason}</p>{event.quantities.map(entry => { const line = current.lines.find(line => line.id === entry.lineId); return <p key={entry.lineId}>{line.sku} · {line.locationCode || line.shelfId} · {entry.quantity} {line.unit}</p>; })}</div>)}</details>
      </>}
    </section>
  </div>;
}
