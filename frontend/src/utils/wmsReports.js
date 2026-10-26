import { validateAuditLog } from './wmsAudit.js';
import { validateDocuments } from './warehouseDocuments.js';
import { validateStockCounts } from './stockCount.js';
import { transferWorkflowState } from './workflowStatus.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireValue = (ok, message) => { if (!ok) throw new Error(message); };
const column = (key, label) => ({ key, label });
export const REPORT_COLUMNS = {
  INVENTORY: [['rack', 'Storage'], ['location', 'Location'], ['locationId', 'Location ID'], ['load', 'Load ID'], ['sku', 'SKU'], ['name', 'Item'], ['unit', 'Unit'], ['quantity', 'On hand'], ['reserved', 'Reserved'], ['available', 'Available'], ['status', 'Location status']].map(([key, label]) => column(key, label)),
  MOVEMENTS: [['createdAt', 'Recorded at (UTC)'], ['action', 'Action'], ['actor', 'Operator'], ['reason', 'Reason'], ['position', 'Location / Item'], ['sku', 'SKU'], ['unit', 'Unit'], ['before', 'Quantity before'], ['after', 'Quantity after'], ['delta', 'Quantity change'], ['reservedBefore', 'Reserved before'], ['reservedAfter', 'Reserved after'], ['reservedDelta', 'Reserved change'], ['reference', 'Audit record']].map(([key, label]) => column(key, label)),
  PENDING: [['createdAt', 'Created at (UTC)'], ['source', 'Source'], ['reference', 'Reference'], ['status', 'Status'], ['sku', 'SKU'], ['unit', 'Unit'], ['remaining', 'Remaining'], ['reserved', 'Reserved'], ['location', 'Location'], ['load', 'Load ID'], ['nextStep', 'Next step']].map(([key, label]) => column(key, label)),
};
function stock(value) {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value >= 0, 'Invalid stock quantities. Run the WMS consistency check before reporting.');
  return value;
}
function readList(storage, key) {
  try {
    const list = JSON.parse(storage.getItem(key) || '[]');
    requireValue(Array.isArray(list) && list.every(object), `Invalid saved list: ${key}`);
    return { list, error: '' };
  } catch { return { list: [], error: `Saved data could not be read: ${key}. Pending report is incomplete.` }; }
}
export function readReportSnapshot(storage = localStorage) {
  const monitor = JSON.parse(storage.getItem('wms-monitor-master-v2') || 'null');
  requireValue(object(monitor) && Array.isArray(monitor.racks) && monitor.racks.every(rack => object(rack) && Array.isArray(rack.shelves) && rack.shelves.every(shelf => object(shelf) && Array.isArray(shelf.inventory) && shelf.inventory.every(object))), 'Warehouse data could not be read. Open Monitor and check data consistency first.');
  return { monitor, queue: readList(storage, 'wms-robot-tasks-v1'), legacyTasks: readList(storage, 'wms-warehouse-tasks-v1'), capturedAt: new Date().toISOString() };
}
function inventoryRows(monitor) {
  return monitor.racks.flatMap(rack => rack.shelves.flatMap(shelf => shelf.inventory.map((item, index) => {
    const quantity = stock(item.quantity), reserved = stock(item.reserved ?? 0);
    return { id: JSON.stringify([rack.id, shelf.id, item.id, index]), rack: rack.id, location: shelf.code || '', locationId: shelf.id, load: shelf.basket?.id || '', sku: item.sku || '', name: item.name || '', unit: item.unit || '', quantity, reserved, available: quantity - reserved, status: shelf.status || 'AVAILABLE' };
  })));
}
function movementRows(monitor) {
  validateAuditLog(monitor.auditLog);
  return (monitor.auditLog || []).flatMap(record => record.changes.flatMap((change, index) => {
    if (change.entity !== 'INVENTORY') return [];
    const before = change.before ? stock(change.before.quantity) : 0, after = change.after ? stock(change.after.quantity) : 0;
    const reservedBefore = change.before ? stock(change.before.reserved ?? 0) : 0, reservedAfter = change.after ? stock(change.after.reserved ?? 0) : 0;
    if (before === after && reservedBefore === reservedAfter) return [];
    const item = change.after || change.before;
    requireValue(object(item), 'Invalid inventory audit data.');
    return [{ id: `${record.id}/${index}`, createdAt: new Date(record.createdAt).toISOString(), action: record.action, actor: record.actor, reason: record.reason, position: change.position, sku: item.sku || '', unit: item.unit || '', before, after, delta: after - before, reservedBefore, reservedAfter, reservedDelta: reservedAfter - reservedBefore, reference: record.id }];
  })).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
function pendingRows(snapshot) {
  const { monitor, queue, legacyTasks } = snapshot;
  requireValue(!queue.error && !legacyTasks.error, queue.error || legacyTasks.error);
  validateDocuments(monitor.documents); validateStockCounts(monitor.stockCounts);
  requireValue(monitor.outboundOperations == null || (Array.isArray(monitor.outboundOperations) && monitor.outboundOperations.every(object)), 'Invalid outbound operations.');
  const rows = [];
  const add = (id, row) => rows.push({ id, createdAt: '', source: '', reference: '', status: '', sku: '', unit: '', remaining: '', reserved: '', location: '', load: '', ...row });
  for (const doc of monitor.documents || []) {
    if (['COMPLETED', 'CANCELLED'].includes(doc.status)) continue;
    for (const line of doc.lines) {
      if (line.processed === line.quantity) continue;
      add(`DOC/${doc.id}/${line.id}`, { createdAt: doc.createdAt, source: `${doc.type} DOCUMENT`, reference: doc.number, status: doc.status, sku: line.sku, unit: line.unit, remaining: line.quantity - line.processed, reserved: line.reserved, location: `${line.rackId} / ${line.locationCode || line.shelfId}`, load: line.loadId, nextStep: doc.type === 'INBOUND' ? 'Receive remaining goods in Documents' : line.reserved > 0 ? 'Confirm physically picked quantities in Documents' : 'Reserve remaining quantities in Documents' });
    }
  }
  for (const operation of monitor.outboundOperations || []) {
    if (['COMPLETED', 'CANCELLED', 'CANCELED'].includes(operation.status)) continue;
    add(`OUT/${operation.id}`, { createdAt: operation.createdAt || '', source: 'OUTBOUND PICKING', reference: operation.reference || operation.id, status: operation.status || 'UNKNOWN', sku: operation.sku || '', unit: operation.unit || '', remaining: stock(operation.quantity), reserved: stock(operation.quantity), location: `${operation.rackId} / ${operation.locationCode || operation.shelfId}`, load: operation.basketId || '', nextStep: operation.status === 'IN_PROGRESS' ? 'Confirm picked goods in Warehouse Operations' : 'Start picking in Warehouse Operations' });
  }
  for (const count of monitor.stockCounts || []) {
    if (count.status !== 'DRAFT') continue;
    add(`COUNT/${count.id}`, { createdAt: count.createdAt, source: 'STOCK COUNT', reference: count.id, status: count.status, location: `${count.rackId} / ${count.locationCode || count.shelfId}`, load: count.loadId, nextStep: 'Complete or cancel the draft in Stock Count' });
  }
  for (const task of queue.list) {
    const workflow = transferWorkflowState(task, monitor);
    if (workflow.closed) continue;
    add(`QUEUE/${task.id}`, { createdAt: task.createdAt || '', source: 'TRANSFER QUEUE', reference: task.id, status: workflow.label, location: `${task.sourceLocationId || '?'} → ${task.destinationLocationId || '?'}`, load: task.basketId || '', nextStep: workflow.nextStep });
  }
  for (const task of legacyTasks.list) {
    if (['COMPLETED', 'CANCELLED', 'CANCELED'].includes(task.status)) continue;
    add(`LEGACY/${task.id}`, { createdAt: task.createdAt || '', source: 'LEGACY WAREHOUSE TASK', reference: task.id || '', status: task.status || 'UNKNOWN', sku: task.sku || '', unit: task.unit || '', remaining: task.quantity ?? '', location: `${task.sourceLocationId || 'RECEIVING'} → ${task.destinationLocationId || 'SHIPPING'}`, nextStep: 'Review the previous-version task in Task Management' });
  }
  return rows.map(row => ({ ...row, createdAt: Number.isFinite(Date.parse(row.createdAt)) ? new Date(row.createdAt).toISOString() : '' })).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}
export function buildReport(snapshot, type) {
  requireValue(Object.hasOwn(REPORT_COLUMNS, type), 'Unknown report type.');
  return type === 'INVENTORY' ? inventoryRows(snapshot.monitor) : type === 'MOVEMENTS' ? movementRows(snapshot.monitor) : pendingRows(snapshot);
}
export function localDateKey(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function validDate(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return localDateKey(new Date(year, month - 1, day)) === value;
}
export function filterReport(rows, { search = '', from = '', to = '', type } = {}) {
  requireValue(validDate(from) && validDate(to) && (!from || !to || from <= to), 'Enter a valid date range with From on or before To.');
  const query = search.trim().toLowerCase();
  return rows.filter(row => {
    if (type !== 'INVENTORY' && (from || to)) {
      const day = row.createdAt ? localDateKey(row.createdAt) : '';
      if (!day || (from && day < from) || (to && day > to)) return false;
    }
    return !query || Object.entries(row).filter(([key]) => key !== 'id').some(([, value]) => String(value ?? '').toLowerCase().includes(query));
  });
}
export function inventoryTotals(rows) {
  const units = new Map();
  for (const row of rows) {
    const unit = row.unit || '(No unit)', total = units.get(unit) || { unit, quantity: 0, reserved: 0, available: 0 };
    for (const key of ['quantity', 'reserved', 'available']) total[key] += row[key];
    units.set(unit, total);
  }
  return [...units.values()];
}
export function reportCsv(rows, columns) {
  function cell(value) {
    let text = String(value ?? '');
    // Prevent spreadsheet formulas in user-provided text; keep numeric deltas numeric.
    if (typeof value !== 'number' && /^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }
  return '\uFEFF' + [columns.map(col => cell(col.label)).join(','), ...rows.map(row => columns.map(col => cell(row[col.key])).join(','))].join('\r\n') + '\r\n';
}
export function downloadReportCsv(rows, columns, filename) {
  const url = URL.createObjectURL(new Blob([reportCsv(rows, columns)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
