import { isReserved } from './basketStore.js';
import { saveAuditedWarehouse, AUDIT_MONITOR_KEY } from './wmsAudit.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireValue = (ok, message) => { if (!ok) throw new Error(message); };
const clone = value => JSON.parse(JSON.stringify(value));
const near = (a, b) => Math.abs(a - b) <= Number.EPSILON * 16 * Math.max(1, Math.abs(a), Math.abs(b));
const within = (value, limit) => value <= limit || near(value, limit);
const snap = (value, limit = 0) => near(value, limit) ? limit : value;
const closed = doc => ['COMPLETED', 'CANCELLED'].includes(doc.status);
function quantity(value, positive = false) {
  requireValue(['number', 'string'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && (!positive || Number(value) > 0), 'Enter valid non-negative quantities (planned quantities must be greater than zero).');
  return Number(value);
}
export function validateDocuments(documents) {
  if (documents == null) return;
  requireValue(Array.isArray(documents), 'Invalid warehouse document list.');
  const ids = new Set(), numbers = new Set();
  for (const doc of documents) {
    requireValue(object(doc) && typeof doc.id === 'string' && doc.id && !ids.has(doc.id) && typeof doc.number === 'string' && doc.number.trim() && !numbers.has(doc.number.trim().toLowerCase()), 'Missing or duplicate document identity.');
    ids.add(doc.id); numbers.add(doc.number.trim().toLowerCase());
    requireValue(['INBOUND', 'OUTBOUND'].includes(doc.type) && ['DRAFT', 'OPEN', 'PARTIAL', 'COMPLETED', 'CANCELLED'].includes(doc.status) && Number.isInteger(doc.revision) && doc.revision >= 0 && typeof doc.reference === 'string' && Number.isFinite(Date.parse(doc.createdAt)) && Array.isArray(doc.lines) && doc.lines.length > 0 && Array.isArray(doc.events), 'Invalid document structure.');
    const lineIds = new Set(), targets = new Set();
    for (const line of doc.lines) {
      requireValue(object(line) && ['id', 'rackId', 'shelfId', 'loadId', 'sku', 'name', 'unit'].every(field => typeof line[field] === 'string' && line[field].trim()) && !lineIds.has(line.id) && !targets.has(JSON.stringify([line.shelfId, line.sku])), 'Invalid or duplicate document line.');
      lineIds.add(line.id); targets.add(JSON.stringify([line.shelfId, line.sku]));
      requireValue(typeof line.quantity === 'number' && typeof line.processed === 'number' && typeof line.reserved === 'number', 'Invalid document quantities.');
      quantity(line.quantity, true); quantity(line.processed); quantity(line.reserved);
      requireValue(within(line.processed + line.reserved, line.quantity) && (doc.type === 'OUTBOUND' || line.reserved === 0), 'Document quantities exceed planned quantity.');
      if (doc.status === 'DRAFT') requireValue(line.processed === 0 && line.reserved === 0, 'Draft document has processed quantities.');
      if (closed(doc)) requireValue(line.reserved === 0, 'Closed document still has reservations.');
      if (doc.status === 'COMPLETED') requireValue(line.processed === line.quantity, 'Completed document is incomplete.');
    }
    const requests = new Set();
    for (const [eventIndex, event] of doc.events.entries()) {
      requireValue(object(event) && typeof event.requestId === 'string' && event.requestId && !requests.has(event.requestId) && ['CREATE', 'RECEIVE', 'RESERVE', 'PICK', 'CANCEL'].includes(event.action) && typeof event.actor === 'string' && event.actor.trim() && typeof event.reason === 'string' && event.reason.trim() && Number.isFinite(Date.parse(event.createdAt)) && Array.isArray(event.quantities), 'Invalid document event.');
      requireValue(event.action === 'CREATE' ? eventIndex === 0 : (doc.type === 'INBOUND' ? ['RECEIVE', 'CANCEL'].includes(event.action) : ['RESERVE', 'PICK', 'CANCEL'].includes(event.action)), 'Document event does not match document type.');
      if (event.action === 'CANCEL') requireValue(eventIndex === doc.events.length - 1 && doc.status === 'CANCELLED', 'Invalid cancellation history.');
      requests.add(event.requestId);
      for (const entry of event.quantities) requireValue(object(entry) && lineIds.has(entry.lineId) && typeof entry.quantity === 'number' && Number.isFinite(entry.quantity) && entry.quantity > 0, 'Invalid document event quantity.');
    }
    for (const line of doc.lines) {
      let processed = 0, reserved = 0;
      for (const event of doc.events) {
        const entries = event.quantities.filter(entry => entry.lineId === line.id);
        requireValue(entries.length <= 1, 'Duplicate document event line.');
        const amount = entries[0]?.quantity || 0;
        if (event.action === 'RECEIVE' || event.action === 'PICK') processed += amount;
        if (event.action === 'RESERVE') reserved += amount;
        if (event.action === 'PICK') reserved -= amount;
        if (event.action === 'CANCEL') reserved = 0;
        requireValue(within(0, reserved) && within(processed + reserved, line.quantity), 'Invalid document activity totals.');
      }
      requireValue(near(processed, line.processed) && near(reserved, line.reserved), 'Document totals do not match activity.');
    }
    requireValue(doc.events.length === doc.revision + 1 && doc.events[0]?.action === 'CREATE', 'Invalid document revision history.');
  }
}
export function readDocumentData(storage = localStorage) {
  const data = JSON.parse(storage.getItem(AUDIT_MONITOR_KEY) || 'null');
  requireValue(object(data) && Array.isArray(data.racks) && data.racks.every(rack => object(rack) && Array.isArray(rack.shelves) && rack.shelves.every(shelf => object(shelf) && Array.isArray(shelf.inventory))), 'Invalid warehouse data. Open Monitor and check data consistency first.');
  validateDocuments(data.documents);
  return data;
}
function location(data, line, storage, allowUnavailable = false) {
  const racks = data.racks.filter(rack => rack.id === line.rackId);
  const shelves = data.racks.flatMap(rack => rack.shelves).filter(shelf => shelf.id === line.shelfId);
  requireValue(racks.length === 1 && shelves.length === 1 && racks[0].shelves.includes(shelves[0]), 'Location is missing or duplicated.');
  const shelf = shelves[0];
  requireValue(shelf.basket?.id && (!line.loadId || line.loadId === shelf.basket.id), 'Load is missing or has changed. Review this document.');
  requireValue(data.racks.flatMap(rack => rack.shelves).filter(point => point.basket?.id === shelf.basket.id).length === 1, 'Duplicate Load ID.');
  const queue = JSON.parse(storage.getItem('wms-robot-tasks-v1') || '[]');
  requireValue(Array.isArray(queue) && queue.every(object), 'Invalid transfer queue.');
  requireValue(!isReserved(shelf.id, '', data, queue), 'This location is reserved by a transfer. Resolve the transfer first.');
  requireValue(allowUnavailable || !['BLOCKED', 'MAINTENANCE'].includes(shelf.status), 'Location is unavailable.');
  return shelf;
}
function itemAt(shelf, line, required = true) {
  const matches = shelf.inventory.filter(item => item.sku === line.sku);
  requireValue(matches.length <= 1, 'Duplicate SKU inventory at this location. Check data consistency.');
  const item = matches[0];
  requireValue(!required || item, `${line.sku}: Stock record is missing.`);
  if (item) {
    requireValue(!line.itemId || item.id === line.itemId, `${line.sku}: Stock record changed. Review this document.`);
    quantity(item.quantity); quantity(item.reserved ?? 0);
    requireValue(Number(item.reserved ?? 0) <= Number(item.quantity), 'Reserved stock exceeds quantity.');
    requireValue(item.unit === line.unit, `${line.sku}: Unit changed. Review this document.`);
  }
  return item;
}
function auditEvent(audit, action, requestId, quantities = []) {
  const actor = String(audit?.actor || '').trim(), reason = String(audit?.reason || '').trim();
  requireValue(actor && reason, 'Enter the operator name and reason.');
  return { requestId, action, actor, reason, quantities, createdAt: new Date().toISOString() };
}
function persist(data, original, audit, action, storage) {
  validateDocuments(data.documents);
  return saveAuditedWarehouse(data, { ...audit, action: `DOCUMENT_${action}`, expectedRaw: original }, storage);
}
export function createDocument(input, audit, storage = localStorage) {
  const original = storage.getItem(AUDIT_MONITOR_KEY), data = readDocumentData(storage);
  requireValue(['INBOUND', 'OUTBOUND'].includes(input.type) && Array.isArray(input.lines) && input.lines.length > 0, 'Select a document type and add at least one line.');
  const id = `DOC-${crypto.randomUUID()}`;
  const number = String(input.number || `${input.type === 'INBOUND' ? 'IN' : 'OUT'}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`).trim();
  const doc = { id, number, type: input.type, reference: String(input.reference || '').trim(), status: 'DRAFT', revision: 0, createdAt: new Date().toISOString(), lines: [], events: [] };
  for (const draft of input.lines) {
    const shelf = location(data, draft, storage);
    const sku = String(draft.sku || '').trim();
    const inventory = shelf.inventory.filter(item => item.sku === sku);
    requireValue(inventory.length <= 1, 'Duplicate SKU at this location.');
    const masters = (data.skuCatalog || []).filter(item => item.sku === sku);
    requireValue(masters.length <= 1, 'Duplicate SKU master.');
    const master = inventory[0] || masters[0];
    requireValue(master && (input.type !== 'OUTBOUND' || inventory[0]), 'Select an existing SKU. Add new SKU masters through Monitor first.');
    const line = { id: `LINE-${crypto.randomUUID()}`, rackId: draft.rackId, shelfId: draft.shelfId, locationCode: shelf.code || '', loadId: shelf.basket.id, itemId: inventory[0]?.id || '', sku, name: master.name || sku, unit: master.unit || 'PCS', quantity: quantity(draft.quantity, true), processed: 0, reserved: 0 };
    itemAt(shelf, line, input.type === 'OUTBOUND');
    doc.lines.push(line);
  }
  doc.events.push(auditEvent(audit, 'CREATE', crypto.randomUUID()));
  data.documents = [doc, ...(data.documents || [])];
  persist(data, original, audit, 'CREATE', storage);
  return id;
}
export function processDocument(id, action, input, audit, storage = localStorage) {
  const original = storage.getItem(AUDIT_MONITOR_KEY), data = readDocumentData(storage);
  const doc = (data.documents || []).find(record => record.id === id);
  requireValue(doc, 'Document not found.');
  requireValue(['RECEIVE', 'RESERVE', 'PICK', 'CANCEL'].includes(action) && typeof input.requestId === 'string' && input.requestId, 'Invalid document action.');
  const quantities = action === 'CANCEL' ? [] : doc.lines.map(line => ({ lineId: line.id, quantity: quantity(input.quantities?.[line.id] === '' ? 0 : input.quantities?.[line.id] ?? 0) })).filter(entry => entry.quantity > 0);
  requireValue(action === 'CANCEL' || (object(input.quantities) && Object.keys(input.quantities).every(key => doc.lines.some(line => line.id === key))), 'Quantity lines do not match this document.');
  const repeated = doc.events.find(event => event.requestId === input.requestId);
  if (repeated) {
    requireValue(repeated.action === action && JSON.stringify(repeated.quantities) === JSON.stringify(quantities), 'This request ID was used for different quantities.');
    return data;
  }
  requireValue(input.expectedRevision === doc.revision, 'Document changed. Reload before processing more quantities.');
  requireValue(!closed(doc), 'This document is already closed.');
  requireValue(action === 'CANCEL' || (doc.type === 'INBOUND' ? action === 'RECEIVE' : ['RESERVE', 'PICK'].includes(action)), 'Action does not match document type.');
  requireValue(action === 'CANCEL' || quantities.length > 0, 'Enter a quantity for at least one line.');
  const event = auditEvent(audit, action, input.requestId, quantities);
  if (action === 'CANCEL') {
    for (const line of doc.lines) {
      if (line.reserved > 0) {
        const shelf = location(data, line, storage, true), item = itemAt(shelf, line);
        requireValue(Number(item.reserved ?? 0) >= line.reserved, 'Reservation no longer matches this document.');
        item.reserved = snap(Number(item.reserved) - line.reserved);
        line.reserved = 0;
      }
    }
    doc.status = 'CANCELLED';
  } else {
    for (const entry of quantities) {
      const line = doc.lines.find(line => line.id === entry.lineId), qty = entry.quantity;
      const shelf = location(data, line, storage);
      let item = itemAt(shelf, line, action !== 'RECEIVE');
      requireValue(within(qty, line.quantity - line.processed - (action === 'RESERVE' ? line.reserved : 0)), `${line.sku}: Quantity exceeds the remaining document quantity.`);
      if (action === 'RECEIVE') {
        if (!item) {
          requireValue(!line.itemId, 'Stock record was removed. Review this document.');
          item = { id: `INV-${crypto.randomUUID()}`, sku: line.sku, name: line.name, unit: line.unit, category: (data.skuCatalog || []).find(master => master.sku === line.sku)?.category || 'General', quantity: 0, reserved: 0 };
          shelf.inventory.push(item); line.itemId = item.id;
        }
        item.quantity = Number(item.quantity) + qty;
        line.processed = snap(line.processed + qty, line.quantity);
      } else if (action === 'RESERVE') {
        requireValue(within(qty, Number(item.quantity) - Number(item.reserved ?? 0)), `${line.sku}: Not enough free stock to reserve.`);
        item.reserved = Number(item.reserved ?? 0) + qty;
        line.reserved = snap(line.reserved + qty, line.quantity - line.processed);
      } else {
        requireValue(within(qty, line.reserved) && within(qty, Number(item.reserved ?? 0)) && within(qty, Number(item.quantity)), `${line.sku}: Reserve stock before confirming picked quantities.`);
        item.quantity = snap(Number(item.quantity) - qty);
        item.reserved = snap(Number(item.reserved) - qty);
        line.reserved = snap(line.reserved - qty);
        line.processed = snap(line.processed + qty, line.quantity);
      }
    }
    doc.status = doc.lines.every(line => line.processed === line.quantity) ? 'COMPLETED' : doc.lines.some(line => line.processed > 0) ? 'PARTIAL' : 'OPEN';
  }
  doc.revision += 1; doc.updatedAt = event.createdAt; doc.events.push(event);
  if (closed(doc)) doc.closedAt = event.createdAt;
  data.history = [{ id: `HIS-${crypto.randomUUID()}`, type: `DOCUMENT_${action}`, documentId: doc.id, reference: doc.number, actor: event.actor, reason: event.reason, lines: clone(quantities), createdAt: event.createdAt }, ...(data.history || [])];
  return persist(data, original, audit, action, storage);
}
